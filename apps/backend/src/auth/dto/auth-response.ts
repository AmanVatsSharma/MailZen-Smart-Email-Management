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
} 