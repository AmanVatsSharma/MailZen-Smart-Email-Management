import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

type EndpointRuntimeStatPayload = {
  endpointUrl: string;
  successCount: number;
  failureCount: number;
  lastSuccessAtIso?: string;
  lastFailureAtIso?: string;
};

type SkillRuntimeStatPayload = {
  skill: string;
  totalRequests: number;
  failedRequests: number;
  timeoutFailures: number;
  avgLatencyMs: number;
  lastLatencyMs: number;
  errorRatePercent: number;
  lastErrorAtIso?: string;
};

@Entity('agent_platform_health_samples')
export class AgentPlatformHealthSample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  status: string;

  @Column({ default: false })
  reachable: boolean;

  @Column()
  serviceUrl: string;

  @Column({ type: 'timestamptz' })
  @Index()
  checkedAt: Date;

  @Column({ type: 'int', default: 0 })
  requestCount: number;

  @Column({ type: 'int', default: 0 })
  errorCount: number;

  @Column({ type: 'int', default: 0 })
  timeoutErrorCount: number;

  @Column({ type: 'double precision', default: 0 })
  errorRatePercent: number;

  @Column({ type: 'double precision', default: 0 })
  avgLatencyMs: number;

  @Column({ type: 'double precision', default: 0 })
  latencyWarnMs: number;

  @Column({ type: 'double precision', default: 0 })
  errorRateWarnPercent: number;

  @Column()
  alertingState: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  configuredServiceUrls: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  probedServiceUrls: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  endpointStats: EndpointRuntimeStatPayload[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  skillStats: SkillRuntimeStatPayload[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
