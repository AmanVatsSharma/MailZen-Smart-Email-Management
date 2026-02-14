import { AUTH_ROUTES, resolvePostAuthRoute } from './routes';

describe('resolvePostAuthRoute', () => {
  it('returns alias select route when alias setup is required', () => {
    expect(resolvePostAuthRoute({ requiresAliasSetup: true })).toBe(
      AUTH_ROUTES.aliasSelect,
    );
  });

  it('returns nextStep when provided and alias setup is not required', () => {
    expect(
      resolvePostAuthRoute({
        requiresAliasSetup: false,
        nextStep: '/inbox',
      }),
    ).toBe('/inbox');
  });

  it('falls back to dashboard route', () => {
    expect(resolvePostAuthRoute(undefined)).toBe(AUTH_ROUTES.dashboard);
  });
});
