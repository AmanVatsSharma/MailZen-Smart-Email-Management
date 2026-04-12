/**
 * Auth domain types shared across frontend and backend.
 */

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  isEmailVerified?: boolean;
  role?: string | null;
  activeWorkspaceId?: string | null;
  createdAt?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string | null;
  /** Whether the user still needs to pick a MailZen alias mailbox */
  requiresAliasSetup?: boolean;
  /** Optional next step URL the backend wants the frontend to navigate to */
  nextStep?: string | null;
}

export type OAuthProvider = 'google' | 'microsoft';
