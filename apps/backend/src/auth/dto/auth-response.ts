import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../../user/entities/user.entity';

@ObjectType()
export class AuthResponse {
  @Field()
  token: string;

  @Field({ nullable: true })
  refreshToken?: string;

  @Field(() => User)
  user: User;

  @Field(() => Boolean, { defaultValue: false })
  requiresAliasSetup: boolean;

  @Field(() => Boolean, { defaultValue: true })
  hasMailzenAlias: boolean;

  @Field({ nullable: true })
  nextStep?: string;
}
