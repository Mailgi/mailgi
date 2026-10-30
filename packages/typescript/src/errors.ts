import type { PaymentRequiredDetails } from './types.js';

export class AgentMailboxError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    /** The API's `error.details`, when it sent any. */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AgentMailboxError';
  }
}

export class NotFoundError extends AgentMailboxError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AgentMailboxError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends AgentMailboxError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class BadRequestError extends AgentMailboxError {
  constructor(message = 'Bad request') {
    super(message, 400, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

/**
 * 402: the wallet cannot pay. Either a send it cannot cover (nothing was
 * sent), or (`details.reason === 'debt_limit'`) its debt is past the limit and
 * reading is paused. Forward `details.topupPage` to whoever pays, then retry.
 */
export class PaymentRequiredError extends AgentMailboxError {
  declare readonly details: PaymentRequiredDetails;
  constructor(message = 'Payment required', details: PaymentRequiredDetails = {}) {
    super(message, 402, 'PAYMENT_REQUIRED', details as Record<string, unknown>);
    this.name = 'PaymentRequiredError';
  }

  /** True when this is the read block, not a refused send. */
  get readsBlocked(): boolean {
    return this.details.reason === 'debt_limit';
  }
}
