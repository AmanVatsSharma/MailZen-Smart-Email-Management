// Provider types
export type EmailProvider = 'gmail' | 'outlook' | 'smtp';

// Provider connection status
export type ProviderStatus = 'connected' | 'error' | 'syncing' | 'disconnected';

// Provider interface
export interface Provider {
  id: string;
  type: EmailProvider;
  name: string;
  email: string;
  isActive: boolean;
  lastSynced: string;
  status: ProviderStatus;
  workspaceId?: string | null;
  settings?: Record<string, unknown>;
}

// SMTP Settings interface
export interface SmtpSettings {
  host: string;
  port: string | number;
  username: string;
  password: string;
  secure: boolean;
}

/**
 * OAuth utility functions (backend-only redirects).
 *
 * IMPORTANT:
 * We do NOT build provider OAuth URLs in the frontend anymore.
 * Frontend redirects to backend start endpoints which:
 * - generate signed `state`
 * - redirect to Google/Microsoft
 * - handle callback + token exchange + DB write
 * - redirect back to frontend with success/error
 */
const getBackendBaseUrl = (): string => {
  const gql = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
  try {
    const u = new URL(gql);
    // Strip `/graphql` if present; keep scheme+host+port.
    return `${u.protocol}//${u.host}`;
  } catch {
    // Dev-friendly fallback; avoids breaking UI if env is malformed.
    console.warn('[provider-utils] Invalid NEXT_PUBLIC_GRAPHQL_ENDPOINT; falling back to http://localhost:4000', { gql });
    return 'http://localhost:4000';
  }
};

export const getGoogleOAuthUrl = (redirectPath: string = '/email-providers'): string => {
  const base = getBackendBaseUrl();
  const url = new URL('/email-integration/google/start', base);
  // Redirect back to the current frontend origin by default.
  const finalRedirect = `${window.location.origin}${redirectPath}`;
  url.searchParams.set('redirect', finalRedirect);
  return url.toString();
};

export const getMicrosoftOAuthUrl = (redirectPath: string = '/email-providers'): string => {
  const base = getBackendBaseUrl();
  const url = new URL('/email-integration/microsoft/start', base);
  const finalRedirect = `${window.location.origin}${redirectPath}`;
  url.searchParams.set('redirect', finalRedirect);
  return url.toString();
};

// Helper functions
export const formatProviderName = (type: EmailProvider, email: string): string => {
  switch (type) {
    case 'gmail':
      return `Gmail - ${email}`;
    case 'outlook':
      return `Outlook - ${email}`;
    case 'smtp':
      return `SMTP - ${email}`;
    default:
      return email;
  }
};

export const validateSmtpSettings = (settings: SmtpSettings): { valid: boolean; message?: string } => {
  if (!settings.host) {
    return { valid: false, message: 'SMTP host is required' };
  }
  
  if (!settings.port) {
    return { valid: false, message: 'SMTP port is required' };
  }
  
  if (!settings.username) {
    return { valid: false, message: 'Username is required' };
  }
  
  if (!settings.password) {
    return { valid: false, message: 'Password is required' };
  }
  
  return { valid: true };
}; 