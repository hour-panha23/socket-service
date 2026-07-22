import { ed25519 } from "@noble/curves/ed25519.js";

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extracts 32-byte raw seed from PKCS#8 Ed25519 key.
 * Standard Node/OpenSSL PKCS#8 DER structure:
 * 0x30, 0x2e, 0x02, 0x01, 0x00, ... [0x04, 0x20, <32-byte-seed>]
 */
function extractRawPrivateKey(pkcs8Pem: string): Uint8Array {
  const der = pemToBytes(pkcs8Pem);

  // Search for DER Octet String header for 32 bytes (0x04, 0x20)
  for (let i = 0; i < der.length - 33; i++) {
    if (der[i] === 0x04 && der[i + 1] === 0x20) {
      return der.slice(i + 2, i + 34);
    }
  }

  // Fallback to last 32 bytes if pattern isn't strictly found
  return der.slice(der.length - 32);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function buildSignedAuth(appId: string, privateKeyPem: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawKey = extractRawPrivateKey(privateKeyPem);
  const message = new TextEncoder().encode(`${appId}.${timestamp}`);

  // Use ed25519 directly (no extra hash setup needed)
  const signatureBytes = ed25519.sign(message, rawKey);

  return {
    app_id: appId,
    timestamp,
    signature: bytesToBase64(signatureBytes),
  };
}

export async function buildAdminSignedAuth(appId: string, secret: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${appId}.${timestamp}`),
  );
  const signature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { app_id: appId, timestamp, signature };
}
