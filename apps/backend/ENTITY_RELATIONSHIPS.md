# Entity Relationship Diagram

## Overview

This document visualizes the relationships between all entities in the MailZen TypeORM database schema.

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Contact : owns
    User ||--o{ Email : sends
    User ||--o{ EmailProvider : configures
    User ||--o{ EmailFilter : creates
    User ||--o{ EmailFolder : organizes
    User ||--o{ EmailLabel : defines
    User ||--o{ Template : creates
    User ||--o{ UserSession : has
    User ||--o{ VerificationToken : receives
    User ||--o{ AuditLog : generates
    User ||--o{ Mailbox : owns
    User ||--o{ PhoneVerification : requests
    User ||--o{ ExternalEmailMessage : syncs
    User ||--o{ ExternalEmailLabel : imports

    Email ||--o| EmailAnalytics : tracks
    Email }o--|| User : belongs_to
    Email }o--o| EmailProvider : sent_via
    Email }o--o| EmailFolder : filed_in
    Email ||--o{ EmailLabelAssignment : tagged_with
    Email ||--o{ Attachment : contains

    EmailProvider }o--|| User : belongs_to
    EmailProvider ||--o{ Email : sends
    EmailProvider ||--o| EmailWarmup : has
    EmailProvider ||--o{ ExternalEmailMessage : syncs
    EmailProvider ||--o{ ExternalEmailLabel : provides

    EmailLabel }o--|| User : belongs_to
    EmailLabel ||--o{ EmailLabelAssignment : applied_to

    EmailLabelAssignment }o--|| Email : tags
    EmailLabelAssignment }o--|| EmailLabel : uses

    EmailWarmup ||--|| EmailProvider : warms
    EmailWarmup ||--o{ WarmupActivity : tracks

    ExternalEmailMessage }o--|| User : belongs_to
    ExternalEmailMessage }o--|| EmailProvider : from

    ExternalEmailLabel }o--|| User : belongs_to
    ExternalEmailLabel }o--|| EmailProvider : from

    Mailbox }o--|| User : belongs_to

    UserSession }o--|| User : authenticates

    VerificationToken }o--|| User : verifies

    AuditLog }o--o| User : logs

    PhoneVerification }o--|| User : verifies

    Contact }o--|| User : belongs_to

    Template }o--|| User : belongs_to

    EmailFilter }o--|| User : belongs_to

    EmailFolder }o--|| User : belongs_to

    Attachment }o--|| Email : attached_to

    EmailAnalytics ||--|| Email : analyzes

    WarmupActivity }o--|| EmailWarmup : records

    User {
        uuid id PK
        string email UK
        string password
        string name
        string role
        boolean isEmailVerified
        string phoneNumber
        boolean isPhoneVerified
        int failedLoginAttempts
        timestamp lastLoginAt
        timestamp lockoutUntil
        string googleSub UK
        string activeInboxType
        string activeInboxId
        timestamp createdAt
        timestamp updatedAt
    }

    Email {
        uuid id PK
        string subject
        text body
        string from
        array to
        string status
        boolean isImportant
        uuid userId FK
        uuid providerId FK
        uuid folderId FK
        timestamp scheduledAt
        timestamp createdAt
        timestamp updatedAt
    }

    EmailProvider {
        uuid id PK
        string type
        string email
        string displayName
        boolean isActive
        timestamp lastSyncedAt
        string status
        string host
        int port
        string password
        text accessToken
        text refreshToken
        timestamp tokenExpiry
        string gmailHistoryId
        uuid userId FK
        timestamp createdAt
        timestamp updatedAt
    }

    EmailAnalytics {
        uuid id PK
        uuid emailId FK UK
        int openCount
        int clickCount
        timestamp createdAt
        timestamp updatedAt
    }

    Contact {
        uuid id PK
        string name
        string email
        string phone
        uuid userId FK
        timestamp createdAt
        timestamp updatedAt
    }

    Template {
        uuid id PK
        string name
        string subject
        text body
        jsonb metadata
        uuid userId FK
        timestamp createdAt
        timestamp updatedAt
    }

    Feature {
        uuid id PK
        string name UK
        boolean isActive
        timestamp createdAt
        timestamp updatedAt
    }

    Mailbox {
        uuid id PK
        uuid userId FK
        string localPart
        string domain
        string email UK
        string status
        int quotaLimitMb
        bigint usedBytes
        string smtpHost
        int smtpPort
        string imapHost
        int imapPort
        string username
        string passwordEnc
        string passwordIv
        timestamp createdAt
        timestamp updatedAt
    }

    UserSession {
        uuid id PK
        uuid userId FK
        string refreshTokenHash UK
        string userAgent
        string ip
        timestamp createdAt
        timestamp expiresAt
        timestamp revokedAt
        string revokedReason
    }

    VerificationToken {
        uuid id PK
        uuid userId FK
        string token UK
        string type
        timestamp expiresAt
        timestamp consumedAt
        timestamp createdAt
    }

    AuditLog {
        uuid id PK
        uuid userId FK
        string action
        jsonb metadata
        string ip
        string userAgent
        timestamp createdAt
    }

    PhoneVerification {
        uuid id PK
        uuid userId FK
        string phoneNumber
        string code
        int attempts
        timestamp expiresAt
        timestamp consumedAt
        timestamp createdAt
    }

    SignupVerification {
        uuid id PK
        string phoneNumber
        string code
        int attempts
        timestamp expiresAt
        timestamp consumedAt
        timestamp createdAt
    }

    EmailFilter {
        uuid id PK
        string name
        jsonb rules
        uuid userId FK
        timestamp createdAt
        timestamp updatedAt
    }

    EmailFolder {
        uuid id PK
        string name
        uuid userId FK
        timestamp createdAt
        timestamp updatedAt
    }

    EmailLabel {
        uuid id PK
        string name
        string color
        uuid userId FK
        timestamp createdAt
        timestamp updatedAt
    }

    EmailLabelAssignment {
        uuid id PK
        uuid emailId FK
        uuid labelId FK
        timestamp createdAt
    }

    Attachment {
        uuid id PK
        string filename
        string contentType
        int size
        string url
        uuid emailId FK
        timestamp createdAt
        timestamp updatedAt
    }

    EmailWarmup {
        uuid id PK
        uuid providerId FK UK
        string status
        int currentDailyLimit
        int dailyIncrement
        int maxDailyEmails
        int minimumInterval
        int targetOpenRate
        timestamp startedAt
        timestamp lastRunAt
        timestamp createdAt
        timestamp updatedAt
    }

    WarmupActivity {
        uuid id PK
        uuid warmupId FK
        int emailsSent
        float openRate
        timestamp date
        timestamp createdAt
        timestamp updatedAt
    }

    ExternalEmailMessage {
        uuid id PK
        uuid userId FK
        uuid providerId FK
        string externalMessageId
        string threadId
        string from
        array to
        string subject
        text snippet
        timestamp internalDate
        array labels
        jsonb rawPayload
        timestamp createdAt
        timestamp updatedAt
    }

    ExternalEmailLabel {
        uuid id PK
        uuid userId FK
        uuid providerId FK
        string externalLabelId
        string name
        string type
        string color
        boolean isSystem
        timestamp createdAt
        timestamp updatedAt
    }
