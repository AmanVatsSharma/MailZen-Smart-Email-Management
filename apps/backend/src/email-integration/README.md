# Email Integration Module

## Overview

The Email Integration Module is responsible for managing email providers within the MailZen application. It enables users to configure and manage different types of email providers including Gmail, Outlook, and custom SMTP servers.

## Features

- **Provider Configuration**: Set up different email providers with appropriate credentials
- **Provider Management**: List, retrieve, update, and delete email providers
- **Connection Validation**: Validate provider connections to ensure they're properly configured
- **Multi-Provider Support**: Support for Gmail, Outlook, and custom SMTP servers
- **Security**: Secure handling of authentication credentials
- **Credential Encryption at Rest**: OAuth/SMTP secrets are encrypted before persistence
- **Credential Key Rotation**: Keyring-based decrypt fallback with active-key writes
- **OAuth Token Management**: Automatic refresh of OAuth tokens for Gmail and Outlook
- **Provider Sync Lease Coordination**: Provider-level DB leases prevent duplicate scheduler workers
- **Sync Error Telemetry**: Providers persist `lastSyncError` + `lastSyncErrorAt` for debugging and support workflows
- **Automatic Provider Detection**: Auto-detect provider type based on email address domain
- **Connection Pooling**: Efficient SMTP connection management for improved performance
- **Plan Entitlements**: Enforces provider count limits from user subscription plan
- **Workspace Assignment**: New providers are assigned to the user default workspace for future scoped access control

## Implementation Status

All features have been implemented and tested:

- ✅ OAuth refresh token handling for Gmail/Outlook providers
- ✅ Connection pooling for SMTP providers
- ✅ Automatic email provider detection based on email address
- ✅ Comprehensive test coverage for all components
- ✅ Detailed documentation

## Architecture

This module follows NestJS best practices and consists of:

- **Service**: Handles business logic and interacts with database through TypeORM
- **Resolver**: Exposes GraphQL endpoints for client interaction
- **DTOs**: Define input data structures with validation
- **Entities**: Define GraphQL return types

## GraphQL API

### Queries

- `getAllProviders`: Get all email providers for the authenticated user (legacy admin-ish shape)
- `getProviderById(id: String!)`: Get a specific provider by ID (legacy admin-ish shape)
- `getProviderEmails(providerId: String!)`: Get all emails for a specific provider
- `validateProvider(id: String!)`: Validate connection to a provider
- `providers`: Frontend-facing provider list (UI shape)
- `getEmailProviders`: Backwards-compatible alias for `providers`
  - both now accept optional `workspaceId` for scoped listing
- `myProviderSyncStats(workspaceId?: String, windowHours?: Int): ProviderSyncStatsResponse!`
  - returns provider sync lifecycle/health counters in a rolling time window
  - reports:
    - `totalProviders`, `connectedProviders`, `syncingProviders`, `errorProviders`
    - `recentlySyncedProviders`, `recentlyErroredProviders`
  - `windowHours` is clamped server-side for safe bounded telemetry queries
- `myProviderSyncDataExport(workspaceId?: String, limit?: Int): ProviderSyncDataExportResponse!`
  - exports provider sync operational state snapshot as JSON payload
  - includes per-provider lifecycle fields (status, last sync/error timestamps, lease/watch metadata)
  - includes aggregated status counts for compliance/support workflows
- `myProviderSyncAlertDeliveryStats(workspaceId?: String, windowHours?: Int): ProviderSyncAlertDeliveryStatsResponse!`
  - returns aggregate counts for emitted provider sync alert notifications
  - covers `SYNC_FAILED` and `SYNC_RECOVERED` notification types
- `myProviderSyncAlertDeliverySeries(workspaceId?: String, windowHours?: Int, bucketMinutes?: Int): [ProviderSyncAlertDeliveryTrendPointResponse!]!`
  - returns bucketed trend points for emitted provider sync alerts
- `myProviderSyncAlerts(workspaceId?: String, windowHours?: Int, limit?: Int): [ProviderSyncAlertResponse!]!`
  - returns recent provider sync alert notifications with metadata context
- `myProviderSyncAlertDeliveryDataExport(workspaceId?: String, windowHours?: Int, bucketMinutes?: Int, limit?: Int): ProviderSyncAlertDeliveryDataExportResponse!`
  - exports provider sync alert delivery stats/series/history as JSON payload
