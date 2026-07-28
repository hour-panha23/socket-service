// lib/socket-auth.ts

async function generateHmacSha256(
  message: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData,
  );

  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface AuthPayload {
  appId: string;
  timestamp: string;
  signature: string;
}

// 1. App Connection Payload Signer
export async function buildSignedAuth(
  appId: string,
  appSecret: string,
): Promise<AuthPayload> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10);

  // Payload format: mode:appId:timestamp:nonce
  const payloadToSign = `app:${appId}:${timestamp}:${nonce}`;
  const signature = await generateHmacSha256(payloadToSign, appSecret);

  return {
    appId,
    timestamp,
    signature,
  };
}

// 2. Admin Connection Payload Signer (Fixed: Removed raw adminSecret leaks)
export async function buildAdminSignedAuth(
  appId: string,
  adminSecret: string,
): Promise<AuthPayload> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10);

  // Payload format: mode:appId:timestamp:nonce
  const payloadToSign = `admin:${appId}:${timestamp}:${nonce}`;
  const signature = await generateHmacSha256(payloadToSign, adminSecret);

  return {
    appId,
    timestamp,
    signature,
  };
}
