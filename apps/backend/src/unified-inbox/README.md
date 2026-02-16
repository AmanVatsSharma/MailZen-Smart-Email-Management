# Unified Inbox Module (Backend)

## Goal

Expose a **Gmail-like inbox contract** to the frontend while using a single, consistent backend source of truth across:

- external provider messages
- MailZen mailbox-sourced internal messages

- Provider sync stores inbound messages in **`ExternalEmailMessage`** (TypeORM entity).
- Mailbox-aware reads map internal `Email` rows (where active inbox type is `MAILBOX`) into the same `EmailThread` GraphQL contract.
- Inbox UI reads via GraphQL **`emails/email/updateEmail/folders/labels`**.
- Actions (read/star/archive/trash/labels) call **Gmail APIs** (for Gmail providers) and persist label state locally.

## GraphQL API (frontend contract)

These names intentionally match the frontend inbox UI (`apps/frontend/lib/apollo/queries/emails.ts`).

### Queries

- **`emails(limit, offset, filter, sort): [EmailThread!]!`**
  - Thread-shaped list records (what the inbox list UI needs).
  - Resolves active inbox source from `User.activeInboxType/activeInboxId`:
    - `PROVIDER` -> uses `ExternalEmailMessage`
    - `MAILBOX` -> uses internal `Email` rows scoped by `emails.mailboxId` (with legacy mailbox-address fallback)
  - Fallback order: active provider -> newest provider -> newest mailbox.

- **`email(id: ID!): EmailThread!`**
  - Provider mode:
    - `id` is treated as provider thread id (`threadId`) or provider message id fallback
    - lazily hydrates Gmail message bodies (`format=full`) and caches payload in `ExternalEmailMessage.rawPayload`
  - Mailbox mode:
    - `id` can be internal `Email.id`, `emails.inboundThreadKey`, or stored inbound message id
    - returns grouped mailbox thread messages when `inboundThreadKey` links related messages.

- **`folders: [EmailFolder!]!`**
  - Provider mode: counts derived from provider labels.
  - Mailbox mode: counts derived from internal email status/from-to mapping.

- **`labels: [EmailLabel!]!`**
  - Provider mode: non-system provider labels with counts, metadata from `ExternalEmailLabel`.
  - Mailbox mode: label list derived from persisted `EmailLabelAssignment` joins with
    metadata from `EmailLabel`.

### Mutations

- **`updateEmail(id: ID!, input: EmailUpdateInput!): EmailThread!`**
  - Gmail providers: calls Gmail `threads.modify` / `messages.modify` with retry/backoff.
  - Non-Gmail providers: updates local labels only (best-effort / MVP).
  - Mailbox mode:
    - updates internal `Email.status` / `Email.isImportant` for folder/read/star transitions.
    - applies mailbox custom labels through `EmailLabelAssignment` add/remove deltas with ownership validation.

## Folder & label mapping (Gmail)

Folders are derived from Gmail system labels:

- `INBOX` → `inbox`
- `SENT` → `sent`
- `TRASH` → `trash`
- `SPAM` → `spam`
- (none of the above) → `archive`

Read/star state:

- unread = label `UNREAD`
- starred = label `STARRED`

## Mailbox folder mapping (internal email rows)

- `status=DRAFT` -> `drafts`
- `status=TRASH` -> `trash`
- `status=SPAM` -> `spam`
- `status=ARCHIVED` -> `archive`
- `from=<active-mailbox-address>` -> `sent`
- default -> `inbox`

Read/star state:

- unread = `status in [UNREAD, NEW]`
- starred = `isImportant=true`

Mailbox custom labels:

- stored in `email_label_assignments`
- surfaced in thread `labelIds` and `labels` query counts
- updated via `updateEmail` add/remove label deltas

## Mailbox threading model

- Incoming alias webhook writes:
  - `emails.mailboxId` (mailbox source id for strict mailbox scoping)
  - `emails.inboundMessageId` (normalized message-id)
  - `emails.inboundThreadKey` (derived thread key)
- Mailbox inbox list groups rows by `inboundThreadKey` (fallback: `Email.id`)
- Mailbox detail + update operations accept:
  - thread key
  - email row id
  - inbound message id
    and resolve to the grouped mailbox thread payload.

## Security / authz

Every operation is **user-scoped**:

