import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncIncidentAlertDeliveryDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
