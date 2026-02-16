import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthAlertRunHistoryDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
