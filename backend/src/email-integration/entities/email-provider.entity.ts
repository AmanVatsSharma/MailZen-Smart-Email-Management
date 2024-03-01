import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Email } from '../../email/entities/email.entity';

@ObjectType()
export class EmailProvider {
  @Field(() => ID)
  id: string;
  
  @Field()
  type: string;
  
  @Field()
  email: string;
  
  @Field({ nullable: true })
  host?: string;
  
  @Field(() => Int, { nullable: true })
  port?: number;
  
  // We don't expose password or accessToken for security reasons
  
  // Add new fields for OAuth refresh token handling
  // These are also not exposed in the GraphQL schema for security reasons

  @Field()
  userId: string;
  
  @Field(() => [Email], { nullable: true })
  emails?: Email[];
  
  @Field()
  createdAt: Date;
  
  @Field()
  updatedAt: Date;
} 