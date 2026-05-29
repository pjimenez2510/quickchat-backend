/**
 * QCipher — cifrado simétrico didáctico con clave variable.
 *
 * Construcción: stream cipher de un solo paso por byte usando
 * un estado interno de 5 registros, una S-box determinista,
 * rotaciones de bits, XOR, multiplicación modular y dependencia
 * del índice del byte.
 *
 * NO usar en producción real — apto para fines académicos.
 */

const SBOX: number[] = (() => {
  const s = new Array<number>(256);
  const used = new Array<boolean>(256).fill(false);
  let x = 1;
  for (let i = 0; i < 256; i++) {
    while (used[x]) x = (x + 1) & 0xff;
    s[i] = x;
    used[x] = true;
    x = ((x * 3) ^ (x >> 1)) & 0xff;
  }
  return s;
})();

function rotl(b: number, n: number): number {
  return ((b << n) | (b >> (8 - n))) & 0xff;
}

function processBytes(
  input: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(input.length);

  let s0 = 0;
  for (let i = 0; i < key.length; i++) s0 = (s0 + key[i]!) & 0xff;

  let s1 = (iv[0] ?? 0) ^ (iv[4] ?? 0);
  let s2 = (iv[1] ?? 0) ^ (iv[5] ?? 0);
  let s3 = (iv[2] ?? 0) ^ (iv[6] ?? 0);
  let s4 = (iv[3] ?? 0) ^ (iv[7] ?? 0);

  const kl = key.length || 1;

  for (let i = 0; i < input.length; i++) {
    const kb = key[i % kl] ?? 0;
    s0 = (s0 + kb + (i & 0xff)) & 0xff;
    s1 = (s1 ^ rotl(s0, 3)) & 0xff;
    s2 = (s2 * 17 + s1 + 7) & 0xff;
    s3 = SBOX[(s2 + kb) & 0xff]!;
    s4 = (s4 + s3) & 0xff;
    const ks = (s1 ^ s2 ^ s3 ^ s4) & 0xff;
    out[i] = (input[i]! ^ ks) & 0xff;
  }
  return out;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

function toBase64(b: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(b).toString('base64');
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]!);
  return btoa(bin);
}

function fromBase64(s: string): Uint8Array {
  if (typeof Buffer !== 'undefined')
    return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface QCipherPayload {
  v: 1;
  iv: string;
  ct: string;
}

export function qcipherEncrypt(plaintext: string, key: string): QCipherPayload {
  const iv = randomBytes(8);
  const ct = processBytes(enc.encode(plaintext), enc.encode(key), iv);
  return { v: 1, iv: toBase64(iv), ct: toBase64(ct) };
}

export function qcipherDecrypt(payload: QCipherPayload, key: string): string {
  const iv = fromBase64(payload.iv);
  const ct = fromBase64(payload.ct);
  const pt = processBytes(ct, enc.encode(key), iv);
  return dec.decode(pt);
}

export function isEncryptedPayload(x: unknown): x is QCipherPayload {
  if (x === null || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o['v'] === 1 && typeof o['iv'] === 'string' && typeof o['ct'] === 'string';
}

export function serializePayload(p: QCipherPayload): string {
  return JSON.stringify(p);
}

export function deserializePayload(s: string): QCipherPayload | null {
  try {
    const parsed = JSON.parse(s) as unknown;
    return isEncryptedPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
