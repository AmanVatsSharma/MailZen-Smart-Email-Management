import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxInboundSlaIncidentDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
