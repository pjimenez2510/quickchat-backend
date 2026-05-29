import {
  qcipherEncrypt,
  qcipherDecrypt,
  isEncryptedPayload,
  type QCipherPayload,
} from './qcipher.js';

const DEFAULT_TRANSPORT_KEY =
  'quickchat-transport-default-change-me-in-production-32bytes';
const DEFAULT_AT_REST_KEY =
  'quickchat-at-rest-default-change-me-in-production-32-bytes';

function transportKey(): string {
  return process.env['CRYPTO_TRANSPORT_KEY'] ?? DEFAULT_TRANSPORT_KEY;
}

function atRestKey(): string {
  return process.env['CRYPTO_AT_REST_KEY'] ?? DEFAULT_AT_REST_KEY;
}

export function encryptTransport(plaintext: string): QCipherPayload {
  return qcipherEncrypt(plaintext, transportKey());
}

export function decryptTransport(payload: QCipherPayload): string {
  return qcipherDecrypt(payload, transportKey());
}

export function encryptAtRest(plaintext: string): string {
  const payload = qcipherEncrypt(plaintext, atRestKey());
  return JSON.stringify(payload);
}

export function decryptAtRest(stored: string | null): string | null {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!isEncryptedPayload(parsed)) return stored;
    return qcipherDecrypt(parsed, atRestKey());
  } catch {
    return stored;
  }
}

export { isEncryptedPayload };
