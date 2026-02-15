import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PROVIDER_SECRET_V1_PREFIX = 'enc:v1:';
const PROVIDER_SECRET_V2_PREFIX = 'enc:v2:';

export type ProviderSecretsKeyring = {
  activeKeyId: string;
  activeKey: Buffer;
  keysById: Map<string, Buffer>;
};

const toBase64Url = (value: Buffer): string =>
  value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const fromBase64Url = (value: string): Buffer => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding =
    normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
};

const deriveKeyBuffer = (rawKey: string): Buffer | null => {
  if (rawKey.length < 32) return null;
  return Buffer.from(rawKey.slice(0, 32), 'utf8');
};

const getDevFallbackKey = (): Buffer =>
  Buffer.from('mailzen-provider-dev-key-32-bytes!!', 'utf8').subarray(0, 32);

const resolveKeyringFromEnv = (): Map<string, Buffer> => {
  const keyring = new Map<string, Buffer>();
  const rawKeyring = String(process.env.PROVIDER_SECRETS_KEYRING || '').trim();
  if (!rawKeyring) return keyring;

  for (const entry of rawKeyring.split(',')) {
    const [rawKeyId, ...rawKeyParts] = entry.split(':');
    const keyId = String(rawKeyId || '').trim();
    const keyMaterial = rawKeyParts.join(':').trim();
    if (!keyId || !keyMaterial) continue;
    const keyBuffer = deriveKeyBuffer(keyMaterial);
    if (!keyBuffer) continue;
    keyring.set(keyId, keyBuffer);
  }
  return keyring;
};

export const resolveProviderSecretsKeyring = (): ProviderSecretsKeyring => {
  const keysById = resolveKeyringFromEnv();
  if (keysById.size === 0) {
    const legacyRawKey =
      process.env.PROVIDER_SECRETS_KEY || process.env.SECRETS_KEY || '';
    const legacyKeyBuffer = deriveKeyBuffer(legacyRawKey);
    if (legacyKeyBuffer) {
      const legacyKeyId = String(
        process.env.PROVIDER_SECRETS_ACTIVE_KEY_ID || 'default',
      ).trim();
      keysById.set(legacyKeyId || 'default', legacyKeyBuffer);
    }
  }

  if (keysById.size === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Provider secrets keyring missing. Set PROVIDER_SECRETS_KEYRING or PROVIDER_SECRETS_KEY/SECRETS_KEY with >=32 chars.',
      );
    }
    keysById.set('dev', getDevFallbackKey());
  }

  const configuredActiveKeyId = String(
    process.env.PROVIDER_SECRETS_ACTIVE_KEY_ID || '',
  ).trim();
  const fallbackActiveKeyId = keysById.keys().next().value as
    | string
    | undefined;
  const activeKeyId = configuredActiveKeyId || fallbackActiveKeyId || 'default';
  const activeKey = keysById.get(activeKeyId);
  if (!activeKey) {
    throw new Error(
      `Active provider secrets key '${activeKeyId}' not found in configured keyring`,
    );
  }
  return {
    activeKeyId,
    activeKey,
    keysById,
  };
};

export const resolveProviderSecretsKey = (): Buffer =>
  resolveProviderSecretsKeyring().activeKey;

export const isEncryptedProviderSecret = (value?: string | null): boolean => {
  if (!value) return false;
  return (
    value.startsWith(PROVIDER_SECRET_V1_PREFIX) ||
    value.startsWith(PROVIDER_SECRET_V2_PREFIX)
  );
};

const resolveEncryptInput = (
  input: Buffer | ProviderSecretsKeyring,
): { keyId: string; key: Buffer } => {
  if (Buffer.isBuffer(input)) {
    return {
      keyId: 'default',
      key: input,
    };
  }
  return {
    keyId: input.activeKeyId,
    key: input.activeKey,
  };
};

const resolveCandidateKeys = (
  input: Buffer | ProviderSecretsKeyring,
): Buffer[] => {
  if (Buffer.isBuffer(input)) return [input];
  const dedupe = new Map<string, Buffer>();
  dedupe.set(input.activeKey.toString('hex'), input.activeKey);
  for (const key of input.keysById.values()) {
    dedupe.set(key.toString('hex'), key);
  }
  return Array.from(dedupe.values());
};

export const encryptProviderSecret = (
  plaintext: string,
  input: Buffer | ProviderSecretsKeyring,
): string => {
  const { keyId, key } = resolveEncryptInput(input);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PROVIDER_SECRET_V2_PREFIX}${keyId}:${toBase64Url(iv)}:${toBase64Url(tag)}:${toBase64Url(encrypted)}`;
};

const decryptWithKey = (input: {
  payload: string;
  key: Buffer;
  prefix: 'v1' | 'v2';
}): string => {
  const parts = input.payload.split(':');
  const [ivRaw, tagRaw, payloadRaw] =
    input.prefix === 'v2' ? parts.slice(1) : parts;
  if (!ivRaw || !tagRaw || !payloadRaw) {
    throw new Error('Invalid provider secret payload');
  }

  const iv = fromBase64Url(ivRaw);
  const tag = fromBase64Url(tagRaw);
  const payload = fromBase64Url(payloadRaw);
  const decipher = createDecipheriv('aes-256-gcm', input.key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString('utf8');
};

export const decryptProviderSecret = (
  ciphertext: string,
  input: Buffer | ProviderSecretsKeyring,
): string => {
  if (!isEncryptedProviderSecret(ciphertext)) return ciphertext;
  const candidateKeys = resolveCandidateKeys(input);

  if (ciphertext.startsWith(PROVIDER_SECRET_V2_PREFIX)) {
    const body = ciphertext.slice(PROVIDER_SECRET_V2_PREFIX.length);
    const [encryptedKeyId] = body.split(':');
    if (!encryptedKeyId) {
      throw new Error('Invalid provider secret payload');
    }
    const preferredKey =
      !Buffer.isBuffer(input) && input.keysById.has(encryptedKeyId)
        ? input.keysById.get(encryptedKeyId)
        : null;
    const orderedKeys = preferredKey
      ? [preferredKey, ...candidateKeys.filter((key) => key !== preferredKey)]
      : candidateKeys;
    for (const candidateKey of orderedKeys) {
      try {
        return decryptWithKey({
          payload: body,
          key: candidateKey,
          prefix: 'v2',
        });
      } catch {
        // Continue trying fallback keys for rotation support.
      }
    }
    throw new Error('Invalid provider secret payload');
  }

  const legacyBody = ciphertext.slice(PROVIDER_SECRET_V1_PREFIX.length);
  for (const candidateKey of candidateKeys) {
    try {
      return decryptWithKey({
        payload: legacyBody,
        key: candidateKey,
        prefix: 'v1',
      });
    } catch {
      // Continue trying fallback keys for rotation support.
    }
  }
  throw new Error('Invalid provider secret payload');
};
