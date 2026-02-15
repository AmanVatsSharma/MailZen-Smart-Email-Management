# Providers UI Module (Frontend)

## Goal

Provide provider/mailbox management surfaces for connecting inbox sources and
monitoring subscription-aware limits.

## Key components

- `ProviderManagement.tsx`
  - Lists connected external providers and MailZen mailboxes
  - Supports optional workspace-scoped listing using active workspace selection
  - Supports provider connect/sync/pause/remove actions
  - Shows live subscription plan usage:
    - provider usage (`used/limit`)
    - mailbox usage (`used/limit`)
    - workspace usage (`used/limit`)
    - AI credits/month snapshot
- `ProviderWizard.tsx`
  - Guided connect flow for Gmail/Outlook/SMTP

## Data dependencies

- `providers`
- `myMailboxes`
- `mySubscription`
- `billingPlans`
- `myWorkspaces`

## Flow

```mermaid
flowchart TD
  User --> ProviderManagement
  ProviderManagement --> ProvidersQuery[providers]
  ProviderManagement --> MailboxesQuery[myMailboxes]
  ProviderManagement --> BillingQuery[mySubscription + billingPlans + myWorkspaces]
  ProviderManagement --> ProviderWizard
  ProviderWizard --> ConnectMutations[connectSmtp/connectGmail/connectOutlook]
```

