import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NotificationDataExportResponse {
  @Field()
  generatedAtIso: string;

  @Field()
  dataJson: string;
}
