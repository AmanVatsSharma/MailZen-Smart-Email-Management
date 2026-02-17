import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthAlertDeliveryDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
