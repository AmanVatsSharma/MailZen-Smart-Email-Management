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
}
