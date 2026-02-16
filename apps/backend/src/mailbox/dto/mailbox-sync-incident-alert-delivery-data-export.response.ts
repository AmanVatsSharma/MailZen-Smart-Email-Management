import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncIncidentAlertDeliveryDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