```

## Relationship Types

### One-to-Many (||--o{)
- User → Contact, Email, EmailProvider, etc.
- Email → Attachment, EmailLabelAssignment
- EmailProvider → Email, ExternalEmailMessage
- EmailLabel → EmailLabelAssignment
- EmailWarmup → WarmupActivity

### One-to-One (||--||)
- Email ↔ EmailAnalytics
- EmailProvider ↔ EmailWarmup

### Many-to-One (}o--||)
- Email → User
- Email → EmailProvider
- EmailProvider → User
- Contact → User
- etc.

### Optional Relations (}o--o|)
- Email → EmailFolder (optional)
- Email → EmailProvider (optional)
- AuditLog → User (optional - can log without user)

## Key Indexes

### User
- `email` (unique)
- `googleSub` (unique)
- `id` (primary key)

### Email
- `userId` (foreign key index)
- `providerId` (foreign key index)
- `folderId` (foreign key index)

### EmailProvider
- `userId` (foreign key index)

### UserSession
- `userId` (foreign key index)
- `refreshTokenHash` (unique)

### VerificationToken
- `userId, type` (composite index)
- `token` (unique)

### ExternalEmailMessage
- `providerId, externalMessageId` (unique composite)
- `userId` (index)
- `providerId` (index)

### ExternalEmailLabel
- `providerId, externalLabelId` (unique composite)
- `userId` (index)
- `providerId` (index)

### EmailLabelAssignment
- `emailId, labelId` (unique composite)

### WarmupActivity
- `warmupId, date` (unique composite)

### Mailbox
- `localPart, domain` (unique composite)
- `email` (unique)
- `userId` (index)

## Data Flow Patterns

### Authentication Flow
```
User → UserSession (JWT refresh tokens)
User → VerificationToken (email/password reset)
User → AuditLog (security events)
```

### Email Sending Flow
```
User → Email → EmailProvider
Email → EmailAnalytics (tracking)
Email → Attachment (files)
Email → EmailLabelAssignment → EmailLabel (organization)
```

### External Email Sync Flow
```
User → EmailProvider → ExternalEmailMessage
EmailProvider → ExternalEmailLabel
```

### Email Warmup Flow
```
EmailProvider → EmailWarmup → WarmupActivity
```

### Inbox Management Flow
```
User → Mailbox (self-hosted)
User → EmailProvider (external)
User.activeInboxType + User.activeInboxId (current selection)
```

## Cascade Behaviors

TypeORM handles cascading deletes through relationships:

- Deleting User cascades to: Sessions, Tokens, AuditLogs, Emails, Providers, etc.
- Deleting Email cascades to: Analytics, Attachments, LabelAssignments
- Deleting EmailProvider cascades to: Warmup, ExternalMessages, ExternalLabels

## JSON/JSONB Fields

Several entities use JSON columns for flexible data:

- `EmailFilter.rules` - Filter rule definitions
- `Template.metadata` - Template variables
- `AuditLog.metadata` - Event context
- `ExternalEmailMessage.rawPayload` - Full provider response

## Array Fields

PostgreSQL array columns:

- `Email.to` - Multiple recipients
- `ExternalEmailMessage.to` - Multiple recipients
- `ExternalEmailMessage.labels` - Gmail label IDs

---

**Last Updated**: January 2026  
**Total Entities**: 24  
**Total Relationships**: 40+
