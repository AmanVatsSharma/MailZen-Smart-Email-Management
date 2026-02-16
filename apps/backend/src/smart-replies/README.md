# Smart Replies Module

## Overview

The Smart Replies module provides AI-powered response suggestions for emails and conversations. It helps users respond to messages more efficiently by generating contextually relevant reply suggestions.

## Features

- **Deterministic Model-Provider Generation**: Generate stable, reproducible replies for identical inputs
- **Suggested Replies**: Get multiple suggested replies for an email
- **Context-Aware Responses**: Responses are tailored to the content of the message
- **Conversation Logging**: Store conversations for future training and improvement
- **History Persistence Controls**: Persist smart reply history per-user with retention controls (`keepHistory`, `historyLength`)
- **Safety Guardrails**: Sensitive credential-like content is blocked with a safe response

## Architecture

The Smart Replies module follows a clean architecture pattern with the following components:

- **SmartReplyService**: Core business logic for generating replies
- **SmartReplyModelProvider**: Deterministic model-provider abstraction used by service
- **SmartReplyExternalModelAdapter**: Optional external LLM adapter with safe fallback
- **SmartReplyResolver**: GraphQL API for exposing functionality
- **DTOs**: Data Transfer Objects for input validation
- **TypeORM Integration**: Database-backed settings and conversation-related persistence
  - `smart_reply_settings`
  - `smart_reply_history`

## Flow

```mermaid
flowchart TD
  Client --> Resolver[SmartReplyResolver]
  Resolver --> Service[SmartReplyService]
  Service --> Settings[(smart_reply_settings)]
  Service --> Safety{Sensitive context?}
  Safety -->|yes| SafeReply[Return safe security response]
  Safety -->|no| ModelRouter{aiModel prefers external?}
  ModelRouter -->|yes| ExternalAdapter[SmartReplyExternalModelAdapter]
  ModelRouter -->|no| ModelProvider[SmartReplyModelProvider]
  ExternalAdapter -->|fallback| ModelProvider
  ModelProvider --> DeterministicCandidates[Deterministic candidate generation]
  DeterministicCandidates --> History[Persist smart_reply_history when keepHistory=true]
  History --> Retention[Prune history older than historyLength days]
  DeterministicCandidates --> Service
  Service --> Client
```

## External adapter flags

- `SMART_REPLY_USE_AGENT_PLATFORM` (`true/false`, default `false`)
- `SMART_REPLY_EXTERNAL_TIMEOUT_MS` (default `3000`)
- Reuses `AI_AGENT_PLATFORM_URL` and optional `AI_AGENT_PLATFORM_KEY`.

## API

### GraphQL Queries

#### Generate Smart Reply

```graphql
query {
  generateSmartReply(
    input: {
      conversation: "Hello, I'm interested in your product. Can you tell me more about pricing?"
    }
  )
}
```

Returns a single smart reply string.

#### Get Suggested Replies

```graphql
query {
  getSuggestedReplies(
    emailBody: "When can we schedule a meeting to discuss the project?"
    count: 3
  )
}
```

Returns an array of suggested reply strings.

#### My Smart Reply History

```graphql
query {
  mySmartReplyHistory(limit: 20) {
    id
    conversationPreview
    suggestions
    source
    blockedSensitive
    fallbackUsed
    createdAt
  }
}
```

Returns user-scoped smart-reply generation history rows.

#### Purge My Smart Reply History

```graphql
mutation {
  purgeMySmartReplyHistory {
    purgedRows
    executedAtIso
  }
}
```

Purges all smart-reply history records for the authenticated user.

## Operational runbook: smart reply history

1. Validate settings via `smartReplySettings`:
   - `keepHistory=true`
   - `historyLength` set to expected retention window (days)
2. Trigger generation with `generateSmartReply` or `getSuggestedReplies`.
3. Verify persisted rows in `mySmartReplyHistory(limit)`.
4. If records exceed retention policy:
   - verify history pruning by creating test rows older than retention cutoff
   - or run `purgeMySmartReplyHistory` for user-requested data deletion.

## Usage

1. Import the `SmartReplyModule` in your application module:

```typescript
import { Module } from '@nestjs/common';
import { SmartReplyModule } from './smart-replies/smart-reply.module';

@Module({
  imports: [SmartReplyModule],
})
export class AppModule {}
```

2. Inject the `SmartReplyService` in your service or controller:

```typescript
import { Injectable } from '@nestjs/common';
import { SmartReplyService } from '../smart-replies/smart-reply.service';

@Injectable()
export class EmailService {
  constructor(private readonly smartReplyService: SmartReplyService) {}

  async processEmail(emailBody: string, userId: string) {
    const suggestedReplies = await this.smartReplyService.getSuggestedReplies(
      emailBody,
      3,
      userId,
    );
    // Use the suggested replies
  }
}
```

## Future Enhancements

- External LLM provider adapter (OpenAI/Anthropic/Azure OpenAI) behind provider interface
- User feedback mechanism to improve reply quality
- Personalization based on user communication style
- Multi-language support
- Sentiment analysis for more appropriate responses

## Dependencies

- NestJS framework
- TypeORM
- GraphQL
- Class Validator
