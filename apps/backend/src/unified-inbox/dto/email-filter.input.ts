/**
 * File:        apps/backend/src/unified-inbox/dto/email-filter.input.ts
 * Module:      Unified Inbox · GraphQL Input Types
 * Purpose:     GraphQL InputType carrying all thread-list filter criteria accepted
 *              by the listThreads resolver. Each field is optional/nullable.
 *
 * Exports:
 *   - EmailFilterInput — GraphQL InputType with per-field filter predicates
 *
 * Depends on:
 *   - none (only NestJS/GraphQL decorators)
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - aiPriority must match the exact stored value on Email.aiPriority
 *     (e.g. 'HIGH', 'MEDIUM', 'LOW') — case-sensitive comparison in service.
 *   - labelIds is an AND-filter: all specified ids must appear on the thread.
 *   - providerId, when set, overrides the user's active inbox source resolution.
 *
 * Read order:
 *   1. EmailFilterInput — all available filter fields
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */
import { Field, InputType } from '@nestjs/graphql';
import { IsIn, IsOptional } from 'class-validator';

@InputType()
export class EmailFilterInput {
  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  folder?: string;

  @Field(() => [String], { nullable: true })
  labelIds?: string[];

  @Field({ nullable: true })
  status?: 'read' | 'unread';

  @Field({ nullable: true })
  isStarred?: boolean;

  @Field({ nullable: true })
  providerId?: string;

  /**
   * Filter threads by AI-assigned priority. Accepts 'HIGH', 'MEDIUM', or 'LOW'.
   * For MAILBOX-sourced threads this is applied in-process after mapping.
   * For PROVIDER-sourced threads filtering by aiPriority uses an inner join on
   * the Email table, so only threads where an Email row with matching aiPriority
   * exists (i.e., after AI scoring) are returned — unscored messages are filtered out.
   */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(['HIGH', 'MEDIUM', 'LOW'])
  aiPriority?: string;
}
