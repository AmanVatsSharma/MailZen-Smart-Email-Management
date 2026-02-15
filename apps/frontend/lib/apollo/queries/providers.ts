import { gql } from '@apollo/client';

/**
 * Provider GraphQL operations (single source of truth).
 *
 * IMPORTANT:
 * These names match the backend schema implemented in:
 * - `apps/backend/src/email-integration/email-provider.connect.resolver.ts`
 *
 * We keep the frontend as a pure GraphQL client; OAuth redirects are handled by backend REST
 * endpoints under `/email-integration/*`.
 */

// Query to get UI-shaped providers for the current user
export const GET_PROVIDERS = gql`
  query Providers {
    providers {
      id
      type
      name
      email
      isActive
      lastSynced
      status
      workspaceId
    }
  }
`;

// Mutation to connect an SMTP provider (OAuth providers are connected via backend redirect flow)
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
      workspaceId
    }
  }
`;

// Mutation to disconnect a provider
export const DISCONNECT_PROVIDER = gql`
  mutation DisconnectProvider($id: String!) {
    disconnectProvider(id: $id) {
      success
      message
    }
  }
`;

// Mutation to update provider active status
export const UPDATE_PROVIDER = gql`
  mutation UpdateProvider($id: String!, $isActive: Boolean) {
    updateProvider(id: $id, isActive: $isActive) {
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

// NOTE: the actual `SmtpSettingsInput` shape is defined by the backend schema.
// Frontend types can be derived later via codegen; for now UI uses local TS types. 