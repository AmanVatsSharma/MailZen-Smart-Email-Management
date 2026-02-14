import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class EmailUpdateInput {
  @Field({ nullable: true })
  read?: boolean;

  @Field({ nullable: true })
  starred?: boolean;

  /**
   * inbox|archive|trash|spam
   */
  @Field({ nullable: true })
  folder?: string;

  @Field(() => [String], { nullable: true })
  addLabelIds?: string[];

  @Field(() => [String], { nullable: true })
  removeLabelIds?: string[];
}
