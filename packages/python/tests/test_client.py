"""Mirrors packages/typescript/test/client.test.ts."""

import pytest

from mailgi import (
    AgentMailboxClient,
    AgentMailboxError,
    BadRequestError,
    ConflictError,
    MailgiClient,
    MailgiError,
    NotFoundError,
    PaymentRequiredError,
    UnauthorizedError,
)

from .conftest import BASE, FakeTransport

# --- Fixtures ----------------------------------------------------------------

AGENT = {
    "agentId": "agent-123",
    "emailAddress": "buzzing-falcon@mailgi.xyz",
    "aliasAddress": "x7k3mwf2@mailgi.xyz",
    "label": "my-agent",
    "createdAt": "2026-01-01T00:00:00.000Z",
}

REGISTER_RESPONSE = {
    "agentId": "agent-123",
    "emailAddress": "buzzing-falcon@mailgi.xyz",
    "aliasAddress": "x7k3mwf2@mailgi.xyz",
    "apiKey": "amb_rawkeyonce",
    "apiKeyId": "key-abc",
}

EMAIL = {
    "id": "msg-001",
    "subject": "Hello",
    "from": [{"email": "alice@example.com"}],
    "to": [{"email": "buzzing-falcon@mailgi.xyz"}],
    "cc": [],
    "bcc": [],
    "receivedAt": "2026-04-17T10:00:00.000Z",
    "size": 1024,
    "preview": "Hi there",
    "seen": False,
    "mailboxIds": {"inbox-id": True},
    "keywords": {},
}

EMAIL_WITH_BODY = {**EMAIL, "textBody": "Hi there, this is the full body."}

MAILBOX = {
    "id": "mb-001",
    "name": "Inbox",
    "parentId": None,
    "role": "inbox",
    "totalEmails": 5,
    "unreadEmails": 2,
}

API_KEY = {
    "id": "key-001",
    "keyPrefix": "amb_abc",
    "label": "my-key",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "lastUsedAt": None,
    "expiresAt": None,
    "revokedAt": None,
}

TOPUP_PAGE = "https://app.mailgi.xyz/topup?address=bot%40mailgi.xyz"

BILLING = {
    "wallet": {"kind": "agent", "id": "agent_1"},
    "balanceUsd": 1.5,
    "meteringEnabled": True,
    "prices": {"outboundEmailUsd": 0.0005, "introductionUsd": 0.02, "storageGbMonthUsd": 0.25, "storageFreeBytes": 10485760},
    "knownContacts": 3,
    "standing": {"status": "ok", "lowBalanceUsd": 1},
    "topup": {"endpoint": "POST /v1/billing/topup", "publicPage": TOPUP_PAGE, "method": "stripe_checkout", "minAmountUsd": 5, "available": True},
    "depositAddresses": None,
}

# --- agents ------------------------------------------------------------------


def test_agents_register_posts_without_auth(respond):
    client, t = respond(201, REGISTER_RESPONSE)
    assert client.agents.register(label="my-agent") == REGISTER_RESPONSE
    assert t.url == f"{BASE}/v1/agents/register"
    assert t.method == "POST"
    assert t.json == {"label": "my-agent"}
    assert "Authorization" not in t.headers


def test_agents_me_sends_bearer(respond):
    client, t = respond(200, AGENT)
    assert client.agents.me() == AGENT
    assert t.url == f"{BASE}/v1/agents/me"
    assert t.headers["Authorization"] == "Bearer test-api-key"


def test_agents_delete_returns_none_on_204(respond):
    client, t = respond(204)
    assert client.agents.delete() is None
    assert t.url == f"{BASE}/v1/agents/me"
    assert t.method == "DELETE"


# --- mail --------------------------------------------------------------------


def test_mail_list_serialises_query(respond):
    client, t = respond(200, {"messages": [EMAIL], "total": 1, "position": 0}, api_key="my-key")
    client.mail.list(mailbox_id="inbox", limit=10, sort="desc")
    assert t.url == f"{BASE}/v1/mail?mailboxId=inbox&limit=10&sort=desc"
    assert t.headers["Authorization"] == "Bearer my-key"


def test_mail_list_omits_empty_query(respond):
    client, t = respond(200, {"messages": [], "total": 0, "position": 0})
    client.mail.list()
    assert t.url == f"{BASE}/v1/mail"


def test_mail_list_returns_parsed(respond):
    client, _ = respond(200, {"messages": [EMAIL], "total": 1, "position": 0})
    result = client.mail.list()
    assert len(result["messages"]) == 1
    assert result["total"] == 1


