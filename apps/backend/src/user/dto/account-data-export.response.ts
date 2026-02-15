import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AccountDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
