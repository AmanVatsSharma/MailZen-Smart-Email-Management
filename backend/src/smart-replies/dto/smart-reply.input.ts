import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

@InputType()
export class SmartReplyInput {
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Conversation text cannot be empty' })
  @MaxLength(5000, { message: 'Conversation text is too long, maximum 5000 characters' })
  conversation: string;
} 