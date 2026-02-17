import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncIncidentAlertHistoryDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
