// apps/backend/src/core/infrastructure/persistence/typeorm/entities/workspace.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'workspaces' })
@Index(['slug'], { unique: true })
export class WorkspaceOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() slug: string;
  @Column() name: string;
  @Column('uuid') ownerId: string;
  @Column({ type: 'uuid', nullable: true }) planId: string | null;
  @Column({ default: false }) archived: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
