// src/common/crypto/signature.util.ts
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../logger/logger.service';

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
    // logger.debug('message', {
    //   message: message.toString('utf-8'),
    //   secret: secret,
    //   signatureHex: signatureHex,
    // });

    const rawMessage = message.toString('utf-8');
    const expected = createHmac('sha256', secret).update(message).digest();
    const expectedHex = expected.toString('hex');
    const provided = Buffer.from(signatureHex || '', 'hex');

    // logger.debug('Signature', {
    //   rawMessage,
    //   providedSignature: signatureHex,
    //   expectedSignature: expectedHex,
    //   secretLength: secret?.length ?? 0,
    //   expectedByteLength: expected.length,
    //   providedByteLength: provided.length,
    // });

    if (expected.length !== provided.length) {
      logger.warn(
        `Signature length mismatch! Expected ${expected.length} bytes, got ${provided.length} bytes`,
      );
      return false;
    }

    const isValid = timingSafeEqual(expected, provided);

    if (!isValid) {
      logger.warn(
        `Signature hash mismatch! Provided: ${signatureHex} | Expected: ${expectedHex}`,
      );
    } else {
      logger.debug(`HMAC verification successful`);
    }

    return isValid;
  } catch (error: any) {
    logger.error(
      `Error during HMAC verification: ${error.message}`,
      error.stack,
    );
    return false;
  }
}

/**
 * Build user signed message
 * @param appId
 * @param timestamp
 * @param projectId
 * @param userId
 * @returns
 */
export function buildUserSignedMessage(
  appId: string,
  timestamp: string,
  projectId: string,
  userId: string,
): Buffer {
  return Buffer.from(`${appId}.${timestamp}.${projectId}.${userId}`);
}

/**
 * Verifies an incoming user HMAC-SHA256 signature against a secret.
 */

export function verifyUserHmacSignature(
  projectId: string,
  timestamp: string,
  appId: string,
  userId: string,
  signatureHex: string,
  secret: string,
): boolean {
  try {
    const message = buildUserSignedMessage(appId, timestamp, projectId, userId);

    const expectedBuffer = createHmac('sha256', secret)
      .update(message)
      .digest();
    const expectedHex = expectedBuffer.toString('hex');

    // Normalize signature format (lowercase)
    const normalizedProvidedHex = signatureHex?.trim().toLowerCase() || '';
    const providedBuffer = Buffer.from(normalizedProvidedHex, 'hex');

    // logger.debug(
    //   `[HMAC USER Debug] Inputs: ${JSON.stringify({ projectId, timestamp, appId, userId })}`,
    // );
    // logger.debug(`[HMAC USER Debug] Constructed Message Payload: "${message}"`);
    // logger.debug(`[HMAC USER Debug] Expected Hex: ${expectedHex}`);
    // logger.debug(`[HMAC USER Debug] Provided Hex: ${normalizedProvidedHex}`);

    // Buffer length check
    if (expectedBuffer.length !== providedBuffer.length) {
      logger.warn(
        `[HMAC Failed] Buffer length mismatch. Expected ${expectedBuffer.length} bytes, got ${providedBuffer.length} bytes (provided length: ${signatureHex?.length ?? 0}).`,
      );
      return false;
    }

    const isValid = timingSafeEqual(expectedBuffer, providedBuffer);

    if (!isValid) {
      logger.warn(
        `[HMAC Failed] Signatures do not match for userId: ${userId}`,
      );
    } else {
      logger.debug(`[HMAC Success] Signature verified for userId: ${userId}`);
    }

    return isValid;
  } catch (error) {
    logger.error(
      `[HMAC Error] Exception during signature verification: ${error instanceof Error ? error.message : error}`,
      error instanceof Error ? error.stack : undefined,
    );
    return false;
  }
}