def test_mail_get(respond):
    client, t = respond(200, EMAIL_WITH_BODY)
    assert client.mail.get("msg-001") == EMAIL_WITH_BODY
    assert t.url == f"{BASE}/v1/mail/msg-001"


def test_mail_get_encodes_id(respond):
    client, t = respond(200, EMAIL_WITH_BODY)
    client.mail.get("a/b c")
    assert t.url == f"{BASE}/v1/mail/a%2Fb%20c"


def test_mail_send(respond):
    client, t = respond(201, {"messageId": "msg-sent-001"})
    result = client.mail.send(to=["alice@example.com"], subject="Hello", text_body="World")
    assert result == {"messageId": "msg-sent-001"}
    assert t.url == f"{BASE}/v1/mail/send"
    assert t.json == {"to": ["alice@example.com"], "subject": "Hello", "textBody": "World"}


def test_mail_send_single_recipient_becomes_list(respond):
    # The spec types `to`/`cc`/`bcc` as arrays.
    client, t = respond(201, {"messageId": "m"})
    client.mail.send(to="alice@example.com", subject="s", html_body="<p>h</p>", cc="bob@example.com", reply_to="r@example.com")
    assert t.json == {
        "to": ["alice@example.com"],
        "subject": "s",
        "cc": ["bob@example.com"],
        "htmlBody": "<p>h</p>",
        "replyTo": "r@example.com",
    }


def test_mail_delete(respond):
    client, t = respond(204)
    client.mail.delete("msg-001")
    assert t.url == f"{BASE}/v1/mail/msg-001"
    assert t.method == "DELETE"


def test_mail_move(respond):
    client, t = respond(204)
    client.mail.move("msg-001", "mb-trash")
    assert t.url == f"{BASE}/v1/mail/msg-001/move"
    assert t.method == "PATCH"
    assert t.json == {"mailboxId": "mb-trash"}


def test_mail_set_flags(respond):
    client, t = respond(204)
    client.mail.set_flags("msg-001", seen=True)
    assert t.url == f"{BASE}/v1/mail/msg-001/flags"
    assert t.method == "PATCH"
    assert t.json == {"seen": True}


# --- mailboxes ---------------------------------------------------------------


def test_mailboxes_list(respond):
    client, t = respond(200, [MAILBOX])
    result = client.mailboxes.list()
    assert len(result) == 1
    assert result[0]["role"] == "inbox"
    assert t.url == f"{BASE}/v1/mailboxes"


def test_mailboxes_create(respond):
    client, t = respond(201, MAILBOX)
    assert client.mailboxes.create("Archive") == MAILBOX
    assert t.json == {"name": "Archive"}


def test_mailboxes_delete(respond):
    client, t = respond(204)
    client.mailboxes.delete("mb-001")
    assert t.url == f"{BASE}/v1/mailboxes/mb-001"
    assert t.method == "DELETE"


def test_mailboxes_rename(respond):
    client, t = respond(204)
    client.mailboxes.rename("mb-001", "New Name")
    assert t.url == f"{BASE}/v1/mailboxes/mb-001"
    assert t.method == "PATCH"
    assert t.json == {"name": "New Name"}


# --- api keys ----------------------------------------------------------------


def test_api_keys_list(respond):
    client, t = respond(200, [API_KEY])
    result = client.api_keys.list()
    assert result[0]["id"] == "key-001"
    assert t.url == f"{BASE}/v1/apikeys"


def test_api_keys_create(respond):
    client, t = respond(201, {**API_KEY, "apiKey": "amb_newrawkey", "apiKeyId": "key-001"})
    result = client.api_keys.create(label="ci")
    assert result["apiKey"] == "amb_newrawkey"
    assert t.json == {"label": "ci"}


def test_api_keys_revoke(respond):
    client, t = respond(204)
    client.api_keys.revoke("key-001")
    assert t.url == f"{BASE}/v1/apikeys/key-001"
    assert t.method == "DELETE"


# --- auth --------------------------------------------------------------------


def test_auth_challenge_without_auth(respond):
    client, t = respond(200, {"nonce": "abc123", "expiresAt": "2026-01-01T00:05:00.000Z"})
    assert client.auth.challenge("did:key:z6Mk")["nonce"] == "abc123"
    assert t.url == f"{BASE}/v1/auth/challenge"
    assert t.json == {"did": "did:key:z6Mk"}
    assert "Authorization" not in t.headers


def test_auth_verify(respond):
    client, t = respond(200, {"token": "jwt.tok.en", "expiresIn": 3600})
    assert client.auth.verify("did:key:z6Mk", "abc123", "sig")["token"] == "jwt.tok.en"
    assert t.json == {"did": "did:key:z6Mk", "nonce": "abc123", "signature": "sig"}


