"""Drift guard: every request the SDK makes must exist in spec/openapi.json.

The SDK is hand-written (see README), so this is what catches a renamed or
removed endpoint. Skipped outside the repo checkout, where the spec is absent.
"""

import json
import re
from pathlib import Path

import pytest

from mailgi import MailgiClient

from .conftest import FakeTransport

SPEC = Path(__file__).resolve().parents[3] / "spec" / "openapi.json"


def _calls(client: MailgiClient):
    yield lambda: client.agents.register(label="x")
    yield client.agents.me
    yield client.agents.delete
    yield client.api_keys.list
    yield client.api_keys.create
    yield lambda: client.api_keys.revoke("k")
    yield lambda: client.auth.challenge("did")
    yield lambda: client.auth.verify("did", "n", "s")
    yield client.mail.list
    yield lambda: client.mail.get("m")
    yield lambda: client.mail.send(to="a@example.com", subject="s")
    yield lambda: client.mail.delete("m")
    yield lambda: client.mail.move("m", "b")
    yield lambda: client.mail.set_flags("m", seen=True)
    yield client.mailboxes.list
    yield lambda: client.mailboxes.create("n")
    yield lambda: client.mailboxes.delete("b")
    yield lambda: client.mailboxes.rename("b", "n")
    yield client.billing.get
    yield lambda: client.billing.topup(5)
    yield client.billing.transactions
    yield client.health.check
    yield client.health.ready
    yield lambda: client.webhooks.create("https://example.com")
    yield client.webhooks.list
    yield lambda: client.webhooks.delete("w")
    yield lambda: client.webhooks.deliveries("w")
    yield lambda: client.webhooks.resend_delivery("w", "d")
    yield lambda: client.webhooks.enable("w")


@pytest.mark.skipif(not SPEC.exists(), reason="spec/openapi.json not available")
def test_every_sdk_request_is_in_the_spec():
    spec = json.loads(SPEC.read_text())
    # The API ignores trailing slashes, and the spec and SDKs differ on them.
    routes = [
        (method.upper(), re.compile("^" + re.sub(r"\{[^/]+\}", "[^/]+", path.rstrip("/")) + "$"))
        for path, ops in spec["paths"].items()
        for method in ops
    ]

    t = FakeTransport(200, {"endpoints": [], "deliveries": []})
    client = MailgiClient(api_key="k", transport=t)
    for call in _calls(client):
        call()

    missing = []
    for method, url, *_ in t.calls:
        path = url.removeprefix(client.base_url).split("?")[0].rstrip("/")
        if not any(m == method and rx.match(path) for m, rx in routes):
            missing.append(f"{method} {path}")
    assert not missing, f"not in spec: {missing}"
    assert len(t.calls) == 29
