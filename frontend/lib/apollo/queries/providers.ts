import { gql } from '@apollo/client';

// Query to get all email providers for the current user
export const GET_EMAIL_PROVIDERS = gql`
  query GetEmailProviders {
    getEmailProviders {
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

// Query to get a specific email provider
export const GET_EMAIL_PROVIDER = gql`
  query GetEmailProvider($id: String!) {
    getEmailProvider(id: $id) {
      id
      type
      name
      email
      isActive
      lastSynced
      status
      settings {
        ... on GmailSettings {
          refreshToken
          scope
        }
        ... on OutlookSettings {
          refreshToken
          scope
        }
        ... on SmtpSettings {
          host
          port
          username
          password
          secure
        }
      }
    }
  }
`;

// Mutation to connect a Gmail provider
export const CONNECT_GMAIL_PROVIDER = gql`
  mutation ConnectGmailProvider($code: String!) {
    connectGmailProvider(code: $code) {
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

// Mutation to connect an Outlook provider
export const CONNECT_OUTLOOK_PROVIDER = gql`
  mutation ConnectOutlookProvider($code: String!) {
    connectOutlookProvider(code: $code) {
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

// Mutation to connect an SMTP provider
export const CONNECT_SMTP_PROVIDER = gql`
  mutation ConnectSmtpProvider($input: SmtpProviderInput!) {
    connectSmtpProvider(input: $input) {
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

// Mutation to disconnect a provider
export const DISCONNECT_PROVIDER = gql`
  mutation DisconnectProvider($id: String!) {
    disconnectProvider(id: $id) {
      id
      success
      message
    }
  }
`;

// Mutation to update provider status
export const UPDATE_PROVIDER_STATUS = gql`
  mutation UpdateProviderStatus($id: String!, $isActive: Boolean!) {
    updateProviderStatus(id: $id, isActive: $isActive) {
      id
      isActive
      status
    }
  }
`;

// Mutation to sync a provider
export const SYNC_PROVIDER = gql`
  mutation SyncProvider($id: String!) {
    syncProvider(id: $id) {
      id
      lastSynced
      status
    }
  }
`;

// Input type for SMTP provider
export interface SmtpProviderInput {
  name: string;
  email: string;
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
} 