- active provider/mailbox must belong to the authenticated user
- when `User.activeWorkspaceId` is set, provider/mailbox source resolution is scoped to that workspace (with legacy null fallback during rollout)
- provider message queries are filtered by `userId` + `providerId`
- mailbox message queries are filtered by `userId` + `mailboxId` (with address-participation fallback for legacy pre-linkage rows)

## Mermaid: inbox source resolution

```mermaid
flowchart TD
  UI[Frontend inbox] --> Resolver[UnifiedInboxResolver]
  Resolver --> Service[UnifiedInboxService]
  Service --> UserRow[User.activeInboxType + activeInboxId]
  UserRow -->|PROVIDER| ProviderStore[ExternalEmailMessage]
  UserRow -->|MAILBOX| InternalStore[Email]
  ProviderStore --> ThreadMap[EmailThread contract mapping]
  InternalStore --> ThreadMap
  ThreadMap --> Resolver
  Resolver --> UI
```

## Mermaid: provider inbox list/detail

```mermaid
sequenceDiagram
  participant UI as FrontendInboxUI
  participant GQL as GraphQLUnifiedInboxResolver
  participant SVC as UnifiedInboxService
  participant DB as PostgresTypeORM
  participant Gmail as GmailAPI

  UI->>GQL: emails(limit,offset,filter,sort)
  GQL->>SVC: listThreads(userId,...)
  SVC->>DB: externalEmailMessage.findMany(...)
  DB-->>SVC: messages
  SVC-->>GQL: EmailThread[]
  GQL-->>UI: EmailThread[]

  UI->>GQL: email(id)
  GQL->>SVC: getThread(userId,id)
  SVC->>DB: externalEmailMessage.findMany(threadId)
  alt needsFullBodyAndProviderIsGmail
    SVC->>Gmail: messages.get(format=full)
    SVC->>DB: externalEmailMessage.update(rawPayload)
  end
  SVC-->>GQL: EmailThread
  GQL-->>UI: EmailThread
```

## Mermaid: action mutation (provider + mailbox)

```mermaid
sequenceDiagram
  participant UI as FrontendInboxUI
  participant GQL as GraphQLUnifiedInboxResolver
  participant SVC as UnifiedInboxService
  participant DB as PostgresTypeORM
  participant Gmail as GmailAPI

  UI->>GQL: updateEmail(id,input)
  GQL->>SVC: updateThread(userId,id,input)
  alt active source is PROVIDER
    SVC->>DB: externalEmailMessage.findFirst(anchor)
    alt providerIsGmailAndThreadIdPresent
      SVC->>Gmail: threads.modify(addLabelIds,removeLabelIds)
      Gmail-->>SVC: thread(messages[])
      SVC->>DB: externalEmailMessage.updateMany(labels)
    else providerIsGmailAndNoThreadId
      SVC->>Gmail: messages.modify(addLabelIds,removeLabelIds)
      Gmail-->>SVC: message(labelIds)
      SVC->>DB: externalEmailMessage.updateMany(labels)
    else nonGmailProvider
      SVC->>DB: externalEmailMessage.update(labels)
    end
  else active source is MAILBOX
    SVC->>DB: emails.update(status,isImportant,folderId)
  end
  SVC-->>GQL: EmailThread
  GQL-->>UI: EmailThread
```

## Observability

- Structured service events:
  - `unified_inbox_emails_list_mailbox_completed`
  - `unified_inbox_emails_list_provider_completed`
  - `unified_inbox_gmail_api_retry`
  - `unified_inbox_gmail_api_failed`
  - `unified_inbox_gmail_access_token_refresh_failed`
  - `unified_inbox_update_email_gmail_thread_modify_completed`
  - `unified_inbox_update_email_gmail_message_modify_completed`
  - `unified_inbox_update_email_local_completed`

## Changelog

- 2026-02-16:
  - Unified mailbox-source reads now prefer strict `emails.mailboxId` scoping.
  - Added fallback compatibility path for older rows without mailbox linkage.
  - Mailbox-source filtering now excludes provider-linked `Email` rows.
- 2026-02-15:
  - Added mailbox-source support in `UnifiedInboxService` so active `MAILBOX` inboxes return real thread data from internal `Email` rows.
  - Added mailbox-mode folder/label/read/star mapping while preserving existing provider behavior.
  - Added unit tests for mailbox thread listing and mailbox action updates.
