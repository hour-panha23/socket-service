// src/common/crypto/signature.util.ts
import { createHmac, timingSafeEqual } from 'crypto';

const MAX_CLOCK_SKEW_SECONDS = 60;

export function isTimestampFresh(timestamp: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSeconds = Date.now() / 1000;
  return Math.abs(nowSeconds - ts) <= MAX_CLOCK_SKEW_SECONDS;
}

export function buildSignedMessage(appId: string, timestamp: string): Buffer {
  return Buffer.from(`${appId}.${timestamp}`);
}

/**
 * Generates an HMAC-SHA256 signature for outgoing requests/webhooks.
 */
export function generateHmacSignature(message: Buffer, secret: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Verifies an incoming HMAC-SHA256 signature against a secret.
 */
export function verifyHmacSignature(
  message: Buffer,
  signatureHex: string,
  secret: string,
): boolean {
  try {
    const expected = createHmac('sha256', secret).update(message).digest();
    const provided = Buffer.from(signatureHex, 'hex');

    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
