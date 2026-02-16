import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncIncidentAlertHistoryDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
