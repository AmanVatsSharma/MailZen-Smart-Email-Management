import { Field, ObjectType, ID, HideField } from '@nestjs/graphql';
import { Email } from '../../email/entities/email.entity';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  phoneNumber?: string;

  @Field()
  isPhoneVerified: boolean;
  
  // Password is hidden from GraphQL responses
  @HideField()
  password?: string;

  // Relation to sent emails – this field can later be resolved properly
  @Field(() => [Email], { nullable: 'itemsAndList' })
  emailsSent?: Email[];
}