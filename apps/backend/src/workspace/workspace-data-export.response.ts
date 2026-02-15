import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class WorkspaceDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