# --- billing -----------------------------------------------------------------


def test_billing_get(respond):
    client, t = respond(200, BILLING)
    result = client.billing.get()
    assert result["balanceUsd"] == 1.5
    assert result["wallet"]["kind"] == "agent"
    assert result["standing"]["status"] == "ok"
    assert result["topup"]["publicPage"] == TOPUP_PAGE
    assert t.url == f"{BASE}/v1/billing"


def test_billing_topup(respond):
    client, t = respond(200, {"url": "https://checkout.stripe.com/c/pay/cs_1", "sessionId": "cs_1", "amountUsd": 10, "wallet": BILLING["wallet"]})
    assert client.billing.topup(10)["url"] == "https://checkout.stripe.com/c/pay/cs_1"
    assert t.url == f"{BASE}/v1/billing/topup"
    assert t.method == "POST"
    assert t.json == {"amountUsd": 10}


def test_billing_transactions_pagination(respond):
    client, t = respond(200, {"transactions": [], "total": 0, "limit": 10, "offset": 0})
    client.billing.transactions(limit=10, offset=20)
    assert t.url == f"{BASE}/v1/billing/transactions?limit=10&offset=20"


def test_billing_transactions_no_query(respond):
    client, t = respond(200, {"transactions": [], "total": 0, "limit": 50, "offset": 0})
    client.billing.transactions()
    assert t.url == f"{BASE}/v1/billing/transactions"


# --- billing notice and 402 --------------------------------------------------

NOTICE = {
    "status": "low_balance",
    "balanceUsd": 0.4,
    "lowBalanceUsd": 1,
    "topupPage": TOPUP_PAGE,
    "message": "Balance is low for this mailbox. Ask whoever pays for you to top up: " + TOPUP_PAGE,
}


def test_billing_notice_passes_through_on_list(respond):
    client, _ = respond(200, {"messages": [], "total": 0, "position": 0, "billing": NOTICE})
    result = client.mail.list()
    assert result["billing"]["status"] == "low_balance"
    assert result["billing"]["topupPage"] == TOPUP_PAGE


def test_billing_notice_on_send(respond):
    client, _ = respond(201, {"messageId": "m", "billing": {**NOTICE, "status": "in_debt"}})
    assert client.mail.send(to="a@example.com", subject="s", text_body="t")["billing"]["status"] == "in_debt"


def test_debt_limit_402_is_payment_required_with_details(respond):
    client, _ = respond(402, {
        "error": {
            "code": "PAYMENT_REQUIRED",
            "message": "Balance -$1.50 is past the debt limit (-$1.00)",
            "details": {"reason": "debt_limit", "balanceUsd": -1.5, "debtLimitUsd": -1, "requiredUsd": 0.5, "topupPage": TOPUP_PAGE},
        },
    })
    with pytest.raises(PaymentRequiredError) as exc:
        client.mail.list()
    err = exc.value
    assert isinstance(err, MailgiError)
    assert err.status_code == 402
    assert err.code == "PAYMENT_REQUIRED"
    assert err.reads_blocked is True
    assert err.details["requiredUsd"] == 0.5
    assert err.details["topupPage"] == TOPUP_PAGE
    assert err.details["debtLimitUsd"] == -1
    assert str(err) == "Balance -$1.50 is past the debt limit (-$1.00)"


def test_refused_send_is_not_a_read_block(respond):
    client, _ = respond(402, {
        "error": {"code": "PAYMENT_REQUIRED", "message": "costs $0.0205", "details": {"requiredUsd": 0.0205, "unknownRecipients": ["x@example.com"]}},
    })
    with pytest.raises(PaymentRequiredError) as exc:
        client.mail.send(to="x@example.com", subject="s", text_body="t")
    assert exc.value.reads_blocked is False
    assert exc.value.details["unknownRecipients"] == ["x@example.com"]


def test_402_without_details_has_empty_details(respond):
    client, _ = respond(402, {"error": {"message": "pay"}})
    with pytest.raises(PaymentRequiredError) as exc:
        client.mail.list()
    assert exc.value.details == {}
    assert exc.value.reads_blocked is False


# --- webhooks ----------------------------------------------------------------

ENDPOINT = {"id": "wh-1", "url": "https://example.com/hook", "eventTypes": ["mail.received"], "enabled": True, "createdAt": "2026-01-01T00:00:00.000Z"}


def test_webhooks_create(respond):
    client, t = respond(201, {**ENDPOINT, "secret": "whsec_once"})
    assert client.webhooks.create("https://example.com/hook")["secret"] == "whsec_once"
    assert t.url == f"{BASE}/v1/webhook-endpoints/"
    assert t.method == "POST"
    assert t.json == {"url": "https://example.com/hook"}