- `myProviderSyncIncidentAlertConfig: ProviderSyncIncidentAlertConfigResponse!`
  - returns resolved provider sync incident alert scheduler config snapshot
  - includes current-user `syncFailureEnabled` preference state
- `myProviderSyncIncidentAlertDeliveryStats(workspaceId?: String, windowHours?: Int): ProviderSyncIncidentAlertDeliveryStatsResponse!`
  - returns aggregate counts for emitted `PROVIDER_SYNC_INCIDENT_ALERT` notifications
- `myProviderSyncIncidentAlertDeliverySeries(workspaceId?: String, windowHours?: Int, bucketMinutes?: Int): [ProviderSyncIncidentAlertDeliveryTrendPointResponse!]!`
  - returns bucketed trend points for emitted provider sync incident alerts
- `myProviderSyncIncidentAlerts(workspaceId?: String, windowHours?: Int, limit?: Int): [ProviderSyncIncidentAlertResponse!]!`
  - returns recent provider sync incident alert notifications with incident metadata context
- `myProviderSyncIncidentAlertHistoryDataExport(workspaceId?: String, windowHours?: Int, limit?: Int): ProviderSyncIncidentAlertHistoryDataExportResponse!`
  - exports recent provider sync incident alert history as JSON payload
- `myProviderSyncIncidentAlertDeliveryDataExport(workspaceId?: String, windowHours?: Int, bucketMinutes?: Int, limit?: Int): ProviderSyncIncidentAlertDeliveryDataExportResponse!`
  - exports provider sync incident alert delivery stats/series/history as JSON payload

### Mutations

- `configureEmailProvider(providerInput: EmailProviderInput!)`: Configure a new email provider
- `updateProviderCredentials(id: String!, input: EmailProviderInput!)`: Update provider credentials
- `deleteProvider(input: DeleteProviderInput!)`: Delete an email provider

Frontend-facing (matches `apps/frontend/lib/providers/provider-utils.ts`):

- `connectGmail(code: String!): Provider`
- `connectOutlook(code: String!): Provider`
- `connectSmtp(settings: SmtpSettingsInput!): Provider`
- `disconnectProvider(id: ID!): ProviderActionResult`
- `updateProvider(id: ID!, isActive: Boolean): Provider`
- `updateProviderStatus(id: String!, isActive: Boolean): Provider` (alias for older frontend clients)
- `syncProvider(id: ID!): Provider`
  - Gmail providers: triggers real Gmail metadata sync through `GmailSyncService`
  - Outlook providers: triggers real Microsoft Graph sync through `OutlookSyncService`
  - SMTP providers: validates SMTP connectivity and updates sync status/error telemetry
  - Errors are persisted as provider state (`status=error`, `lastSyncError`, `lastSyncErrorAt`) for support/debug visibility
  - manual sync failures/recoveries emit `SYNC_FAILED`/`SYNC_RECOVERED`
    notifications with `triggerSource=MANUAL` metadata for audit parity with schedulers
- `syncMyProviders(workspaceId?: String, providerId?: String): ProviderSyncRunResponse!`
  - batch/manual provider sync trigger for authenticated user
  - optional `providerId` scopes to a single owned provider
  - optional `workspaceId` enforces workspace ownership/scope
  - returns aggregate counters (`requested/synced/failed/skipped`) and per-provider results
  - skips providers with active lease/status indicating in-flight sync
  - emits structured batch observability logs with run correlation id
    (`provider_sync_batch_start`, `provider_sync_batch_provider_completed`,
    `provider_sync_batch_provider_failed`, `provider_sync_batch_completed`)
- `runMyProviderSyncIncidentAlertCheck(windowHours?: Int, warningErrorProviderPercent?: Float, criticalErrorProviderPercent?: Float, minErrorProviders?: Int): ProviderSyncIncidentAlertCheckResponse!`
  - runs on-demand provider incident alert evaluation for current user with optional threshold overrides
  - returns status reason and whether warning/critical alert criteria are currently met
  - includes `syncFailureEnabled` so diagnostics reflect per-user notification preference gating

### Batch sync flow (`syncMyProviders`)

```mermaid
flowchart TD
  FE[Frontend settings or admin action] -->|syncMyProviders| RES[EmailProviderConnectResolver]
  RES --> SVC[EmailProviderService.syncUserProviders]
  SVC --> OWN[Ownership and workspace scope validation]
  OWN --> LIST[List matching providers]
  LIST --> LOOP{For each provider}
  LOOP -->|sync already running| SKIP[Mark skippedProviders plus result row]
  LOOP -->|eligible| SINGLE[syncProvider providerId userId]
  SINGLE --> STATE[Persist provider state connected/error telemetry]
  STATE --> RESULT[Aggregate counters and per-provider result rows]
  RESULT --> FE
```

