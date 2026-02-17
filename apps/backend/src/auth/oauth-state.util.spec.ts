import { buildOAuthState, verifyOAuthState } from './oauth-state.util';

describe('oauth-state util', () => {
  const originalStateSecret = process.env.OAUTH_STATE_SECRET;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterEach(() => {
    process.env.OAUTH_STATE_SECRET = originalStateSecret;
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('builds and verifies state payload', () => {
    const state = buildOAuthState('/inbox');
    const payload = verifyOAuthState(state, 60_000);
    expect(payload.redirect).toBe('/inbox');
    expect(typeof payload.nonce).toBe('string');
  });

  it('rejects tampered state payload', () => {
    const state = buildOAuthState('/inbox');
    const [body] = state.split('.', 1);
    const tampered = `${body}.invalid-signature`;

    expect(() => verifyOAuthState(tampered, 60_000)).toThrow(
      'Invalid OAuth state signature',
    );
  });

  it('rejects expired state payload', () => {
    const state = buildOAuthState('/inbox');
    expect(() => verifyOAuthState(state, -1)).toThrow('OAuth state expired');
  });

  it('rejects malformed state payload without signature separator', () => {
    expect(() => verifyOAuthState('malformed-state', 60_000)).toThrow(
      'Missing or malformed OAuth state',
    );
  });

  it('falls back to JWT secret when OAUTH_STATE_SECRET is unset', () => {
    delete process.env.OAUTH_STATE_SECRET;
    process.env.JWT_SECRET = 'jwt-fallback-secret';
    const state = buildOAuthState('/mailbox');
    const payload = verifyOAuthState(state, 60_000);
    expect(payload.redirect).toBe('/mailbox');
  });

  it('throws when neither OAUTH_STATE_SECRET nor JWT_SECRET is configured', () => {
    delete process.env.OAUTH_STATE_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => buildOAuthState('/inbox')).toThrow(
      'OAuth state secret not configured',
    );
  });
});
