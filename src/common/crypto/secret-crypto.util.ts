// // src/common/crypto/secret-crypto.util.ts
// import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// const ALGO = 'aes-256-gcm';

// function getSecretKey(): Buffer {
//   const key = process.env.SECRET_ENCRYPTION_KEY;
//   if (!key) {
//     throw new Error('SECRET_ENCRYPTION_KEY is not defined');
//   }
//   return Buffer.from(key, 'hex');
// }

// export function encryptSecret(plain: string): string {
//   const iv = randomBytes(12);
//   const cipher = createCipheriv(ALGO, getSecretKey(), iv);
//   const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
//   const tag = cipher.getAuthTag();
//   return Buffer.concat([iv, tag, enc]).toString('base64'); // store this in secret_key
// }

// export function decryptSecret(encryptedData: string): string {
//   try {
//     if (!encryptedData) return '';

//     // If the database secret isn't in iv:authTag:ciphertext format, return as plaintext
//     if (!encryptedData.includes(':')) {
//       return encryptedData;
//     }

//     const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');

//     if (!ivHex || !authTagHex || !encryptedHex) {
//       return encryptedData; // Fallback to raw string
//     }

//     const key = getSecretKey(); // 32-byte Buffer
//     const iv = Buffer.from(ivHex, 'hex');
//     const authTag = Buffer.from(authTagHex, 'hex');
//     const decipher = createDecipheriv('aes-256-gcm', key, iv);

//     decipher.setAuthTag(authTag);

//     let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
//     decrypted += decipher.final('utf8');

//     return decrypted;
//   } catch (error: any) {
//     console.warn(
//       `[Crypto] Decryption failed for secret. Falling back to raw value. Reason: ${error.message}`,
//     );
//     // Return raw string so unencrypted/differently-keyed DB records don't crash WS auth
//     return encryptedData;
//   }
// }
