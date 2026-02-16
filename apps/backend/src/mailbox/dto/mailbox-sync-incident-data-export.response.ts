import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncIncidentDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
