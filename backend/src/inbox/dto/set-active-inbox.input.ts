import { Field, InputType } from '@nestjs/graphql';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class SetActiveInboxInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @IsIn(['MAILBOX', 'PROVIDER'])
  type: 'MAILBOX' | 'PROVIDER';

  @Field()
  @IsNotEmpty()
  @IsString()
  id: string;
}

