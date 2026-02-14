import { buildOAuthState, verifyOAuthState } from './oauth-state.util';

describe('oauth-state util', () => {
  const originalStateSecret = process.env.OAUTH_STATE_SECRET;

  beforeEach(() => {
    process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';
  });

  afterEach(() => {
    process.env.OAUTH_STATE_SECRET = originalStateSecret;
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
});
