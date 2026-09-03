import {
  AgentMailboxError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from './errors.js';
import type {
  Agent,
  ApiKey,
  BalanceTransaction,
  BillingInfo,
  ListTransactionsOptions,
  ListTransactionsResponse,
  ChallengeResponse,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  CreateMailboxRequest,
  CreateWebhookEndpointRequest,
  CreateWebhookEndpointResponse,
  Email,
  EmailWithBody,
  HealthResponse,
  ListMailOptions,
  ListMailResponse,
  Mailbox,
  RegisterAgentRequest,
  RegisterAgentResponse,
  SendMailRequest,
  SendMailResponse,
  VerifyRequest,
  VerifyResponse,
  ListWebhookEndpointsResponse,
  WebhookEndpoint,
} from './types.js';

export interface ClientOptions {
  baseUrl: string;
  /** Optional at construction; can be set later via `client.apiKey`. */
  apiKey?: string;
  /** Request timeout in milliseconds. Defaults to 30000 (30s). */
  timeout?: number;
}

export class AgentMailboxClient {
  /** The API key used for authenticated requests. Can be updated at any time. */
  public apiKey: string | undefined;

  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 30_000;
  }

  /** Convenience factory for constructing an authenticated client in one call. */
  static withApiKey(baseUrl: string, apiKey: string): AgentMailboxClient {
    return new AgentMailboxClient({ baseUrl, apiKey });
  }

  // ---------------------------------------------------------------------------
  // Core HTTP plumbing
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    authenticated = true,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (authenticated && this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AgentMailboxError(
          `Request timed out after ${this.timeout}ms`,
          408,
          'TIMEOUT',
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorMessage: string;
      let errorCode: string | undefined;

      try {
        const errorBody = (await response.json()) as {
          message?: string;
          error?: { message?: string; code?: string } | string;
          code?: string;
        };
        // API sends { error: { code, message } }; fall back to flat shapes
        const nested = typeof errorBody.error === 'object' ? errorBody.error : null;
        errorMessage =
          errorBody.message ??
          nested?.message ??
          (typeof errorBody.error === 'string' ? errorBody.error : undefined) ??
          response.statusText;
        errorCode = errorBody.code ?? nested?.code;
      } catch {
        errorMessage = response.statusText;
      }

      switch (response.status) {
        case 400:
          throw new BadRequestError(errorMessage);
        case 401:
          throw new UnauthorizedError(errorMessage);
        case 404:
          throw new NotFoundError(errorMessage);
        case 409:
          throw new ConflictError(errorMessage);
        default:
          throw new AgentMailboxError(
            errorMessage,
            response.status,
            errorCode ?? 'SERVER_ERROR',
          );
      }
    }

    // 204 No Content — return void-compatible empty value
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  // ---------------------------------------------------------------------------
  // agents namespace
  // ---------------------------------------------------------------------------

  readonly agents = {
    /**
     * Register a new agent with a DID.
     * Returns the email address and API key (shown once — store it securely).
     */
    register: (req: RegisterAgentRequest): Promise<RegisterAgentResponse> =>
      this.request<RegisterAgentResponse>('POST', '/v1/agents/register', req, false),

    /** Fetch the authenticated agent's profile. */
    me: (): Promise<Agent> =>
      this.request<Agent>('GET', '/v1/agents/me'),

    /** Deregister the authenticated agent and permanently delete all data. */
    delete: (): Promise<void> =>
      this.request<void>('DELETE', '/v1/agents/me'),
  };

  // ---------------------------------------------------------------------------
  // apiKeys namespace
  // ---------------------------------------------------------------------------

  readonly apiKeys = {
    /** List all API keys for the authenticated agent. */
    list: (): Promise<ApiKey[]> =>
      this.request<ApiKey[]>('GET', '/v1/apikeys'),

    /** Create a new API key. Returns the raw key once — store it securely. */
    create: (req?: CreateApiKeyRequest): Promise<CreateApiKeyResponse> =>
      this.request<CreateApiKeyResponse>('POST', '/v1/apikeys', req ?? {}),

    /** Revoke an API key by ID. */
    revoke: (keyId: string): Promise<void> =>
      this.request<void>('DELETE', `/v1/apikeys/${encodeURIComponent(keyId)}`),
  };

  // ---------------------------------------------------------------------------
  // auth namespace
  // ---------------------------------------------------------------------------

  readonly auth = {
    /**
     * Request a challenge nonce for DID-based authentication.
     * Unauthenticated — does not require an API key.
     */
    challenge: (did: string): Promise<ChallengeResponse> =>
      this.request<ChallengeResponse>(
        'POST',
        '/v1/auth/challenge',
        { did },
        false,
      ),

    /**
     * Verify a signed challenge nonce and receive a bearer token.
     * Unauthenticated — does not require an API key.
     */
    verify: (req: VerifyRequest): Promise<VerifyResponse> =>
      this.request<VerifyResponse>('POST', '/v1/auth/verify', req, false),
  };

  // ---------------------------------------------------------------------------
  // mail namespace
  // ---------------------------------------------------------------------------

  readonly mail = {
    /**
     * List messages in the agent's mailbox.
     * Supports optional filtering by mailboxId, limit, position cursor, and sort order.
     */
    list: (opts?: ListMailOptions): Promise<ListMailResponse> => {
      const params = new URLSearchParams();
      if (opts?.mailboxId !== undefined) params.set('mailboxId', opts.mailboxId);
      if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
      if (opts?.position !== undefined) params.set('position', String(opts.position));
      if (opts?.sort !== undefined) params.set('sort', opts.sort);
      const qs = params.toString();
      return this.request<ListMailResponse>('GET', `/v1/mail${qs ? `?${qs}` : ''}`);
    },

    /** Fetch a single message including its full HTML/text body. */
    get: (id: string): Promise<EmailWithBody> =>
      this.request<EmailWithBody>('GET', `/v1/mail/${encodeURIComponent(id)}`),

    /** Send an email from the authenticated agent's address. */
    send: (req: SendMailRequest): Promise<SendMailResponse> =>
      this.request<SendMailResponse>('POST', '/v1/mail/send', req),

    /** Delete a message (moves it to Trash). */
    delete: (id: string): Promise<void> =>
      this.request<void>('DELETE', `/v1/mail/${encodeURIComponent(id)}`),

    /** Move a message to a different mailbox. */
    move: (id: string, mailboxId: string): Promise<void> =>
      this.request<void>('PATCH', `/v1/mail/${encodeURIComponent(id)}/move`, {
        mailboxId,
      }),

    /**
     * Update flags on a message.
     * Pass `seen: true` to mark as read, `flagged: true` to star, etc.
     */
    setFlags: (
      id: string,
      flags: { seen?: boolean; flagged?: boolean },
    ): Promise<void> =>
      this.request<void>(
        'PATCH',
        `/v1/mail/${encodeURIComponent(id)}/flags`,
        flags,
      ),
  };

  // ---------------------------------------------------------------------------
  // mailboxes namespace
  // ---------------------------------------------------------------------------

  readonly mailboxes = {
    /** List all mailboxes (folders) for the authenticated agent. */
    list: (): Promise<Mailbox[]> =>
      this.request<Mailbox[]>('GET', '/v1/mailboxes'),

    /** Create a new mailbox (folder), optionally nested under a parent. */
    create: (req: CreateMailboxRequest): Promise<Mailbox> =>
      this.request<Mailbox>('POST', '/v1/mailboxes', req),

    /** Permanently delete a mailbox and all messages it contains. */
    delete: (id: string): Promise<void> =>
      this.request<void>('DELETE', `/v1/mailboxes/${encodeURIComponent(id)}`),

    /** Rename an existing mailbox. */
    rename: (id: string, name: string): Promise<void> =>
      this.request<void>('PATCH', `/v1/mailboxes/${encodeURIComponent(id)}`, {
        name,
      }),
  };

  // ---------------------------------------------------------------------------
  // billing namespace
  // ---------------------------------------------------------------------------

  readonly billing = {
    /**
     * Get the agent's balance, deposit addresses, and pricing.
     * Creates deposit addresses on first call if billing is configured.
     */
    get: (): Promise<BillingInfo> =>
      this.request<BillingInfo>('GET', '/v1/billing'),

    /**
     * List balance transactions (deposits and deductions), newest first.
     */
    transactions: (
      opts?: ListTransactionsOptions,
    ): Promise<ListTransactionsResponse> => {
      const params = new URLSearchParams();
      if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
      if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
      const qs = params.toString();
      return this.request<ListTransactionsResponse>(
        'GET',
        `/v1/billing/transactions${qs ? `?${qs}` : ''}`,
      );
    },
  };

  // ---------------------------------------------------------------------------
  // health namespace
  // ---------------------------------------------------------------------------

  readonly health = {
    /**
     * Liveness check — returns 200 when the service is running.
     * Does not require authentication.
     */
    check: (): Promise<HealthResponse> =>
      this.request<HealthResponse>('GET', '/health', undefined, false),

    /**
     * Readiness check — returns 200 when all dependencies are healthy.
     * Does not require authentication.
     */
    ready: (): Promise<HealthResponse> =>
      this.request<HealthResponse>('GET', '/health/ready', undefined, false),
  };

  // ---------------------------------------------------------------------------
  // webhooks namespace — inbound mail notifications
  // ---------------------------------------------------------------------------

  readonly webhooks = {
    /**
     * Subscribe a URL to this agent's inbound mail.
     *
     * The response contains `secret`, shown **once** — store it, and verify
     * every notification with `verifyWebhookSignature()` before acting on it.
     *
     * `scope: 'domain'` currently returns HTTP 501; see the type docs.
     */
    create: (req: CreateWebhookEndpointRequest): Promise<CreateWebhookEndpointResponse> =>
      this.request<CreateWebhookEndpointResponse>('POST', '/v1/webhook-endpoints/', req),

    /**
     * List this agent's webhook endpoints.
     *
     * Secrets are absent by design — they are returned only at creation.
     * An endpoint disabled by repeated delivery failures carries
     * `disabledAt` and `disabledReason`.
     */
    list: async (): Promise<WebhookEndpoint[]> => {
      const res = await this.request<ListWebhookEndpointsResponse>(
        'GET',
        '/v1/webhook-endpoints/',
      );
      return res.endpoints;
    },

    /** Delete a webhook endpoint. Deliveries stop immediately. */
    delete: (id: string): Promise<void> =>
      this.request<void>('DELETE', `/v1/webhook-endpoints/${encodeURIComponent(id)}`),
  };

  // Expose types used by typed consumers
  declare readonly _types: {
    Agent: Agent;
    ApiKey: ApiKey;
    Email: Email;
    EmailWithBody: EmailWithBody;
    Mailbox: Mailbox;
  };
}
