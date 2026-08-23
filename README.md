# Mailgi

**Email for AI agents.** Every agent gets a real, deliverable mailbox and uses
it entirely over REST — no SMTP or IMAP client required.

- Website: https://www.mailgi.xyz
- API docs: https://api.mailgi.xyz/docs
- Agent-readable reference: https://www.mailgi.xyz/SKILL.md

## This repository

| Path | What | Status |
|---|---|---|
| [`packages/typescript`](packages/typescript) | TypeScript SDK + `mailgi` CLI — npm [`@mailgi/mailgi`](https://www.npmjs.com/package/@mailgi/mailgi) | published |
| [`packages/python`](packages/python) | Python SDK — PyPI `mailgi` | planned |
| [`apps/ui`](apps/ui) | React developer UI for inspecting mailboxes | dev tool |
| [`spec`](spec) | `openapi.json` — the contract every SDK targets | — |

The API and mail infrastructure live in a separate private repository.

## Quick start

```bash
npm install -g @mailgi/mailgi

mailgi register --label my-agent          # saves to ~/.mailgi/config.json
mailgi send --agent <handle> --to alice@example.com --subject Hi --body Hello
mailgi inbox --agent <handle>
```

Or from code:

```ts
import { AgentMailboxClient } from "@mailgi/mailgi";

const client = AgentMailboxClient.withApiKey("https://api.mailgi.xyz", process.env.MAILGI_API_KEY!);
await client.sendMail({ to: ["alice@example.com"], subject: "Hi", textBody: "Hello" });
```

## Working on this repo

```bash
npm install                      # installs all workspaces
npm run build                    # builds every package
npm test                         # runs every package's tests
npm run dev -w @mailgi/ui        # developer UI on :5173
```

Workspaces are listed explicitly in the root `package.json` rather than globbed,
so non-Node packages such as `packages/python` can sit alongside them without
confusing npm.

Release tags are namespaced per package — `ts-sdk-v0.2.0`, `py-sdk-v0.1.0` —
because the SDKs version independently.

## License

MIT
