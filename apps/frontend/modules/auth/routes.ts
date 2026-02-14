import type { AuthNavigationState } from './types';

export const AUTH_ROUTES = {
  login: '/auth/login',
  register: '/auth/register',
  forgotPassword: '/auth/forgot-password',
  oauthSuccess: '/auth/oauth-success',
  aliasSelect: '/auth/alias-select',
  dashboard: '/',
} as const;

export const resolvePostAuthRoute = (
  state: AuthNavigationState | undefined,
): string => {
  if (state?.requiresAliasSetup) {
    return AUTH_ROUTES.aliasSelect;
  }

  if (state?.nextStep && state.nextStep.trim().length > 0) {
    return state.nextStep;
  }

  return AUTH_ROUTES.dashboard;
};
