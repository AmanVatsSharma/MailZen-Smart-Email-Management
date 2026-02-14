import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../../user/entities/user.entity';

@ObjectType()
export class AuthMeResponse {
  @Field(() => User, { nullable: true })
  user?: User | null;

  @Field(() => Boolean)
  hasMailzenAlias: boolean;

  @Field(() => Boolean)
  requiresAliasSetup: boolean;

  @Field({ nullable: true })
  nextStep?: string;
}
