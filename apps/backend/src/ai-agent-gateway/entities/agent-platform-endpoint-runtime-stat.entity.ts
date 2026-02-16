import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agent_platform_endpoint_runtime_stats')
export class AgentPlatformEndpointRuntimeStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  endpointUrl: string;

  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'int', default: 0 })
  failureCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastSuccessAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastFailureAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
