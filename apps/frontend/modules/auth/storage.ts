import type { AuthUser } from './types';

// The backend issues an HttpOnly `token` cookie on every auth operation.
// That cookie is the authoritative session credential and is included
// automatically by `credentials: 'include'` on every Apollo request.
//
// The user object stored below is a local display cache only — it is NOT
// used for auth gating. Components should prefer Apollo queries (AUTH_ME_QUERY)
// for authoritative user data.
//
// The refresh token is stored here because the backend's `refresh` mutation
// requires it as a body parameter. Once the backend supports cookie-based
// refresh this localStorage entry can be removed.
const AUTH_USER_STORAGE_KEY = 'user';
const REFRESH_TOKEN_STORAGE_KEY = 'mailzen_refresh_token';

export const setUserData = (user: AuthUser): void => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
};

export const getUserData = (): AuthUser | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
};

export const removeUserData = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
};

export const setRefreshToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
};

export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
};

export const removeRefreshToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
};

export const logoutUser = (): void => {
  removeUserData();
  removeRefreshToken();
};
