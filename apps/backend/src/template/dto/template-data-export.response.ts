import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TemplateDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
