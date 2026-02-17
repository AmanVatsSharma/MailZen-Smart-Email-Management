import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BillingDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
