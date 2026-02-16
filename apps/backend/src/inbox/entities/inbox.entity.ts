import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Inbox {
  @Field(() => ID)
  id: string;

  /**
   * 'MAILBOX' | 'PROVIDER' (kept uppercase to match backend enum)
   */
  @Field()
  type: string;

  /**
   * Display address/identifier for UI (e.g. user@mailzen.com or user@gmail.com)
   */
  @Field()
  address: string;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  status?: string;

  /**
   * Runtime sync health for this inbox source.
   * Examples: connected | syncing | error | pending | disabled
   */
  @Field({ nullable: true })
  syncStatus?: string;

  /**
   * Last successful poll/sync timestamp when available.
   */
  @Field({ nullable: true })
  lastSyncedAt?: Date;

  /**
   * Last sync error message (PII-safe truncated string).
   */
  @Field({ nullable: true })
  lastSyncError?: string;

  /**
   * Timestamp when the latest sync error was observed.
   */
  @Field({ nullable: true })
  lastSyncErrorAt?: Date;

  /**
   * Provider/mail source kind:
   * - MAILBOX for internal mailbox aliases
   * - provider.type for external providers (GMAIL/OUTLOOK/CUSTOM_SMTP/...)
   */
  @Field({ nullable: true })
  sourceKind?: string;
}