## OAuth Redirect URI notes (important)

OAuth `code` exchange requires that the **redirect URI used during authorization** matches the one used during token exchange.

Provider linking (Gmail/Outlook connect) is **backend-only** (recommended).

- Provider linking start endpoints (frontend redirects the browser here):
  - `GET /email-integration/google/start`
  - `GET /email-integration/microsoft/start`
- Provider linking callback endpoints (OAuth apps must point here):
  - `GOOGLE_PROVIDER_REDIRECT_URI=http://localhost:4000/email-integration/google/callback`
  - `OUTLOOK_PROVIDER_REDIRECT_URI=http://localhost:4000/email-integration/microsoft/callback`

Login OAuth (backend redirect) uses:

- `GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback`

### Provider OAuth controller observability events

- `provider_oauth_start_config_missing`
- `provider_oauth_start_redirect`
- `provider_oauth_callback_provider_error`
- `provider_oauth_callback_missing_code_or_state`
- `provider_oauth_callback_invalid_state`
- `provider_oauth_callback_missing_user`
- `provider_oauth_callback_connect_success`
- `provider_oauth_callback_connect_failed`
- `provider_oauth_redirect_target_invalid`
- `provider_oauth_redirect_target_rejected_external`

## Mermaid: connect provider via OAuth code

```mermaid
flowchart TD
  frontend[Frontend] -->|redirect_to_backend_start| apiStart[BackendProviderOAuthStart]
  apiStart -->|redirect_to_provider| oauth[OAuthProvider]
  oauth -->|code+state| apiCb[BackendProviderOAuthCallback]
  apiCb -->|validate_state| apiCb
  apiCb -->|exchange_code_for_tokens| oauth
  apiCb --> db[(PostgresTypeORM)]
  apiCb -->|redirect_success_error| frontend
```

## Data Transfer Objects

### EmailProviderInput

```typescript
@InputType()
export class EmailProviderInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @IsIn(['GMAIL', 'OUTLOOK', 'CUSTOM_SMTP'])
  providerType: string;

  @Field()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  password?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  host?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  port?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  tokenExpiry?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  autoDetect?: boolean;
}
```

### DeleteProviderInput

```typescript
{
  id: string;
}
```

## Usage Examples

### Configuring a Gmail Provider with OAuth

```graphql
mutation {
  configureEmailProvider(
    providerInput: {
      providerType: "GMAIL"
      email: "user@gmail.com"
      accessToken: "your-oauth-access-token"
      refreshToken: "your-oauth-refresh-token"
      tokenExpiry: 3600
    }
  ) {
    id
    type
    email
    createdAt
  }
}
```

### Auto-detecting Provider Type

```graphql
mutation {
  configureEmailProvider(
    providerInput: {
      email: "user@gmail.com"
      accessToken: "your-oauth-access-token"
      refreshToken: "your-oauth-refresh-token"
      autoDetect: true
    }
  ) {
    id
    type
    email
    createdAt
  }
}
```

### Configuring a Custom SMTP Provider

```graphql
mutation {
  configureEmailProvider(
    providerInput: {
      providerType: "CUSTOM_SMTP"
      email: "user@example.com"
      host: "smtp.example.com"
      port: 587
      password: "your-password"
    }
  ) {
    id
    type
    email
    host
    port
    createdAt
  }
}
```

## OAuth Token Management

The module automatically handles OAuth token refresh for Gmail and Outlook providers:

- Tokens are refreshed when they are about to expire (within 5 minutes of expiry)
- New access tokens are stored in the database
- If a refresh token is returned, it is also updated

## Provider sync lease coordination

- `ProviderSyncLeaseService` acquires provider-level leases by atomically updating:
  - `status=syncing`
  - `syncLeaseExpiresAt=now()+lease_ttl`
- Lease TTL is configurable via `PROVIDER_SYNC_LEASE_TTL_MS`.
- Gmail/Outlook schedulers skip providers with active leases and retry later.

## Provider sync error telemetry

- `EmailProvider` now tracks:
  - `lastSyncErrorAt` (timestamp of last failure)
  - `lastSyncError` (trimmed failure reason)
- Sync services clear these fields when starting and when completing successfully.
- Scheduler fallback failures also write these fields when retries are exhausted.

