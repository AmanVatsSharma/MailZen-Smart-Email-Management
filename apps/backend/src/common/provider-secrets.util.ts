import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PROVIDER_SECRET_PREFIX = 'enc:v1:';

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

export const resolveProviderSecretsKey = (): Buffer => {
  const rawKey =
    process.env.PROVIDER_SECRETS_KEY || process.env.SECRETS_KEY || '';

  if (rawKey.length >= 32) {
    return Buffer.from(rawKey.slice(0, 32), 'utf8');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'PROVIDER_SECRETS_KEY (or SECRETS_KEY) must be set with minimum 32 characters in production',
    );
  }

  return Buffer.from('mailzen-provider-dev-key-32-bytes!!', 'utf8').subarray(
    0,
    32,
  );
};

export const isEncryptedProviderSecret = (value?: string | null): boolean =>
  Boolean(value && value.startsWith(PROVIDER_SECRET_PREFIX));

export const encryptProviderSecret = (
  plaintext: string,
  key: Buffer,
): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PROVIDER_SECRET_PREFIX}${toBase64Url(iv)}:${toBase64Url(tag)}:${toBase64Url(encrypted)}`;
};

export const decryptProviderSecret = (
  ciphertext: string,
  key: Buffer,
): string => {
  if (!isEncryptedProviderSecret(ciphertext)) return ciphertext;

  const body = ciphertext.slice(PROVIDER_SECRET_PREFIX.length);
  const [ivRaw, tagRaw, payloadRaw] = body.split(':');
  if (!ivRaw || !tagRaw || !payloadRaw) {
    throw new Error('Invalid provider secret payload');
  }

  const iv = fromBase64Url(ivRaw);
  const tag = fromBase64Url(tagRaw);
  const payload = fromBase64Url(payloadRaw);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString('utf8');
};
