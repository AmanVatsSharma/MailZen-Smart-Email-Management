import { createCipheriv, randomBytes } from 'crypto';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  resolveProviderSecretsKeyring,
  type ProviderSecretsKeyring,
} from './provider-secrets.util';

const toBase64Url = (value: Buffer): string =>
  value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const encryptV1Secret = (plaintext: string, key: Buffer): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${toBase64Url(iv)}:${toBase64Url(tag)}:${toBase64Url(encrypted)}`;
};

describe('provider-secrets.util', () => {
  const envBackup = {
    providerSecretsKey: process.env.PROVIDER_SECRETS_KEY,
    secretsKey: process.env.SECRETS_KEY,
    keyring: process.env.PROVIDER_SECRETS_KEYRING,
    activeKeyId: process.env.PROVIDER_SECRETS_ACTIVE_KEY_ID,
    nodeEnv: process.env.NODE_ENV,
  };

  beforeEach(() => {
    delete process.env.PROVIDER_SECRETS_KEY;
    delete process.env.SECRETS_KEY;
    delete process.env.PROVIDER_SECRETS_KEYRING;
    delete process.env.PROVIDER_SECRETS_ACTIVE_KEY_ID;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.PROVIDER_SECRETS_KEY = envBackup.providerSecretsKey;
    process.env.SECRETS_KEY = envBackup.secretsKey;
    process.env.PROVIDER_SECRETS_KEYRING = envBackup.keyring;
    process.env.PROVIDER_SECRETS_ACTIVE_KEY_ID = envBackup.activeKeyId;
    process.env.NODE_ENV = envBackup.nodeEnv;
  });

  it('encrypts and decrypts secrets using keyring active key id', () => {
    process.env.PROVIDER_SECRETS_KEYRING = [
      'k-old:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'k-new:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ].join(',');
    process.env.PROVIDER_SECRETS_ACTIVE_KEY_ID = 'k-new';

    const keyring = resolveProviderSecretsKeyring();
    const ciphertext = encryptProviderSecret('top-secret-value', keyring);
    const plaintext = decryptProviderSecret(ciphertext, keyring);

    expect(ciphertext.startsWith('enc:v2:k-new:')).toBe(true);
    expect(plaintext).toBe('top-secret-value');
  });

  it('decrypts values encrypted with previous rotation key', () => {
    const oldKeyring: ProviderSecretsKeyring = {
      activeKeyId: 'k-old',
      activeKey: Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'utf8'),
      keysById: new Map([
        ['k-old', Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'utf8')],
      ]),
    };
    const ciphertext = encryptProviderSecret(
      'legacy-rotation-secret',
      oldKeyring,
    );

    process.env.PROVIDER_SECRETS_KEYRING = [
      'k-old:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'k-new:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ].join(',');
    process.env.PROVIDER_SECRETS_ACTIVE_KEY_ID = 'k-new';
    const rotatedKeyring = resolveProviderSecretsKeyring();

    const plaintext = decryptProviderSecret(ciphertext, rotatedKeyring);
    expect(plaintext).toBe('legacy-rotation-secret');
  });

  it('decrypts legacy v1 encrypted values through fallback keys', () => {
    const legacyKey = Buffer.from('cccccccccccccccccccccccccccccccc', 'utf8');
    const ciphertext = encryptV1Secret('legacy-v1-secret', legacyKey);

    process.env.PROVIDER_SECRETS_KEYRING = [
      'k-active:dddddddddddddddddddddddddddddddd',
      'k-legacy:cccccccccccccccccccccccccccccccc',
    ].join(',');
    process.env.PROVIDER_SECRETS_ACTIVE_KEY_ID = 'k-active';
    const keyring = resolveProviderSecretsKeyring();

    const plaintext = decryptProviderSecret(ciphertext, keyring);
    expect(plaintext).toBe('legacy-v1-secret');
  });

  it('returns plaintext value unchanged when input is not encrypted', () => {
    const keyring = resolveProviderSecretsKeyring();
    const plaintext = decryptProviderSecret('plain-text-value', keyring);
    expect(plaintext).toBe('plain-text-value');
  });
});
