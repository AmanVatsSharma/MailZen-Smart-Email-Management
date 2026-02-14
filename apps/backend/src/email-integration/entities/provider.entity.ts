import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * Frontend-aligned provider shape (matches `apps/frontend/lib/providers/provider-utils.ts`).
 *
 * NOTE: This is intentionally separate from `EmailProvider` to avoid breaking
 * existing GraphQL schema/consumers that rely on the older shape.
 */
@ObjectType()
export class Provider {
  @Field(() => ID)
  id: string;

  /**
   * Lowercase provider type expected by frontend: 'gmail' | 'outlook' | 'smtp'
   */
  @Field()
  type: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  lastSynced?: string;

  /**
   * 'connected' | 'syncing' | 'error' | 'disconnected'
   */
  @Field()
  status: string;
}
