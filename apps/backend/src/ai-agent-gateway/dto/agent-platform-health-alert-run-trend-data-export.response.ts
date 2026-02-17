import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthAlertRunTrendDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
