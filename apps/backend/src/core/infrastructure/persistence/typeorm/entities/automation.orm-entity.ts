// apps/backend/src/core/infrastructure/persistence/typeorm/entities/automation.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm';

@Entity({ name: 'automations' })
@Index(['workspaceId', 'status'])
export class AutomationOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column() name: string;
  @Column({ type: 'jsonb' }) trigger: unknown;
  @Column({ type: 'jsonb' }) conditions: unknown[];
  @Column({ type: 'jsonb' }) actions: unknown[];
  @Column() status: string;
  @VersionColumn() version: number;
  @Column({ type: 'uuid', nullable: true }) parentVersionId: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
