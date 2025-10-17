type SecurePayload = {
  __secure: true;
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

type StoredValue = SecurePayload | null | undefined | string | number | boolean | object;

import * as lootFs from '../fs';

const SENSITIVE_KEYS = new Set([
  'user-token',
  'user-id',
  'user-key',
  'encrypt-key',
  'encrypt-keys',
  'syncServerConfig',
]);

const isNodeEnv =
  typeof process !== 'undefined' && !!process.versions && !!process.versions.node;

let nodeKeyPromise: Promise<Buffer> | null = null;
let webKeyPromise: Promise<CryptoKey> | null = null;

const NODE_KEY_FILENAME = 'secure-store.key';
const WEB_KEY_STORAGE = '__actual_secure_key__';

let nodeFs: typeof import('fs/promises') | null = null;
let nodePath: typeof import('path') | null = null;

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');
}

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  }
  const binary = typeof atob === 'function' ? atob(value) : Buffer.from(value, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function ensureNodeKey(): Promise<Buffer> {
  if (nodeKeyPromise) {
    return nodeKeyPromise;
  }

  nodeKeyPromise = (async () => {
    nodeFs = nodeFs ?? (await import('fs/promises'));
    nodePath = nodePath ?? (await import('path'));

    const dataDir = lootFs.getDataDir() as string;
    if (!dataDir) {
      throw new Error('ACTUAL_DATA_DIR must be set to use secure storage');
    }

    const keyPath = nodePath.join(dataDir, NODE_KEY_FILENAME);
    try {
      const existing = await nodeFs.readFile(keyPath);
      if (existing.length === 32) {
        return existing;
      }
    } catch (error) {
      // ignore and regenerate below
    }

    const crypto = await import('crypto');
    const key = crypto.randomBytes(32);
    await nodeFs.mkdir(nodePath.dirname(keyPath), { recursive: true });
    await nodeFs.writeFile(keyPath, key);
    return key;
  })();

  return nodeKeyPromise;
}

async function ensureWebKey(): Promise<CryptoKey> {
  if (webKeyPromise) {
    return webKeyPromise;
  }

  webKeyPromise = (async () => {
    const globalObj = globalThis as typeof globalThis & { localStorage?: Storage };
    const storage = globalObj.localStorage;
    let rawKey: Uint8Array;

    if (storage) {
      const stored = storage.getItem(WEB_KEY_STORAGE);
      if (stored) {
        rawKey = fromBase64(stored);
      }
    }

    if (!rawKey) {
      rawKey = new Uint8Array(32);
      globalThis.crypto.getRandomValues(rawKey);
      storage?.setItem(WEB_KEY_STORAGE, toBase64(rawKey));
    }

    return await globalThis.crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
  })();

  return webKeyPromise;
}

function isSecurePayload(value: unknown): value is SecurePayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__secure' in value &&
    (value as SecurePayload).__secure === true
  );
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key);
}

async function encryptNode(value: string): Promise<SecurePayload> {
  const crypto = await import('crypto');
  const iv = crypto.randomBytes(12);
  const key = await ensureNodeKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    __secure: true,
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

async function decryptNode(payload: SecurePayload): Promise<string> {
  const crypto = await import('crypto');
  const key = await ensureNodeKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

async function encryptWeb(value: string): Promise<SecurePayload> {
  const key = await ensureWebKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );
  const bytes = new Uint8Array(encrypted);
  const tag = bytes.slice(bytes.length - 16);
  const data = bytes.slice(0, bytes.length - 16);
  return {
    __secure: true,
    v: 1,
    iv: toBase64(iv),
    tag: toBase64(tag),
    data: toBase64(data),
  };
}

async function decryptWeb(payload: SecurePayload): Promise<string> {
  const key = await ensureWebKey();
  const iv = fromBase64(payload.iv);
  const tag = fromBase64(payload.tag);
  const data = fromBase64(payload.data);
  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data);
  combined.set(tag, data.length);
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    combined,
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptValue(value: unknown): Promise<SecurePayload> {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  return isNodeEnv ? encryptNode(raw) : encryptWeb(raw);
}

async function decryptValue(payload: SecurePayload) {
  const decrypted = isNodeEnv ? await decryptNode(payload) : await decryptWeb(payload);
  try {
    return JSON.parse(decrypted);
  } catch (error) {
    return decrypted;
  }
}

export async function prepareForStorage(
  key: string,
  value: StoredValue,
): Promise<StoredValue> {
  if (!isSensitiveKey(key) || value == null) {
    return value;
  }

  if (isSecurePayload(value)) {
    return value;
  }

  return encryptValue(value);
}

export async function readFromStorage(
  key: string,
  value: StoredValue,
): Promise<StoredValue> {
  if (!isSensitiveKey(key) || value == null) {
    return value;
  }

  if (!isSecurePayload(value)) {
    return value;
  }

  return decryptValue(value);
}

export type { SecurePayload };
