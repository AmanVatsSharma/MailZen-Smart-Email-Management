import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SendRealEmailResponse {
  @Field()
  messageId: string;

  @Field(() => [String])
  accepted: string[];

  @Field(() => [String])
  rejected: string[];
}
