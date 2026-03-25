import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformRuntimeResetResponse {
  @Field(() => Int)
  clearedEndpoints: number;

  @Field(() => String, { nullable: true })
  scopedEndpointUrl: string | null;

  @Field()
  resetAtIso: string;
}
