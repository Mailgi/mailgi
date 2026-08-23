# mailgi

TypeScript SDK and CLI for the [mailgi](https://mailgi.xyz) API — email for AI agents.

## Install

```bash
npm install @mailgi/mailgi
```

Requires Node.js 18 or later.

---

## CLI

```bash
# Install globally
npm install -g @mailgi/mailgi

# Register a new agent (saves credentials to ~/.mailgi/config.json)
mailgi register --label my-agent

# List registered agents
mailgi agents

# Add an existing agent by API key
mailgi login --agent buzzing-falcon@mailgi.xyz --apikey amb_...

# Send an email
mailgi send --agent buzzing-falcon --to alice@example.com --subject "Hi" --body "Hello"

# Read inbox
mailgi inbox --agent buzzing-falcon

# Read a message
mailgi read --agent buzzing-falcon <message-id>

# Check balance
mailgi billing --agent buzzing-falcon
```

`--agent` accepts a full email address (`buzzing-falcon@mailgi.xyz`) or just the username (`buzzing-falcon`).

All commands support `--json` for raw JSON output.

```bash
mailgi --help         # all commands
mailgi <cmd> --help   # options for a specific command
```

---

## SDK — Quick start

### Register an agent and send your first email

```typescript
import { AgentMailboxClient } from '@mailgi/mailgi';

const client = new AgentMailboxClient({
  baseUrl: 'https://api.mailgi.xyz',
});

// Register an agent — returns an email address and API key.
// Store the API key securely; it is shown only once.
const registration = await client.agents.register({ label: 'my-agent' });

console.log('Email:', registration.emailAddress);
// => buzzing-falcon@mailgi.xyz

console.log('API Key:', registration.apiKey);
// => amb_...  (save this!)

// Use the key for subsequent requests
client.apiKey = registration.apiKey;
```

### Send an email

```typescript
const { messageId } = await client.mail.send({
  to: ['alice@example.com'],
  subject: 'Hello from my agent',
  textBody: 'This was sent by an AI agent via mailgi.',
});
```

Sending to external addresses costs **$0.005 per recipient** (USDC). Agent-to-agent mail (`@mailgi.xyz`) is always free.

### Read incoming mail

```typescript
const { messages, total } = await client.mail.list({ limit: 20, sort: 'desc' });

if (messages.length > 0) {
  const email = await client.mail.get(messages[0].id);
  console.log('Subject:', email.subject);
  console.log('From:',    email.from.map(f => f.email).join(', '));
  console.log('Body:',    email.textBody);

  await client.mail.setFlags(email.id, { seen: true });
}
```

### Construct a client from a stored API key

```typescript
const client = AgentMailboxClient.withApiKey(
  'https://api.mailgi.xyz',
  process.env.MAILGI_API_KEY!,
);
```

---

## SDK — API reference

### Constructor

```typescript
const client = new AgentMailboxClient({
  baseUrl: string,   // e.g. 'https://api.mailgi.xyz'
  apiKey?: string,   // set now or assign client.apiKey later
  timeout?: number,  // ms, default 30000
});
```

### `client.agents`

| Method | Endpoint | Auth |
|--------|----------|------|
| `agents.register(req)` | `POST /v1/agents/register` | No |
| `agents.me()` | `GET /v1/agents/me` | Yes |
| `agents.delete()` | `DELETE /v1/agents/me` | Yes |

### `client.mail`

| Method | Endpoint | Auth |
|--------|----------|------|
| `mail.list(opts?)` | `GET /v1/mail` | Yes |
| `mail.get(id)` | `GET /v1/mail/:id` | Yes |
| `mail.send(req)` | `POST /v1/mail/send` | Yes |
| `mail.delete(id)` | `DELETE /v1/mail/:id` | Yes |
| `mail.move(id, mailboxId)` | `PATCH /v1/mail/:id/move` | Yes |
| `mail.setFlags(id, flags)` | `PATCH /v1/mail/:id/flags` | Yes |

### `client.mailboxes`

| Method | Endpoint | Auth |
|--------|----------|------|
| `mailboxes.list()` | `GET /v1/mailboxes` | Yes |
| `mailboxes.create(req)` | `POST /v1/mailboxes` | Yes |
| `mailboxes.delete(id)` | `DELETE /v1/mailboxes/:id` | Yes |
| `mailboxes.rename(id, name)` | `PATCH /v1/mailboxes/:id` | Yes |

### `client.apiKeys`

| Method | Endpoint | Auth |
|--------|----------|------|
| `apiKeys.list()` | `GET /v1/apikeys` | Yes |
| `apiKeys.create(req?)` | `POST /v1/apikeys` | Yes |
| `apiKeys.revoke(keyId)` | `DELETE /v1/apikeys/:id` | Yes |

### `client.billing`

| Method | Endpoint | Auth |
|--------|----------|------|
| `billing.get()` | `GET /v1/billing` | Yes |
| `billing.transactions(opts?)` | `GET /v1/billing/transactions` | Yes |

### `client.auth`

DID-based authentication (optional — most agents use API keys instead).

| Method | Endpoint | Auth |
|--------|----------|------|
| `auth.challenge(did)` | `POST /v1/auth/challenge` | No |
| `auth.verify(req)` | `POST /v1/auth/verify` | No |

### `client.health`

| Method | Endpoint | Auth |
|--------|----------|------|
| `health.check()` | `GET /health` | No |
| `health.ready()` | `GET /health/ready` | No |

---

## Error handling

All errors extend `AgentMailboxError` and expose `message`, `statusCode`, and `code`.

```typescript
import { AgentMailboxClient, NotFoundError, UnauthorizedError } from '@mailgi/mailgi';

try {
  const email = await client.mail.get('msg-does-not-exist');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('Not found:', err.message);
  } else if (err instanceof UnauthorizedError) {
    console.log('Bad API key');
  }
}
```

Requests time out after 30s by default. Timeout throws `AgentMailboxError` with `code: 'TIMEOUT'`.

---

## Links

- **API docs**: https://api.mailgi.xyz/docs
- **OpenAPI spec**: https://api.mailgi.xyz/openapi.json
- **Website**: https://mailgi.xyz

---

## License

MIT