def test_webhooks_list_unwraps_endpoints(respond):
    client, t = respond(200, {"endpoints": [ENDPOINT]})
    assert client.webhooks.list() == [ENDPOINT]
    assert t.url == f"{BASE}/v1/webhook-endpoints/"


def test_webhooks_delete(respond):
    client, t = respond(204)
    client.webhooks.delete("wh-1")
    assert t.url == f"{BASE}/v1/webhook-endpoints/wh-1"
    assert t.method == "DELETE"


def test_webhooks_deliveries_unwraps(respond):
    client, t = respond(200, {"deliveries": [{"id": "d-1"}]})
    assert client.webhooks.deliveries("wh-1") == [{"id": "d-1"}]
    assert t.url == f"{BASE}/v1/webhook-endpoints/wh-1/deliveries"


def test_webhooks_resend_and_enable(respond):
    client, t = respond(200, {"id": "d-1", "status": "pending"})
    client.webhooks.resend_delivery("wh-1", "d-1")
    assert t.url == f"{BASE}/v1/webhook-endpoints/wh-1/deliveries/d-1/resend"
    assert t.method == "POST"

    client, t = respond(200, {"id": "wh-1", "enabled": True})
    assert client.webhooks.enable("wh-1") == {"id": "wh-1", "enabled": True}
    assert t.url == f"{BASE}/v1/webhook-endpoints/wh-1/enable"


# --- health ------------------------------------------------------------------


def test_health_check_without_auth(respond):
    client, t = respond(200, {"status": "ok"})
    assert client.health.check()["status"] == "ok"
    assert t.url == f"{BASE}/health"
    assert "Authorization" not in t.headers


def test_health_ready(respond):
    client, t = respond(200, {"status": "ok", "checks": {"database": "ok", "stalwart": "ok"}})
    assert client.health.ready()["status"] == "ok"
    assert t.url == f"{BASE}/health/ready"


# --- error handling ----------------------------------------------------------


@pytest.mark.parametrize(
    "status,cls",
    [(400, BadRequestError), (401, UnauthorizedError), (404, NotFoundError), (409, ConflictError)],
)
def test_status_maps_to_error_class(respond, status, cls):
    client, _ = respond(status, {"error": {"message": "nope"}})
    with pytest.raises(cls):
        client.agents.me()


def test_server_message_in_error(respond):
    client, _ = respond(404, {"error": {"message": "Mailbox not found"}})
    with pytest.raises(NotFoundError, match="Mailbox not found"):
        client.mailboxes.delete("bad-id")


def test_other_status_keeps_code_and_details(respond):
    client, _ = respond(429, {"error": {"code": "RATE_LIMITED", "message": "slow down", "details": {"retryAfter": 5}}})
    with pytest.raises(MailgiError) as exc:
        client.agents.me()
    assert (exc.value.status_code, exc.value.code, exc.value.details) == (429, "RATE_LIMITED", {"retryAfter": 5})


def test_falls_back_to_reason_when_body_not_json(respond):
    client, _ = respond(500, raw=b"<html>oops</html>", reason="Internal Server Error")
    with pytest.raises(MailgiError) as exc:
        client.agents.me()
    assert exc.value.status_code == 500
    assert exc.value.message == "Internal Server Error"
    assert exc.value.code == "SERVER_ERROR"


def test_timeout_raises_timeout_code():
    def slow(*_):
        raise TimeoutError("timed out")

    client = MailgiClient(api_key="key", base_url=BASE, timeout=1, transport=slow)
    with pytest.raises(MailgiError) as exc:
        client.agents.me()
    assert (exc.value.code, exc.value.status_code) == ("TIMEOUT", 408)


# --- construction ------------------------------------------------------------


def test_with_api_key():
    t = FakeTransport(200, AGENT)
    client = MailgiClient.with_api_key(BASE, "factory-key")
    client._transport = t
    client.agents.me()
    assert t.headers["Authorization"] == "Bearer factory-key"


def test_api_key_can_be_set_later():
    t = FakeTransport(200, AGENT)
    client = MailgiClient(transport=t)
    client.api_key = "later"
    client.agents.me()
    assert t.url == "https://api.mailgi.xyz/v1/agents/me"
    assert t.headers["Authorization"] == "Bearer later"


def test_base_url_trailing_slash_stripped():
    t = FakeTransport(200, {"status": "ok"})
    MailgiClient(base_url=f"{BASE}/", transport=t).health.check()
    assert t.url == f"{BASE}/health"


def test_ts_names_are_aliases():
    assert AgentMailboxClient is MailgiClient
    assert AgentMailboxError is MailgiError
