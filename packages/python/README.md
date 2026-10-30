# mailgi

Python SDK for the [Mailgi](https://www.mailgi.xyz) API: real email addresses for AI agents.

```bash
pip install mailgi
```

Python 3.9 or later. No dependencies.

## Quick start

```python
from mailgi import MailgiClient

client = MailgiClient()

# Register an agent. The API key is shown once: store it.
reg = client.agents.register(label="my-agent")
print(reg["emailAddress"])  # buzzing-falcon@mailgi.xyz
client.api_key = reg["apiKey"]

# Send
client.mail.send(
    to="alice@example.com",
    subject="Hello from my agent",
    text_body="Sent by an AI agent via Mailgi.",
)

# Read
inbox = client.mail.list(limit=20, sort="desc")
for msg in inbox["messages"]:
    full = client.mail.get(msg["id"])
    print(full["subject"], full["from"][0]["email"])
    client.mail.set_flags(msg["id"], seen=True)
```

Later, from a stored key:

```python
client = MailgiClient(api_key=os.environ["MAILGI_API_KEY"])
```

Results are plain dicts with the API's camelCase keys. They are typed as
`TypedDict`s (`ListMailResponse`, `EmailWithBody`, ...) for editors and type
checkers.

## Billing

Receiving is free, and so is mail to `@mailgi.xyz` addresses or your own
organisation's domains. Mail to outside recipients is paid from a prepaid
wallet: a price per recipient, a one-time introduction fee for someone who has
never written to the agent, and storage above 10 MB. `client.billing.get()`
returns the prices, the balance and a top-up link.

### The `billing` notice

`mail.list()`, `mail.get()` and `mail.send()` results carry a `billing` key
while the wallet needs attention. Forward its `topupPage` to whoever pays; no
Mailgi login is needed to pay.

```python
result = client.mail.list()
if "billing" in result:
    notify_owner(result["billing"]["message"])  # includes the top-up link
```

### 402: `PaymentRequiredError`

When the wallet cannot pay, the call raises `PaymentRequiredError`:

```python
from mailgi import PaymentRequiredError

try:
    client.mail.send(to="alice@example.com", subject="Hi", text_body="Hello")
except PaymentRequiredError as err:
    notify_owner(f"Needs ${err.details.get('requiredUsd')}: {err.details.get('topupPage')}")
    if err.reads_blocked:
        ...  # debt is past the limit: reading is paused too, not just sending
```

- A refused send sent nothing. `details` has `requiredUsd`, `unknownRecipients`
  (first-contact addresses) and the prices.
- `reads_blocked` is true when `details["reason"] == "debt_limit"`. Reads
  resume once the balance is back at `debtLimitUsd`. Receiving, webhooks,
  deleting and billing keep working.

To create a card payment link yourself: `client.billing.topup(10)["url"]`.

## Webhooks

Get a POST when mail arrives instead of polling:

```python
endpoint = client.webhooks.create("https://example.com/mailgi")
secret = endpoint["secret"]  # shown once: store it
```

Verify every notification against the **raw** body before acting on it:

```python
import json
from mailgi import verify_webhook_signature

@app.post("/mailgi")  # Flask
def mailgi_hook():
    raw = request.get_data()
    result = verify_webhook_signature(
        body=raw,
        signature=request.headers["x-mailgi-signature"],
        timestamp=request.headers["x-mailgi-timestamp"],
        secret=os.environ["MAILGI_WEBHOOK_SECRET"],
    )
    if not result:
        return result.reason, 401
    event = json.loads(raw)  # InboundMailNotification
    handle(event)  # read the message itself via event["fetchUrl"]
    return "", 204
```

The notification is a thin event (`agentId`, `messageId`, `from`, `to`,
`receivedAt`, `size`, `spam`, `fetchUrl`), with no subject or body, so mail
content stays out of your endpoint's logs. `fetchUrl` can be `None` if the
server's lookup failed. Notifications older than 5 minutes are rejected
(`tolerance_seconds`).

## Reference

`MailgiClient(api_key=None, base_url="https://api.mailgi.xyz", timeout=30.0, transport=None)`

| Method | Endpoint |
|---|---|
| `agents.register(label=, did=)` | `POST /v1/agents/register` (no auth) |
| `agents.me()` | `GET /v1/agents/me` |
| `agents.delete()` | `DELETE /v1/agents/me` |
| `mail.list(mailbox_id=, limit=, position=, sort=)` | `GET /v1/mail` |
| `mail.get(id)` | `GET /v1/mail/{id}` |
| `mail.send(to, subject, text_body=, html_body=, cc=, bcc=, reply_to=)` | `POST /v1/mail/send` |
| `mail.delete(id)` | `DELETE /v1/mail/{id}` |
| `mail.move(id, mailbox_id)` | `PATCH /v1/mail/{id}/move` |
| `mail.set_flags(id, seen=, flagged=)` | `PATCH /v1/mail/{id}/flags` |
| `mailboxes.list()` / `create(name, parent_id=)` / `delete(id)` / `rename(id, name)` | `/v1/mailboxes` |
| `api_keys.list()` / `create(label=, expires_at=)` / `revoke(key_id)` | `/v1/apikeys` |
| `billing.get()` | `GET /v1/billing` |
| `billing.topup(amount_usd)` | `POST /v1/billing/topup` |
| `billing.transactions(limit=, offset=)` | `GET /v1/billing/transactions` |
| `webhooks.create(url, scope=, event_types=)` / `list()` / `delete(id)` | `/v1/webhook-endpoints` |
| `webhooks.deliveries(id)` / `resend_delivery(id, delivery_id)` / `enable(id)` | `/v1/webhook-endpoints/{id}/...` |
| `auth.challenge(did)` / `auth.verify(did, nonce, signature)` | DID auth (no auth) |
| `health.check()` / `health.ready()` | `GET /health`, `/health/ready` (no auth) |

### Errors

Every error is a `MailgiError` with `message`, `status_code`, `code` and
`details`. Subclasses: `BadRequestError` (400), `UnauthorizedError` (401),
`PaymentRequiredError` (402), `NotFoundError` (404), `ConflictError` (409). A
timeout raises `MailgiError` with `code == "TIMEOUT"`.

`AgentMailboxClient` and `AgentMailboxError` are aliases, matching the
TypeScript SDK's names.

### Custom HTTP

Requests use the standard library (`urllib`). To use another HTTP client,
pass `transport`, a callable `(method, url, headers, body, timeout) ->
(status, reason, body_bytes)` that raises `TimeoutError` on timeout.

## Development

```bash
uv run pytest
uv build
```

This SDK is hand-written against [`spec/openapi.json`](https://github.com/Mailgi/mailgi/blob/main/spec/openapi.json),
not generated. The spec has no shared schemas and mixes dashboard-only routes
with the agent API, and the parts that need care (402 details, webhook
verification) would be hand-written anyway. `tests/test_spec.py` fails if the
SDK calls an endpoint the spec doesn't have.

Releases are tagged `py-sdk-vX.Y.Z`.

## Links

- API docs: https://api.mailgi.xyz/docs
- TypeScript SDK: [`@mailgi/mailgi`](https://www.npmjs.com/package/@mailgi/mailgi)
- Website: https://www.mailgi.xyz

## License

MIT
