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

/**
 * How the wallet is doing (`GET /v1/billing` → `standing`, and the `billing`
 * notice on reads and sends).
 *
 * - `ok`: nothing to do
 * - `low_balance`: below about a week of this wallet's own spend (at least $1)
 * - `in_debt`: negative; mail to outside addresses is refused (402)
 * - `reads_blocked`: an agent wallet more than `lowBalanceUsd` in debt; reads
 *   answer 402 with `reason: "debt_limit"` until topped up. Receiving,
 *   webhooks, deleting and billing keep working.
 */
export type StandingStatus = 'ok' | 'low_balance' | 'in_debt' | 'reads_blocked';

/**
 * Attached to `mail.list()`, `mail.get()` and `mail.send()` results while the
 * wallet needs attention. Absent means the balance is fine. When present,
 * forward `topupPage` to whoever pays for the agent.
 */
export interface BillingNotice {
  status: Exclude<StandingStatus, 'ok'>;
  balanceUsd: number;
  /** About one week of this wallet's spend, never less than $1. */
  lowBalanceUsd: number;
  /** Public top-up page with this agent's address filled in. No login needed to pay. */
  topupPage: string;
  message: string;
}

export interface EmailWithBody extends Email {
  htmlBody?: string | JmapBodyPart[];
  textBody?: string | JmapBodyPart[];
  /** JMAP body part map: partId → body value */
  bodyValues?: Record<string, JmapBodyValue>;
  /** Present only while the wallet needs attention. */
  billing?: BillingNotice;
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
  /** Present only while the wallet needs attention. */
  billing?: BillingNotice;
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
  /** Present when this send left the wallet low or in debt. */
  billing?: BillingNotice;
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
/** Whose money pays: the agent's own wallet, or its organisation's. */
export interface Wallet {
  kind: 'agent' | 'org';
  id: string;
}

export interface Prices {
  /** Per external recipient, every send. */
  outboundEmailUsd: number;
  /** Added once for a recipient that has never written to this agent. */
  introductionUsd: number;
  /** Per GB-month of mailbox storage, billed daily. */
  storageGbMonthUsd: number;
  /** Free storage per mailbox, in bytes. */
  storageFreeBytes: number;
}

export interface BillingInfo {
  wallet: Wallet;
  /** Can be negative (storage charged while empty, or a card refund). */
  balanceUsd: number;
  /** False when this deployment does not charge yet. */
  meteringEnabled: boolean;
  prices: Prices;
  /** External addresses this agent has corresponded with (no introduction fee). */
  knownContacts: number;
  standing: {
    status: StandingStatus;
    lowBalanceUsd: number;
    /** What to do; absent when `ok`. */
    message?: string;
  };
  topup: {
    /** `POST /v1/billing/topup`: see `billing.topup()`. */
    endpoint: string;
    /** Public page, this agent's address filled in; forward it to whoever pays. */
    publicPage: string;
    method: string;
    minAmountUsd: number;
    /** False when card payments are not configured on this deployment. */
    available: boolean;
  };
  /** @deprecated Legacy USDC deposits; null unless crypto billing is configured. */
  depositAddresses?: DepositAddresses | null;
  /** @deprecated Legacy USDC deposits. */
  acceptedToken?: string;
  /** @deprecated Legacy USDC deposits. */
  networks?: { evm: string[]; solana: string[] };
}

/** @deprecated Legacy USDC deposits. */
export interface DepositAddresses {
  evm: string;
  solana: string;
}

export interface TopupResponse {
  /** Stripe Checkout URL. Give it to a human to pay by card; no Mailgi login needed. */
  url: string;
  sessionId: string;
  amountUsd: number;
  wallet: Wallet;
}

export interface BalanceTransaction {
  id: string;
  /** Negative amounts are charges; `deposit` is a top-up; `refund`/`dispute` reverse one. */
  type: 'deposit' | 'deduction' | 'storage' | 'refund' | 'dispute';
  amountUsd: number;
  /** The agent that incurred the charge (org wallets list every agent's). */
  agentId: string | null;
  /** External recipients billed, for `deduction`. */
  emailCount: number | null;
  /** Of those, first-contact recipients. */
  introductionCount: number | null;
  provider: string | null;
  providerRef: string | null;
  /** @deprecated Legacy USDC deposits. */
  txHash: string | null;
  /** @deprecated Legacy USDC deposits. */
  chain: string | null;
  createdAt: string;
}

/** `error.details` of a 402 `PAYMENT_REQUIRED`. */
export interface PaymentRequiredDetails {
  [key: string]: unknown;
  /** `debt_limit` when reading is paused; absent for a send the wallet cannot cover. */
  reason?: 'debt_limit';
  wallet?: Wallet;
  balanceUsd?: number;
  /** The least top-up that makes the request succeed. */
  requiredUsd?: number;
  /** Public top-up page with the agent's address filled in. */
  topupPage?: string;
  /** For `debt_limit`: reads resume at or above this balance. */
  debtLimitUsd?: number;
  /** For a refused send. */
  outboundRecipients?: number;
  unknownRecipients?: string[];
  pricePerOutboundEmailUsd?: number;
  pricePerIntroductionUsd?: number;
  topupEndpoint?: string;
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

/**
 * The body Mailgi POSTs to a webhook endpoint when mail arrives: a thin event.
 *
 * No subject, preview, body or attachment names -- read the message with
 * `mail.get()` (or `fetchUrl` with the API key). That keeps mail content out
 * of your endpoint's logs. `fetchUrl` comes from a lookup that fails soft, so
 * it can be null; everything else is always present.
 */
export interface InboundMailNotification {
  event: 'mail.received';
  agentId: string;
  /** RFC Message-ID, unbracketed. */
  messageId: string | null;
  from: string | null;
  to: string[];
  receivedAt: string;
  size: number | null;
  /** The spam filter flagged it. You are notified either way. */
  spam: boolean;
  /** `GET /v1/mail/<id>` for this message, or null if the lookup failed. */
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
