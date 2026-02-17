import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformSkillRuntimeResetResponse {
  @Field(() => Int)
  clearedSkills: number;

  @Field({ nullable: true })
  scopedSkill: string | null;

  @Field()
  resetAtIso: string;
}
