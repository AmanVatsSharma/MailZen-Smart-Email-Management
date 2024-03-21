import { Field, ObjectType, ID } from '@nestjs/graphql';

@ObjectType()
export class ScheduledEmail {
  @Field(() => ID)
  id: string;

  @Field()
  subject: string;

  @Field()
  body: string;

  @Field(() => [String])
  recipientIds: string[];

  @Field()
  scheduledAt: Date;

  @Field()
  status: string; // e.g., 'PENDING', 'SENT'
} 