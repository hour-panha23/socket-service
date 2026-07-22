// src/common/crypto/signature.util.ts
import { createHmac, verify as edVerify, timingSafeEqual } from 'crypto';

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

// Admin: single shared secret from env (HMAC-SHA256, same scheme as the bank API doc)
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

// Regular apps: Ed25519, verified against the app's stored public key
export function verifyEd25519Signature(
  message: Buffer,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    return edVerify(
      null,
      message,
      publicKeyPem,
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch {
    return false;
  }
}
