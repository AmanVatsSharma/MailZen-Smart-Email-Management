import { InputType, Field } from '@nestjs/graphql';
import { Int } from '@nestjs/graphql';

@InputType()
export class CreateFeatureInput {
  @Field()
  name: string;

  @Field({ defaultValue: false })
  isActive: boolean;

  @Field({ nullable: true, defaultValue: 'GLOBAL' })
  targetType?: string;

  @Field({ nullable: true })
  targetValue?: string;

  @Field(() => Int, { nullable: true, defaultValue: 100 })
  rolloutPercentage?: number;
}
