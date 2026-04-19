/**
 * File:        apps/backend/src/unified-inbox/entities/email-thread.entity.ts
 * Module:      Unified Inbox · GraphQL Response Types
 * Purpose:     GraphQL ObjectType representing a single email thread (or singleton message)
 *              returned by listThreads and getThread resolvers.
 *
 * Exports:
 *   - EmailThread — GraphQL ObjectType with thread-level fields and nested message list.
 *                   Not a TypeORM entity — no @Column decorators. All fields are GQL-only.
 *
 * Depends on:
 *   - ./email-message.entity   — EmailMessage shape (individual messages within the thread)
 *   - ./email-participant.entity — EmailParticipant shape (from/to actors)
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - aiPriority / aiCategory / aiSummary are populated only for MAILBOX-sourced threads
 *     (read from the Email entity). For PROVIDER-sourced threads these are undefined
 *     until an AI scoring pass runs and sets them on the Email row.
 *   - labelIds contains provider system labels (e.g. 'INBOX', 'UNREAD') for provider
 *     threads and custom label UUIDs for mailbox threads.
 *
 * Read order:
 *   1. EmailThread — full field set (start here)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { EmailMessage } from './email-message.entity';
import { EmailParticipant } from './email-participant.entity';

@ObjectType()
export class EmailThread {
  /**
   * Thread identifier. For Gmail this is typically the Gmail `threadId`.
   * If a provider doesn't support threads, we fall back to a message-scoped id.
   */
  @Field(() => ID)
  id: string;

  @Field()
  subject: string;

  @Field(() => [EmailParticipant])
  participants: EmailParticipant[];

  /**
   * ISO string for the latest message in the thread.
   */
  @Field()
  lastMessageDate: string;

  @Field()
  isUnread: boolean;

  @Field(() => [EmailMessage])
  messages: EmailMessage[];

  /**
   * UI folder string: inbox|sent|drafts|trash|spam|archive
   */
  @Field()
  folder: string;

  /**
   * Provider label ids (e.g. Gmail label ids)
   */
  @Field(() => [String], { nullable: true })
  labelIds?: string[];

  @Field()
  providerId: string;

  @Field({ nullable: true })
  providerThreadId?: string;

  /**
   * AI-assigned priority bucket: 'HIGH' | 'MEDIUM' | 'LOW'.
   * Populated for MAILBOX-sourced threads from Email.aiPriority.
   * Undefined for PROVIDER-sourced threads until an AI scoring pass runs.
   */
  @Field(() => String, { nullable: true })
  aiPriority?: string;

  /**
   * AI-assigned category (e.g. 'newsletter', 'urgent_issue', 'coordination').
   * Populated for MAILBOX-sourced threads from Email.aiCategory.
   */
  @Field(() => String, { nullable: true })
  aiCategory?: string;

  /**
   * Short AI-generated plain-text summary of the thread.
   * Populated for MAILBOX-sourced threads from Email.aiSummary.
   */
  @Field(() => String, { nullable: true })
  aiSummary?: string;
}
