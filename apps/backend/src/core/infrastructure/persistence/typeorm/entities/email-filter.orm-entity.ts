// apps/backend/src/core/infrastructure/persistence/typeorm/entities/email-filter.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'email_filters' })
@Index(['workspaceId'])
export class EmailFilterOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column() name: string;
  @Column({ type: 'jsonb' }) conditions: unknown[];
  @Column({ type: 'jsonb' }) actions: unknown[];
  @Column({ type: 'int', default: 0 }) priority: number;
  @Column({ default: true }) enabled: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
