import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentActionDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
