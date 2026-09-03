/**
 * Verifying inbound webhook notifications.
 *
 * Every integrator has to check that a notification really came from Mailgi
 * before acting on it. Getting that check subtly wrong is easy and the failure
 * is silent — a signature compared over the parsed-and-restringified body, or
 * compared with `===`, looks correct and isn't. So the SDK ships the check
 * rather than documenting it and hoping.
 *
 * Deliberately uses Web Crypto rather than `node:crypto`: the rest of this
 * package has no Node built-in imports, so it runs unchanged on edge runtimes
 * and in browsers. Web Crypto is global from Node 18 (this package's minimum),
 * which is why the function is async.
 */

const encoder = new TextEncoder();

export interface VerifyWebhookOptions {
  /**
   * The **raw** request body, exactly as received.
   *
   * Not a parsed object, and not `JSON.stringify(parsed)` — re-serialising
   * changes bytes (key order, whitespace, unicode escapes) and the signature
   * will not match. Read the body as text before parsing it.
   */
  body: string;
  /** The `x-mailgi-signature` header. */
  signature: string;
  /** The `x-mailgi-timestamp` header (unix seconds). */
  timestamp: string | number;
  /** The `secret` returned once from `webhooks.create()`. */
  secret: string;
  /**
   * Reject notifications older than this, in seconds. Defaults to 300 (5
   * minutes). The timestamp is signed alongside the body, so this is what
   * stops a captured request being replayed later. Pass `0` to skip the check.
   */
  toleranceSeconds?: number;
}

export type VerifyWebhookResult =
  | { valid: true }
  | { valid: false; reason: 'malformed-timestamp' | 'timestamp-outside-tolerance' | 'signature-mismatch' };

/**
 * Constant-time string comparison.
 *
 * A plain `===` short-circuits on the first differing character, which leaks
 * how much of a forged signature was correct. Both inputs here are hex of a
 * fixed length, so comparing every character costs nothing.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes the expected signature for a payload. Exposed mainly for tests and
 * for building signed fixtures; use {@link verifyWebhookSignature} to check an
 * incoming request.
 */
export async function signWebhookPayload(
  body: string,
  secret: string,
  timestamp: string | number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  // The timestamp is part of the signed content, not just a header, which is
  // what makes the replay check above meaningful.
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
  return toHex(signed);
}

/**
 * Verifies an inbound webhook notification.
 *
 * ```ts
 * const raw = await request.text();
 * const result = await verifyWebhookSignature({
 *   body: raw,
 *   signature: request.headers.get('x-mailgi-signature')!,
 *   timestamp: request.headers.get('x-mailgi-timestamp')!,
 *   secret: process.env.MAILGI_WEBHOOK_SECRET!,
 * });
 * if (!result.valid) return new Response(result.reason, { status: 401 });
 *
 * const notification: InboundMailNotification = JSON.parse(raw);
 * ```
 *
 * Returns a reason on failure rather than throwing, so a handler can log why
 * it rejected something without a try/catch.
 */
export async function verifyWebhookSignature(
  options: VerifyWebhookOptions,
): Promise<VerifyWebhookResult> {
  const { body, signature, timestamp, secret, toleranceSeconds = 300 } = options;

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) {
    return { valid: false, reason: 'malformed-timestamp' };
  }

  if (toleranceSeconds > 0) {
    const skew = Math.abs(Date.now() / 1000 - seconds);
    if (skew > toleranceSeconds) {
      return { valid: false, reason: 'timestamp-outside-tolerance' };
    }
  }

  const expected = await signWebhookPayload(body, secret, timestamp);
  if (!timingSafeEqual(expected, signature)) {
    return { valid: false, reason: 'signature-mismatch' };
  }

  return { valid: true };
}
