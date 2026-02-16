import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthIncidentDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
