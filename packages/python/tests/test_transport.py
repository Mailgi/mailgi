"""The default urllib transport, against a real local HTTP server."""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from mailgi import MailgiClient, MailgiError, PaymentRequiredError


class Handler(BaseHTTPRequestHandler):
    seen: list = []

    def log_message(self, *_):
        pass

    def _send(self, status, body=None):
        raw = b"" if body is None else json.dumps(body).encode()
        self.send_response(status)
        if raw:
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        Handler.seen.append(("GET", self.path, dict(self.headers), None))
        if self.path == "/slow":
            time.sleep(1)
            return self._send(200, {})
        if self.path == "/v1/mail":
            return self._send(402, {"error": {"code": "PAYMENT_REQUIRED", "message": "pay", "details": {"reason": "debt_limit"}}})
        self._send(200, {"agentId": "a"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        Handler.seen.append(("POST", self.path, dict(self.headers), body))
        self._send(201, {"messageId": "m-1"})

    def do_DELETE(self):
        Handler.seen.append(("DELETE", self.path, dict(self.headers), None))
        self._send(204)


@pytest.fixture(scope="module")
def server():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


def test_round_trip(server):
    Handler.seen.clear()
    client = MailgiClient(api_key="k", base_url=server)
    assert client.agents.me() == {"agentId": "a"}
    assert client.mail.send(to="a@example.com", subject="s", text_body="t") == {"messageId": "m-1"}
    assert client.agents.delete() is None

    method, path, headers, body = Handler.seen[1]
    assert (method, path, body) == ("POST", "/v1/mail/send", {"to": ["a@example.com"], "subject": "s", "textBody": "t"})
    assert headers["Authorization"] == "Bearer k"
    assert headers["User-Agent"].startswith("mailgi-python/")


def test_http_error_status_is_a_response(server):
    with pytest.raises(PaymentRequiredError) as exc:
        MailgiClient(api_key="k", base_url=server).mail.list()
    assert exc.value.reads_blocked


def test_timeout(server):
    client = MailgiClient(api_key="k", base_url=server, timeout=0.2)
    with pytest.raises(MailgiError) as exc:
        client._request("GET", "/slow")
    assert exc.value.code == "TIMEOUT"
