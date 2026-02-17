import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncAlertDeliveryDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
