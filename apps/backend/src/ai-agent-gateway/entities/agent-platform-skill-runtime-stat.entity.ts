import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agent_platform_skill_runtime_stats')
export class AgentPlatformSkillRuntimeStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  skill: string;

  @Column({ type: 'int', default: 0 })
  totalRequests: number;

  @Column({ type: 'int', default: 0 })
  failedRequests: number;

  @Column({ type: 'int', default: 0 })
  timeoutFailures: number;

  @Column({ type: 'bigint', default: 0 })
  totalLatencyMs: number;

  @Column({ type: 'int', default: 0 })
  lastLatencyMs: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastErrorAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
