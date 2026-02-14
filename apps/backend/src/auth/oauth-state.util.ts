import crypto from 'crypto';

/**
 * Stateless OAuth `state` protection.
 *
 * Why: OAuth callbacks must validate `state` to prevent CSRF + code injection.
 * Approach: Sign a small JSON payload with HMAC-SHA256, no server-side storage.
 */

export interface OAuthStatePayload {
  nonce: string;
  ts: number; // ms since epoch
  redirect?: string; // optional frontend redirect target
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function hmacSha256(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function getStateSecret(): string {
  // Prefer a dedicated secret; fall back to JWT secret to keep setup simple.
  const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
  if (!secret || secret === 'default-secret') {
    throw new Error(
      'OAuth state secret not configured (set OAUTH_STATE_SECRET or JWT_SECRET)',
    );
  }
  return secret;
}

export function buildOAuthState(redirect?: string): string {
  const payload: OAuthStatePayload = {
    nonce: crypto.randomBytes(16).toString('base64url'),
    ts: Date.now(),
    redirect,
  };
  const json = JSON.stringify(payload);
  const body = base64UrlEncode(json);
  const sig = hmacSha256(body, getStateSecret());
  return `${body}.${sig}`;
}

export function verifyOAuthState(
  state: string,
  maxAgeMs: number,
): OAuthStatePayload {
  if (!state || !state.includes('.')) {
    throw new Error('Missing or malformed OAuth state');
  }
  const [body, sig] = state.split('.', 2);
  if (!body || !sig) throw new Error('Missing or malformed OAuth state');

  const expected = hmacSha256(body, getStateSecret());
  // constant-time compare to avoid timing leaks
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) throw new Error('Invalid OAuth state signature');

  const payload = JSON.parse(base64UrlDecode(body)) as OAuthStatePayload;
  if (!payload.ts || typeof payload.ts !== 'number')
    throw new Error('Invalid OAuth state payload');
  if (Date.now() - payload.ts > maxAgeMs)
    throw new Error('OAuth state expired');
  return payload;
}
