export { AgentMailboxClient } from './client.js';
export type { ClientOptions } from './client.js';

export {
  verifyWebhookSignature,
  signWebhookPayload,
} from './webhooks.js';
export type {
  VerifyWebhookOptions,
  VerifyWebhookResult,
} from './webhooks.js';

export {
  AgentMailboxError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  PaymentRequiredError,
  UnauthorizedError,
} from './errors.js';

export type {
  Agent,
  ApiKey,
  BalanceTransaction,
  BillingInfo,
  BillingNotice,
  DepositAddresses,
  PaymentRequiredDetails,
  Prices,
  StandingStatus,
  TopupResponse,
  Wallet,
  ListTransactionsOptions,
  ListTransactionsResponse,
  ChallengeResponse,
  JmapBodyPart,
  JmapBodyValue,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  CreateMailboxRequest,
  Email,
  EmailAddress,
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
  CreateWebhookEndpointRequest,
  CreateWebhookEndpointResponse,
  ListWebhookEndpointsResponse,
  WebhookEndpoint,
  WebhookDelivery,
  ListWebhookDeliveriesResponse,
  InboundMailNotification,
} from './types.js';
