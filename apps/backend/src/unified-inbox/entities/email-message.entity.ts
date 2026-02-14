import { Field, ID, ObjectType } from '@nestjs/graphql';
import { EmailAttachment } from './email-attachment.entity';
import { EmailParticipant } from './email-participant.entity';

@ObjectType()
export class EmailMessage {
  @Field(() => ID)
  id: string;

  @Field()
  threadId: string;

  @Field()
  subject: string;

  @Field(() => EmailParticipant)
  from: EmailParticipant;

  @Field(() => [EmailParticipant])
  to: EmailParticipant[];

  @Field(() => [EmailParticipant], { nullable: true })
  cc?: EmailParticipant[];

  @Field(() => [EmailParticipant], { nullable: true })
  bcc?: EmailParticipant[];

  /**
   * HTML string; safe rendering is handled client-side.
   */
  @Field()
  content: string;

  @Field()
  contentPreview: string;

  /**
   * ISO string
   */
  @Field()
  date: string;

  @Field()
  folder: string;

  @Field()
  isStarred: boolean;

  @Field()
  importance: string;

  @Field(() => [EmailAttachment])
  attachments: EmailAttachment[];

  @Field()
  status: string;

  @Field(() => [String], { nullable: true })
  labelIds?: string[];

  @Field()
  providerId: string;

  @Field({ nullable: true })
  providerEmailId?: string;
}
