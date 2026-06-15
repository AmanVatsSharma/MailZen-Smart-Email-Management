// apps/backend/src/core/infrastructure/persistence/typeorm/entities/automation-run.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'automation_runs' })
@Index(['automationId', 'version'])
@Index(['workspaceId', 'startedAt'])
export class AutomationRunOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') automationId: string;
  @Column('int') version: number;
  @Column('uuid') workspaceId: string;
  @Column({ type: 'jsonb' }) triggerPayload: unknown;
  @Column({ type: 'jsonb' }) conditionResults: unknown[];
  @Column({ type: 'jsonb' }) actionResults: unknown[];
  @Column() status: string;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'timestamptz' }) startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
