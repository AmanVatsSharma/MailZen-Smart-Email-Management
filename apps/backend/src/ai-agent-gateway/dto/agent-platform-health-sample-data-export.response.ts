import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthSampleDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
