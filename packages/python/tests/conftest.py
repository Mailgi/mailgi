import json
from typing import Any, Dict, List, Optional, Tuple

import pytest

from mailgi import MailgiClient

BASE = "https://api.mailgi.xyz"


class FakeTransport:
    """Records each request and answers with a canned response, like the TS tests' stubbed fetch."""

    def __init__(self, status: int = 200, body: Any = None, reason: Optional[str] = None, raw: Optional[bytes] = None):
        self.status = status
        self.reason = reason or str(status)
        self.raw = raw if raw is not None else (b"" if body is None else json.dumps(body).encode())
        self.calls: List[Tuple[str, str, Dict[str, str], Optional[bytes], float]] = []

    def __call__(self, method, url, headers, body, timeout):
        self.calls.append((method, url, headers, body, timeout))
        return self.status, self.reason, self.raw

    @property
    def method(self) -> str:
        return self.calls[0][0]

    @property
    def url(self) -> str:
        return self.calls[0][1]

    @property
    def headers(self) -> Dict[str, str]:
        return self.calls[0][2]

    @property
    def json(self) -> Any:
        return json.loads(self.calls[0][3] or b"null")


@pytest.fixture
def respond():
    """`respond(status, body)` -> (client, transport)."""

    def make(status: int = 200, body: Any = None, api_key: str = "test-api-key", **kw):
        transport = FakeTransport(status, body, **kw)
        return MailgiClient(api_key=api_key, base_url=BASE, timeout=5, transport=transport), transport

    return make
