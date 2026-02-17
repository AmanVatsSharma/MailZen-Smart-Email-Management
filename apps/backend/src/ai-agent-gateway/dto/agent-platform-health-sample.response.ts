import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import {
  AgentPlatformEndpointStatResponse,
  AgentPlatformSkillStatResponse,
} from './agent-platform-health.response';

@ObjectType()
export class AgentPlatformHealthSampleResponse {
  @Field()
  status: string;

  @Field()
  reachable: boolean;

  @Field()
  serviceUrl: string;

  @Field(() => [String])
  configuredServiceUrls: string[];

  @Field(() => [String])
  probedServiceUrls: string[];

  @Field(() => [AgentPlatformEndpointStatResponse])
  endpointStats: AgentPlatformEndpointStatResponse[];

  @Field(() => [AgentPlatformSkillStatResponse])
  skillStats: AgentPlatformSkillStatResponse[];

  @Field()
  checkedAtIso: string;

  @Field(() => Int)
  requestCount: number;

  @Field(() => Int)
  errorCount: number;

  @Field(() => Int)
  timeoutErrorCount: number;

  @Field(() => Float)
  errorRatePercent: number;

  @Field(() => Float)
  avgLatencyMs: number;

  @Field(() => Float)
  latencyWarnMs: number;

  @Field(() => Float)
  errorRateWarnPercent: number;

  @Field()
  alertingState: string;
}
