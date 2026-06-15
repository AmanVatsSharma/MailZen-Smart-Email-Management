// apps/backend/src/core/infrastructure/persistence/typeorm/entities/triage-result.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'triage_results' })
@Index(['emailId'])
@Index(['workspaceId', 'priority'])
export class TriageResultOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') emailId: string;
  @Column('uuid') workspaceId: string;
  @Column() priority: string;
  @Column() category: string;
  @Column({ type: 'text' }) reasoning: string;
  @Column({ type: 'jsonb', default: () => "'[]'" }) suggestedActions: string[];
  @CreateDateColumn() createdAt: Date;
}
