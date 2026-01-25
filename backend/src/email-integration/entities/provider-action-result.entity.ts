import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderActionResult {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

