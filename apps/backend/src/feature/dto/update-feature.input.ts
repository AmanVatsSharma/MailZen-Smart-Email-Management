import { InputType, Field, ID, Int } from '@nestjs/graphql';

@InputType()
export class UpdateFeatureInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  targetType?: string;

  @Field({ nullable: true })
  targetValue?: string;

  @Field(() => Int, { nullable: true })
  rolloutPercentage?: number;
}
