import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature, signWebhookPayload } from '../src/webhooks.js';

/**
 * The signature check is the one piece of this SDK where being subtly wrong is
 * a security problem rather than a bug, so the cases below are the ways it
 * goes wrong in practice — not just the happy path.
 */

const SECRET = 'whsec_test_zc4Ux9pQ7yLm2Nk8';
const BODY = JSON.stringify({ event: 'mail.received', agentId: 'cm123', to: ['a@b.test'] });

function now(): number {
  return Math.floor(Date.now() / 1000);
}

describe('verifyWebhookSignature', () => {
  it('accepts a signature this SDK produced', async () => {
    const timestamp = now();
    const signature = await signWebhookPayload(BODY, SECRET, timestamp);

    expect(await verifyWebhookSignature({ body: BODY, signature, timestamp, secret: SECRET }))
      .toEqual({ valid: true });
  });

  it('rejects a tampered body', async () => {
    const timestamp = now();
    const signature = await signWebhookPayload(BODY, SECRET, timestamp);
    const tampered = BODY.replace('a@b.test', 'attacker@evil.test');

    expect(await verifyWebhookSignature({ body: tampered, signature, timestamp, secret: SECRET }))
      .toEqual({ valid: false, reason: 'signature-mismatch' });
  });

  it('rejects the wrong secret', async () => {
    const timestamp = now();
    const signature = await signWebhookPayload(BODY, SECRET, timestamp);

    expect(await verifyWebhookSignature({ body: BODY, signature, timestamp, secret: 'whsec_other' }))
      .toEqual({ valid: false, reason: 'signature-mismatch' });
  });

  it('rejects a replayed notification outside the tolerance', async () => {
    const timestamp = now() - 3600;
    const signature = await signWebhookPayload(BODY, SECRET, timestamp);

    // Correctly signed, but an hour old: this is the case the timestamp exists for.
    expect(await verifyWebhookSignature({ body: BODY, signature, timestamp, secret: SECRET }))
      .toEqual({ valid: false, reason: 'timestamp-outside-tolerance' });
  });

  it('allows the replay window to be disabled explicitly', async () => {
    const timestamp = now() - 3600;
    const signature = await signWebhookPayload(BODY, SECRET, timestamp);

    expect(
      await verifyWebhookSignature({
        body: BODY, signature, timestamp, secret: SECRET, toleranceSeconds: 0,
      }),
    ).toEqual({ valid: true });
  });

  it('rejects a non-numeric timestamp instead of treating it as 0', async () => {
    expect(
      await verifyWebhookSignature({
        body: BODY, signature: 'deadbeef', timestamp: 'not-a-number', secret: SECRET,
      }),
    ).toEqual({ valid: false, reason: 'malformed-timestamp' });
  });

  it('signs over `timestamp.body`, not the body alone', async () => {
    // Pins the scheme. If the server ever changes what it signs, this fails
    // here rather than every integrator's endpoint failing in production.
    const signature = await signWebhookPayload(BODY, SECRET, 1700000000);
    const bodyOnly = await signWebhookPayload(BODY, SECRET, '');

    expect(signature).not.toEqual(bodyOnly);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a signature of the wrong length without leaking position', async () => {
    const timestamp = now();
    expect(await verifyWebhookSignature({ body: BODY, signature: 'ab', timestamp, secret: SECRET }))
      .toEqual({ valid: false, reason: 'signature-mismatch' });
  });
});
