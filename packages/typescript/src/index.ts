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
  UnauthorizedError,
} from './errors.js';

export type {
  Agent,
  ApiKey,
  BalanceTransaction,
  BillingInfo,
  DepositAddresses,
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
  WebhookAttachment,
  InboundMailNotification,
} from './types.js';
