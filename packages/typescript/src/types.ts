// --- Registration ---
export interface RegisterAgentRequest {
  did?: string;             // Optional W3C DID (did:key: format)
  label?: string;
}

export interface RegisterAgentResponse {
  agentId: string;
  did?: string;             // Only present if DID was provided at registration
  emailAddress: string;     // Friendly handle address (e.g. bubbling-dolphin@mailgi.xyz)
  aliasAddress: string;     // Opaque deterministic alias (e.g. x7k3mwf2qr5b@mailgi.xyz)
  apiKey: string;           // Raw key, shown once — store it securely
  apiKeyId: string;
}

// --- Agent ---
export interface Agent {
  agentId: string;
  did?: string;
  emailAddress: string;
  aliasAddress: string;
  label: string;
  createdAt: string;
}

// --- API Keys ---
export interface ApiKey {
  id: string;
  keyPrefix: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface CreateApiKeyRequest {
  label?: string;
  expiresAt?: string;       // ISO date string
}

export interface CreateApiKeyResponse extends ApiKey {
  apiKey: string;           // Raw key, shown once — store it securely
  apiKeyId: string;
}

// --- Auth ---
export interface ChallengeResponse {
  nonce: string;
  expiresAt: string;
}

export interface VerifyRequest {
  did: string;
  nonce: string;
  signature: string;        // base64url Ed25519 signature over nonce
}

export interface VerifyResponse {
  token: string;
  expiresIn: number;
}

// --- Mail ---
export interface EmailAddress {
  name?: string;
  email: string;
}

export interface Email {
  id: string;
  subject: string;
  from: EmailAddress[];
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  receivedAt: string;
  size: number;
  preview: string;
  seen: boolean;            // true when $seen keyword is set
  mailboxIds: Record<string, boolean>;
  keywords: Record<string, boolean>;
}

export interface JmapBodyPart {
  partId?: string;
  blobId?: string;
  size?: number;
  type?: string;
  charset?: string;
}

export interface JmapBodyValue {
  value: string;
  isEncodingProblem?: boolean;
  isTruncated?: boolean;
}

export interface EmailWithBody extends Email {
  htmlBody?: string | JmapBodyPart[];
  textBody?: string | JmapBodyPart[];
  /** JMAP body part map: partId → body value */
  bodyValues?: Record<string, JmapBodyValue>;
}

export interface ListMailOptions {
  mailboxId?: string;
  limit?: number;
  position?: number;
  sort?: 'asc' | 'desc';
}

export interface ListMailResponse {
  messages: Email[];
  total: number;
  position: number;
}

export interface SendMailRequest {
  to: string | string[];    // Single address or array
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  replyTo?: string;
}

export interface SendMailResponse {
  messageId: string;
}

// --- Mailboxes ---
export interface Mailbox {
  id: string;
  name: string;
  parentId: string | null;
  role: string | null;
  totalEmails: number;
  unreadEmails: number;
}

export interface CreateMailboxRequest {
  name: string;
  parentId?: string;
}

// --- Health ---
export interface HealthResponse {
  status: 'ok' | 'degraded';
  checks?: {
    database: 'ok' | 'error';
    stalwart: 'ok' | 'error';
  };
}

// --- Billing ---
export interface DepositAddresses {
  evm: string;
  solana: string;
}

export interface BillingInfo {
  balanceUsd: number;
  depositAddresses: DepositAddresses | null;
  pricePerExternalEmail: number;
  acceptedToken: string;
  networks: {
    evm: string[];
    solana: string[];
  };
}

export interface BalanceTransaction {
  id: string;
  type: 'deposit' | 'deduction';
  amountUsd: number;
  txHash: string | null;
  chain: string | null;
  emailCount: number | null;
  createdAt: string;
}

export interface ListTransactionsOptions {
  limit?: number;
  offset?: number;
}

export interface ListTransactionsResponse {
  transactions: BalanceTransaction[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Inbound mail webhooks
// ---------------------------------------------------------------------------

export interface CreateWebhookEndpointRequest {
  /** HTTPS URL that notifications are POSTed to. Private, loopback and
   *  link-local addresses are rejected at creation time. */
  url: string;
  /**
   * Defaults to `'agent'` — notifications for this agent's mailbox only.
   *
   * `'domain'` (every agent on the domain, for org admins) currently returns
   * HTTP 501: it discloses mail metadata for mailboxes the caller does not
   * own, which requires a privacy-policy change first.
   */
  scope?: 'agent' | 'domain';
  /** Defaults to `['mail.received']`, which is the only event today. */
  eventTypes?: string[];
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  eventTypes: string[];
  enabled: boolean;
  /** Set when repeated delivery failures disabled the endpoint. */
  disabledAt?: string | null;
  disabledReason?: string | null;
  createdAt: string;
}

export interface CreateWebhookEndpointResponse extends WebhookEndpoint {
  /**
   * Signing secret for verifying `x-mailgi-signature`.
   *
   * Returned **once**, at creation, the same contract as an API key. It is
   * absent from `webhooks.list()` and cannot be retrieved later.
   */
  secret: string;
}

export interface ListWebhookEndpointsResponse {
  endpoints: WebhookEndpoint[];
}

export interface WebhookAttachment {
  name: string | null;
  size: number | null;
  type: string | null;
}

/**
 * The body Mailgi POSTs to a webhook endpoint when mail arrives.
 *
 * Envelope fields are always present. `subject`, `preview`, `attachments` and
 * `fetchUrl` come from a message-enrichment step that **fails soft**, so treat
 * them as optional rather than assuming they are populated.
 */
export interface InboundMailNotification {
  event: 'mail.received';
  agentId: string;
  /** RFC Message-ID, unbracketed. */
  messageId: string | null;
  from: string | null;
  to: string[];
  receivedAt: string;
  subject: string | null;
  /** Short plain-text snippet. Never the full body. */
  preview: string | null;
  attachments: WebhookAttachment[];
  /** Absolute URL for fetching the full message, or null if enrichment failed. */
  fetchUrl: string | null;
}

export interface WebhookDelivery {
  id: string;
  /** The Stalwart ingest event this delivery came from. */
  stalwartEventId: string;
  agentId: string;
  status: string;
  /** Reset to 0 by a manual resend, so a fixed endpoint gets a full budget. */
  attempts: number;
  nextAttemptAt: string | null;
  lastResponseCode: number | null;
  /** Truncated excerpt of the endpoint's response body. */
  lastResponseBody: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListWebhookDeliveriesResponse {
  deliveries: WebhookDelivery[];
}