## Provider sync incident alert scheduler

`ProviderSyncIncidentScheduler` runs every 15 minutes and emits
`PROVIDER_SYNC_INCIDENT_ALERT` notifications when the percentage of providers
in `error` status breaches warning/critical thresholds for a user.

Scheduler emits structured observability events such as:

- `provider_sync_incident_monitor_start`
- `provider_sync_incident_user_within_threshold`
- `provider_sync_incident_alert_suppressed_by_cooldown`
- `provider_sync_incident_alert_emitted`
- `provider_sync_incident_monitor_user_failed`

Configuration:

- `MAILZEN_PROVIDER_SYNC_INCIDENT_ALERTS_ENABLED` (default `true`)
- `MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_WINDOW_HOURS` (default `24`)
- `MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_COOLDOWN_MINUTES` (default `60`)
- `MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_MAX_USERS_PER_RUN` (default `500`)
- `MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_WARNING_ERROR_PROVIDER_PERCENT` (default `20`)
- `MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_CRITICAL_ERROR_PROVIDER_PERCENT` (default `50`)
- `MAILZEN_PROVIDER_SYNC_INCIDENT_ALERT_MIN_ERROR_PROVIDERS` (default `1`)

## Operational runbook: provider sync triage

1. **Check provider state in GraphQL**
   - Query `providers(workspaceId)` for `status`, `lastSyncError`, `lastSyncErrorAt`, `lastSynced`.
2. **Trigger targeted manual sync**
   - Run `syncMyProviders(providerId: "...", workspaceId: "...")`.
   - Verify response row for that provider (`success/error`) and aggregate counters.
3. **Trigger workspace-wide recovery**
   - Run `syncMyProviders(workspaceId: "...")` to recover all providers in scope.
4. **Interpret batch counters**
   - `syncedProviders`: recovered/healthy syncs
   - `failedProviders`: sync attempts that ended in error
   - `skippedProviders`: already-running providers (active lease)
5. **Escalation path**
   - If repeated `failedProviders > 0`, inspect provider OAuth token validity and
     upstream API availability (Google/Microsoft service health), then retry.
6. **Export operational snapshot**
   - Run `myProviderSyncDataExport(workspaceId, limit)` for support/compliance
     handoff when deeper incident context is needed.

## Connection Pooling

For SMTP providers, the module implements connection pooling to improve performance:

- Connections are reused across multiple email operations
- Idle connections are automatically closed after 30 minutes
- A maximum of 5 connections per provider is maintained
- Each connection handles up to a maximum of 100 messages

## Error Handling

The module provides detailed error responses with appropriate HTTP status codes:

- `400 Bad Request`: Invalid input data (e.g., missing required fields)
- `401 Unauthorized`: Authentication failed
- `403 Forbidden`: User doesn't have permission to access the provider
- `404 Not Found`: Provider not found
- `409 Conflict`: Provider already exists
- `500 Internal Server Error`: Unexpected server error

## Security Considerations

- OAuth credentials are never exposed in GraphQL responses
- Passwords are securely stored in the database
- Provider secret encryption supports rotation via:
  - `PROVIDER_SECRETS_KEYRING`
  - `PROVIDER_SECRETS_ACTIVE_KEY_ID`
    while maintaining backward compatibility for legacy `enc:v1` encrypted rows.
- Runtime lazy-rotation rewrites stale/plaintext provider secrets to the active
  key on read paths (`getValidAccessToken`, `getTransporter`, OAuth refresh).
  Structured event: `provider_secret_rotated_to_active_key`.
- All endpoints are protected with JWT authentication
- User-based access control ensures users can only access their own providers

## Credential rotation runbook

1. Add a new key entry to `PROVIDER_SECRETS_KEYRING` while keeping old entries.
2. Set `PROVIDER_SECRETS_ACTIVE_KEY_ID` to the new key id.
3. Roll restart backend instances.
4. Monitor logs for `provider_secret_rotated_to_active_key`.
5. After all active provider rows have rotated, remove retired key ids from
   `PROVIDER_SECRETS_KEYRING`.

## Integration with Other Modules

This module integrates with:

- **Email Module**: For sending emails through configured providers
- **Email Warmup Module**: For warming up email providers to improve deliverability
- **Email Analytics Module**: For tracking email performance metrics

## Future Enhancements

- Support for additional OAuth providers
- Enhanced credential encryption
- Rate limiting and quota management
- Advanced connection pooling strategies
- Support for proxy configurations
