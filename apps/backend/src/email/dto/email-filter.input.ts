import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';

export enum FilterCondition {
  CONTAINS = 'CONTAINS',
  EQUALS = 'EQUALS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
}

export enum FilterAction {
  MARK_READ = 'MARK_READ',
  MARK_IMPORTANT = 'MARK_IMPORTANT',
  MOVE_TO_FOLDER = 'MOVE_TO_FOLDER',
  APPLY_LABEL = 'APPLY_LABEL',
  FORWARD_TO = 'FORWARD_TO',
}

// Register enums with GraphQL so they can be used in @Field(() => EnumType)
registerEnumType(FilterCondition, { name: 'FilterCondition' });
registerEnumType(FilterAction, { name: 'FilterAction' });

@InputType()
export class EmailFilterRule {
  @Field()
  @IsString()
  field: string; // subject, from, to, body

  @Field(() => FilterCondition)
  @IsEnum(FilterCondition)
  condition: FilterCondition;

  @Field()
  @IsString()
  value: string;

  @Field(() => FilterAction)
  @IsEnum(FilterAction)
  action: FilterAction;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  actionValue?: string; // For MOVE_TO_FOLDER, APPLY_LABEL, FORWARD_TO
}

@InputType()
export class CreateEmailFilterInput {
  @Field()
  @IsString()
  name: string;

  @Field(() => [EmailFilterRule])
  @IsArray()
  rules: EmailFilterRule[];
}
