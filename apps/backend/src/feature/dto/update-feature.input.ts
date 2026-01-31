import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class UpdateFeatureInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  isActive?: boolean;
} 