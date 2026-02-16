import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agent_platform_health_alert_runs')
export class AgentPlatformHealthAlertRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: true })
  alertsEnabled: boolean;

  @Column({ nullable: true })
  severity?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  reasons: string[];

  @Column({ type: 'int', default: 0 })
  windowHours: number;

  @Column({ type: 'int', default: 0 })
  baselineWindowHours: number;

  @Column({ type: 'int', default: 0 })
  cooldownMinutes: number;

  @Column({ type: 'int', default: 0 })
  minSampleCount: number;

  @Column({ type: 'double precision', default: 0 })
  anomalyMultiplier: number;

  @Column({ type: 'double precision', default: 0 })
  anomalyMinErrorDeltaPercent: number;

  @Column({ type: 'double precision', default: 0 })
  anomalyMinLatencyDeltaMs: number;

  @Column({ type: 'double precision', default: 0 })
  errorRateWarnPercent: number;

  @Column({ type: 'double precision', default: 0 })
  latencyWarnMs: number;

  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  @Column({ type: 'int', default: 0 })
  publishedCount: number;

  @Column({ type: 'timestamptz' })
  @Index()
  evaluatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
