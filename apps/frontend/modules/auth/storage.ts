import type { AuthUser } from './types';

const AUTH_USER_STORAGE_KEY = 'user';

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

export const logoutUser = (): void => {
  removeUserData();
};
