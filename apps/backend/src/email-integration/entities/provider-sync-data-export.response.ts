import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
