import {
  setRefreshToken,
  getRefreshToken,
  removeRefreshToken,
  setUserData,
  getUserData,
  removeUserData,
  logoutUser,
} from '../storage';
import type { AuthUser } from '../types';

const mockUser: AuthUser = { id: '1', email: 'test@example.com', name: 'Test User' };

beforeEach(() => {
  localStorage.clear();
});

describe('refresh token storage', () => {
  it('sets and retrieves a refresh token', () => {
    setRefreshToken('my-token');
    expect(getRefreshToken()).toBe('my-token');
  });

  it('returns null when no token is set', () => {
    expect(getRefreshToken()).toBeNull();
  });

  it('removes the refresh token', () => {
    setRefreshToken('my-token');
    removeRefreshToken();
    expect(getRefreshToken()).toBeNull();
  });
});

describe('user data storage', () => {
  it('sets and retrieves user data', () => {
    setUserData(mockUser);
    expect(getUserData()).toEqual(mockUser);
  });

  it('returns null when no user is stored', () => {
    expect(getUserData()).toBeNull();
  });

  it('removes user data', () => {
    setUserData(mockUser);
    removeUserData();
    expect(getUserData()).toBeNull();
  });
});

describe('logoutUser', () => {
  it('clears both user data and refresh token', () => {
    setUserData(mockUser);
    setRefreshToken('my-token');
    logoutUser();
    expect(getUserData()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
