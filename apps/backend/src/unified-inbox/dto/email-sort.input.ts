import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class EmailSortInput {
  @Field()
  field: 'date' | 'from' | 'subject' | 'importance';

  @Field()
  direction: 'asc' | 'desc';
}
