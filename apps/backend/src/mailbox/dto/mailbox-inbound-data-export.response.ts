import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxInboundDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
