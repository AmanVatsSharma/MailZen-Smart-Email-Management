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
}

