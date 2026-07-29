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

  // Match backend buildSignedMessage: `${appId}.${timestamp}`
  const payloadToSign = `${appId}.${timestamp}`;
  const signature = await generateHmacSha256(payloadToSign, appSecret);

  return {
    appId,
    timestamp,
    signature,
  };
}

// 2. Admin Connection Payload Signer
export async function buildAdminSignedAuth(
  adminAppId: string,
  adminSecret: string,
): Promise<AuthPayload> {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Admin also uses `${appId}.${timestamp}` on backend
  const payloadToSign = `${adminAppId}.${timestamp}`;
  const signature = await generateHmacSha256(payloadToSign, adminSecret);

  return {
    appId: adminAppId,
    timestamp,
    signature,
  };
}
