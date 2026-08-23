import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentMailboxClient } from '../src/client.js';
import {
  AgentMailboxError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../src/errors.js';
import type {
  Agent,
  ApiKey,
  BillingInfo,
  ChallengeResponse,
  CreateApiKeyResponse,
  Email,
  EmailWithBody,
  HealthResponse,
  ListMailResponse,
  ListTransactionsResponse,
  Mailbox,
  RegisterAgentResponse,
  SendMailResponse,
  VerifyResponse,
} from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = 'https://api.mailgi.xyz';

function makeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function makeNoContent(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    statusText: 'No Content',
    json: () => Promise.reject(new Error('no body')),
  } as unknown as Response);
}

function makeClient(apiKey = 'test-api-key'): AgentMailboxClient {
  return new AgentMailboxClient({ baseUrl: BASE, apiKey, timeout: 5_000 });
}

function lastCall(): [string, RequestInit] {
  return (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AGENT: Agent = {
  agentId: 'agent-123',
  emailAddress: 'buzzing-falcon@mailgi.xyz',
  aliasAddress: 'x7k3mwf2@mailgi.xyz',
  label: 'my-agent',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const REGISTER_RESPONSE: RegisterAgentResponse = {
  agentId: 'agent-123',
  emailAddress: 'buzzing-falcon@mailgi.xyz',
  aliasAddress: 'x7k3mwf2@mailgi.xyz',
  apiKey: 'amb_rawkeyonce',
  apiKeyId: 'key-abc',
};

const EMAIL: Email = {
  id: 'msg-001',
  subject: 'Hello',
  from: [{ email: 'alice@example.com' }],
  to: [{ email: 'buzzing-falcon@mailgi.xyz' }],
  cc: [],
  bcc: [],
  receivedAt: '2026-04-17T10:00:00.000Z',
  size: 1024,
  preview: 'Hi there',
  seen: false,
  mailboxIds: { 'inbox-id': true },
  keywords: {},
};

const EMAIL_WITH_BODY: EmailWithBody = {
  ...EMAIL,
  textBody: 'Hi there, this is the full body.',
};

const MAILBOX: Mailbox = {
  id: 'mb-001',
  name: 'Inbox',
  parentId: null,
  role: 'inbox',
  totalEmails: 5,
  unreadEmails: 2,
};

const API_KEY: ApiKey = {
  id: 'key-001',
  keyPrefix: 'amb_abc',
  label: 'my-key',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
};

const BILLING: BillingInfo = {
  balanceUsd: 1.5,
  depositAddresses: { evm: '0xABC', solana: 'GF4A' },
  pricePerExternalEmail: 0.005,
  acceptedToken: 'USDC',
  networks: { evm: ['Ethereum mainnet', 'Base'], solana: ['Solana mainnet'] },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentMailboxClient', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  // ── agents ─────────────────────────────────────────────────────────────────

  describe('agents.register', () => {
    it('POSTs to /v1/agents/register without auth and returns response', async () => {
      vi.stubGlobal('fetch', makeFetch(201, REGISTER_RESPONSE));
      const client = makeClient('');
      const result = await client.agents.register({ label: 'my-agent' });

      expect(result).toEqual(REGISTER_RESPONSE);

      const [url, init] = lastCall();
      expect(url).toBe(`${BASE}/v1/agents/register`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ label: 'my-agent' });
      expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });
  });

  describe('agents.me', () => {
    it('GETs /v1/agents/me with auth header', async () => {
      vi.stubGlobal('fetch', makeFetch(200, AGENT));
      const result = await makeClient().agents.me();

      expect(result).toEqual(AGENT);
      const [url, init] = lastCall();
      expect(url).toBe(`${BASE}/v1/agents/me`);
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-api-key');
    });
  });

  describe('agents.delete', () => {
    it('DELETEs /v1/agents/me and returns undefined on 204', async () => {
      vi.stubGlobal('fetch', makeNoContent());

      const result = await makeClient().agents.delete();
      expect(result).toBeUndefined();
      expect(lastCall()[0]).toBe(`${BASE}/v1/agents/me`);
    });
  });

  // ── mail ───────────────────────────────────────────────────────────────────

  describe('mail.list', () => {
    it('includes auth header and serialises query params', async () => {
      const body: ListMailResponse = { messages: [], total: 0, position: 0 };
      vi.stubGlobal('fetch', makeFetch(200, body));

      await makeClient('my-key').mail.list({ mailboxId: 'inbox', limit: 10, sort: 'desc' });

      const [url, init] = lastCall();
      expect(url).toBe(`${BASE}/v1/mail?mailboxId=inbox&limit=10&sort=desc`);
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-key');
    });

    it('omits query string when no options provided', async () => {
      vi.stubGlobal('fetch', makeFetch(200, { messages: [], total: 0, position: 0 }));
      await makeClient().mail.list();
      expect(lastCall()[0]).toBe(`${BASE}/v1/mail`);
    });

    it('returns the parsed response', async () => {
      const body: ListMailResponse = { messages: [EMAIL], total: 1, position: 0 };
      vi.stubGlobal('fetch', makeFetch(200, body));
      const result = await makeClient().mail.list();
      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('mail.get', () => {
    it('GETs /v1/mail/:id and returns full message with body', async () => {
      vi.stubGlobal('fetch', makeFetch(200, EMAIL_WITH_BODY));
      const result = await makeClient().mail.get('msg-001');

      expect(result).toEqual(EMAIL_WITH_BODY);
      expect(lastCall()[0]).toBe(`${BASE}/v1/mail/msg-001`);
    });
  });

  describe('mail.send', () => {
    it('POSTs to /v1/mail/send with correct body', async () => {
      const resp: SendMailResponse = { messageId: 'sent-001' };
      vi.stubGlobal('fetch', makeFetch(200, resp));

      const result = await makeClient().mail.send({
        to: ['alice@example.com'],
        subject: 'Hello',
        textBody: 'Hi there.',
      });

      expect(result).toEqual(resp);
      const [url, init] = lastCall();
      expect(url).toBe(`${BASE}/v1/mail/send`);
      expect(JSON.parse(init.body as string)).toMatchObject({
        to: ['alice@example.com'],
        subject: 'Hello',
        textBody: 'Hi there.',
      });
    });
  });

  describe('mail.delete', () => {
    it('DELETEs /v1/mail/:id', async () => {
      vi.stubGlobal('fetch', makeNoContent());

      await makeClient().mail.delete('msg-001');
      expect(lastCall()[0]).toBe(`${BASE}/v1/mail/msg-001`);
      expect(lastCall()[1].method).toBe('DELETE');
    });
  });

  describe('mail.move', () => {
    it('PATCHes /v1/mail/:id/move with mailboxId', async () => {
      vi.stubGlobal('fetch', makeNoContent());

      await makeClient().mail.move('msg-001', 'mb-trash');
      const [url, init] = lastCall();
      expect(url).toBe(`${BASE}/v1/mail/msg-001/move`);
      expect(JSON.parse(init.body as string)).toEqual({ mailboxId: 'mb-trash' });
    });
  });

  describe('mail.setFlags', () => {
    it('PATCHes /v1/mail/:id/flags', async () => {
      vi.stubGlobal('fetch', makeNoContent());

      await makeClient().mail.setFlags('msg-001', { seen: true });
      const [url, init] = lastCall();
      expect(url).toBe(`${BASE}/v1/mail/msg-001/flags`);
      expect(JSON.parse(init.body as string)).toEqual({ seen: true });
    });
  });

  // ── mailboxes ──────────────────────────────────────────────────────────────

  describe('mailboxes.list', () => {
    it('GETs /v1/mailboxes', async () => {
      vi.stubGlobal('fetch', makeFetch(200, [MAILBOX]));
      const result = await makeClient().mailboxes.list();
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('inbox');
      expect(lastCall()[0]).toBe(`${BASE}/v1/mailboxes`);
    });
  });

  describe('mailboxes.create', () => {
    it('POSTs to /v1/mailboxes with name', async () => {
      vi.stubGlobal('fetch', makeFetch(201, MAILBOX));
      const result = await makeClient().mailboxes.create({ name: 'Archive' });
      expect(result).toEqual(MAILBOX);
      expect(JSON.parse(lastCall()[1].body as string)).toEqual({ name: 'Archive' });
    });
  });

  describe('mailboxes.delete', () => {
    it('DELETEs /v1/mailboxes/:id', async () => {
      vi.stubGlobal('fetch', makeNoContent());

      await makeClient().mailboxes.delete('mb-001');
      expect(lastCall()[0]).toBe(`${BASE}/v1/mailboxes/mb-001`);
      expect(lastCall()[1].method).toBe('DELETE');
    });
  });

  describe('mailboxes.rename', () => {
    it('PATCHes /v1/mailboxes/:id with new name', async () => {
      vi.stubGlobal('fetch', makeNoContent());

      await makeClient().mailboxes.rename('mb-001', 'New Name');
      const [url, init] = lastCall();
      expect(url).toBe(`${BASE}/v1/mailboxes/mb-001`);
      expect(JSON.parse(init.body as string)).toEqual({ name: 'New Name' });
    });
  });

  // ── apiKeys ────────────────────────────────────────────────────────────────

  describe('apiKeys.list', () => {
    it('GETs /v1/apikeys', async () => {
      vi.stubGlobal('fetch', makeFetch(200, [API_KEY]));
      const result = await makeClient().apiKeys.list();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('key-001');
    });
  });

  describe('apiKeys.create', () => {
    it('POSTs to /v1/apikeys and returns raw key', async () => {
      const resp: CreateApiKeyResponse = { ...API_KEY, apiKey: 'amb_newrawkey', apiKeyId: 'key-001' };
      vi.stubGlobal('fetch', makeFetch(201, resp));
      const result = await makeClient().apiKeys.create({ label: 'my-key' });
      expect(result.apiKey).toBe('amb_newrawkey');
    });
  });

  describe('apiKeys.revoke', () => {
    it('DELETEs /v1/apikeys/:keyId', async () => {
      vi.stubGlobal('fetch', makeNoContent());

      await makeClient().apiKeys.revoke('key-001');
      expect(lastCall()[0]).toBe(`${BASE}/v1/apikeys/key-001`);
      expect(lastCall()[1].method).toBe('DELETE');
    });
  });

  // ── auth ───────────────────────────────────────────────────────────────────

  describe('auth.challenge', () => {
    it('POSTs /v1/auth/challenge without auth', async () => {
      const resp: ChallengeResponse = { nonce: 'abc123', expiresAt: '2026-01-01T00:05:00Z' };
      vi.stubGlobal('fetch', makeFetch(200, resp));

      const result = await makeClient().auth.challenge('did:key:z6Mk');
      expect(result.nonce).toBe('abc123');
      const [url, init] = lastCall();
      expect(url).toBe(`${BASE}/v1/auth/challenge`);
      expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });
  });

  describe('auth.verify', () => {
    it('POSTs /v1/auth/verify and returns a token', async () => {
      const resp: VerifyResponse = { token: 'jwt.tok.en', expiresIn: 3600 };
      vi.stubGlobal('fetch', makeFetch(200, resp));

      const result = await makeClient().auth.verify({
        did: 'did:key:z6Mk',
        nonce: 'abc123',
        signature: 'sig',
      });
      expect(result.token).toBe('jwt.tok.en');
    });
  });

  // ── billing ────────────────────────────────────────────────────────────────

  describe('billing.get', () => {
    it('GETs /v1/billing and returns balance info', async () => {
      vi.stubGlobal('fetch', makeFetch(200, BILLING));
      const result = await makeClient().billing.get();
      expect(result.balanceUsd).toBe(1.5);
      expect(result.depositAddresses?.evm).toBe('0xABC');
      expect(lastCall()[0]).toBe(`${BASE}/v1/billing`);
    });
  });

  describe('billing.transactions', () => {
    it('GETs /v1/billing/transactions with pagination params', async () => {
      const resp: ListTransactionsResponse = { transactions: [], total: 0, limit: 10, offset: 0 };
      vi.stubGlobal('fetch', makeFetch(200, resp));

      await makeClient().billing.transactions({ limit: 10, offset: 20 });
      expect(lastCall()[0]).toBe(`${BASE}/v1/billing/transactions?limit=10&offset=20`);
    });

    it('omits query string when no options provided', async () => {
      const resp: ListTransactionsResponse = { transactions: [], total: 0, limit: 20, offset: 0 };
      vi.stubGlobal('fetch', makeFetch(200, resp));
      await makeClient().billing.transactions();
      expect(lastCall()[0]).toBe(`${BASE}/v1/billing/transactions`);
    });
  });

  // ── health ─────────────────────────────────────────────────────────────────

  describe('health.check', () => {
    it('GETs /health without auth', async () => {
      const resp: HealthResponse = { status: 'ok' };
      vi.stubGlobal('fetch', makeFetch(200, resp));
      const result = await makeClient().health.check();
      expect(result.status).toBe('ok');
      const [url, init] = lastCall();
      expect(url).toBe(`${BASE}/health`);
      expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });
  });

  describe('health.ready', () => {
    it('GETs /health/ready', async () => {
      vi.stubGlobal('fetch', makeFetch(200, { status: 'ok', checks: { database: 'ok', stalwart: 'ok' } }));
      const result = await makeClient().health.ready();
      expect(result.status).toBe('ok');
      expect(lastCall()[0]).toBe(`${BASE}/health/ready`);
    });
  });

  // ── error handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws NotFoundError on 404', async () => {
      vi.stubGlobal('fetch', makeFetch(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
      await expect(makeClient().mail.get('bad-id')).rejects.toThrow(NotFoundError);
    });

    it('throws UnauthorizedError on 401', async () => {
      vi.stubGlobal('fetch', makeFetch(401, { error: { message: 'Invalid API key' } }));
      await expect(makeClient('bad').agents.me()).rejects.toThrow(UnauthorizedError);
    });

    it('throws BadRequestError on 400', async () => {
      vi.stubGlobal('fetch', makeFetch(400, { error: { message: 'Missing field' } }));
      // @ts-expect-error — intentional bad request
      await expect(makeClient().agents.register({})).rejects.toThrow(BadRequestError);
    });

    it('throws ConflictError on 409', async () => {
      vi.stubGlobal('fetch', makeFetch(409, { error: { message: 'Already exists' } }));
      await expect(makeClient().agents.register({ did: 'did:key:dup' })).rejects.toThrow(ConflictError);
    });

    it('includes server error message in thrown error', async () => {
      vi.stubGlobal('fetch', makeFetch(404, { error: { message: 'Mailbox not found' } }));
      await expect(makeClient().mailboxes.delete('bad-id')).rejects.toThrow('Mailbox not found');
    });

    it('falls back to statusText when response body is not valid JSON', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 500, statusText: 'Internal Server Error',
        json: () => Promise.reject(new SyntaxError('bad json')),
      } as unknown as Response));

      await expect(makeClient().agents.me()).rejects.toMatchObject({
        statusCode: 500,
        message: 'Internal Server Error',
      });
    });

    it('throws AgentMailboxError with TIMEOUT code on request timeout', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init.signal!.addEventListener('abort', () =>
            rej(new DOMException('Aborted', 'AbortError')));
        }),
      ));

      const client = new AgentMailboxClient({ baseUrl: BASE, apiKey: 'key', timeout: 1 });
      await expect(client.agents.me()).rejects.toMatchObject({ code: 'TIMEOUT', statusCode: 408 });
    });
  });

  // ── factory + misc ─────────────────────────────────────────────────────────

  describe('AgentMailboxClient.withApiKey', () => {
    it('constructs a client and sets the apiKey', async () => {
      vi.stubGlobal('fetch', makeFetch(200, AGENT));
      const client = AgentMailboxClient.withApiKey(BASE, 'factory-key');
      await client.agents.me();
      expect((lastCall()[1].headers as Record<string, string>)['Authorization'])
        .toBe('Bearer factory-key');
    });
  });

  describe('baseUrl normalization', () => {
    it('strips trailing slash', async () => {
      vi.stubGlobal('fetch', makeFetch(200, { status: 'ok' }));
      await new AgentMailboxClient({ baseUrl: `${BASE}/`, timeout: 5_000 }).health.check();
      expect(lastCall()[0]).toBe(`${BASE}/health`);
    });
  });
});
