import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
