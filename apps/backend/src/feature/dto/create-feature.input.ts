import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateFeatureInput {
  @Field()
  name: string;

  @Field({ defaultValue: false })
  isActive: boolean;
} 