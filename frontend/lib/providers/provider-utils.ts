import { gql } from '@apollo/client';

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
  settings?: Record<string, any>;
}

// SMTP Settings interface
export interface SmtpSettings {
  host: string;
  port: string | number;
  username: string;
  password: string;
  secure: boolean;
}

// GraphQL mutations
export const CONNECT_GMAIL = gql`
  mutation ConnectGmail($code: String!) {
    connectGmail(code: $code) {
      id
      type
      name
      email
      isActive
      lastSynced
      status
    }
  }
`;

export const CONNECT_OUTLOOK = gql`
  mutation ConnectOutlook($code: String!) {
    connectOutlook(code: $code) {
      id
      type
      name
      email
      isActive
      lastSynced
      status
    }
  }
`;

export const CONNECT_SMTP = gql`
  mutation ConnectSmtp($settings: SmtpSettingsInput!) {
    connectSmtp(settings: $settings) {
      id
      type
      name
      email
      isActive
      lastSynced
      status
    }
  }
`;

export const DISCONNECT_PROVIDER = gql`
  mutation DisconnectProvider($id: ID!) {
    disconnectProvider(id: $id) {
      success
      message
    }
  }
`;

export const UPDATE_PROVIDER = gql`
  mutation UpdateProvider($id: ID!, $isActive: Boolean) {
    updateProvider(id: $id, isActive: $isActive) {
      id
      isActive
      status
    }
  }
`;

export const SYNC_PROVIDER = gql`
  mutation SyncProvider($id: ID!) {
    syncProvider(id: $id) {
      id
      lastSynced
      status
    }
  }
`;

// Local storage keys
const PROVIDERS_STORAGE_KEY = 'mailzen_providers';

// Local storage functions
export const getStoredProviders = (): Provider[] => {
  if (typeof window === 'undefined') return [];
  
  const storedProviders = localStorage.getItem(PROVIDERS_STORAGE_KEY);
  return storedProviders ? JSON.parse(storedProviders) : [];
};

export const storeProviders = (providers: Provider[]): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(PROVIDERS_STORAGE_KEY, JSON.stringify(providers));
};

export const addStoredProvider = (provider: Provider): Provider[] => {
  const providers = getStoredProviders();
  const updatedProviders = [...providers, provider];
  storeProviders(updatedProviders);
  return updatedProviders;
};

export const updateStoredProvider = (id: string, updates: Partial<Provider>): Provider[] => {
  const providers = getStoredProviders();
  const updatedProviders = providers.map(provider => 
    provider.id === id ? { ...provider, ...updates } : provider
  );
  storeProviders(updatedProviders);
  return updatedProviders;
};

export const removeStoredProvider = (id: string): Provider[] => {
  const providers = getStoredProviders();
  const updatedProviders = providers.filter(provider => provider.id !== id);
  storeProviders(updatedProviders);
  return updatedProviders;
};

// OAuth utility functions
export const getGoogleOAuthUrl = (): string => {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/auth/google/callback`;
  const scope = 'https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email';
  
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
};

export const getMicrosoftOAuthUrl = (): string => {
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/auth/microsoft/callback`;
  const scope = 'offline_access Mail.Read Mail.Send User.Read';
  
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
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