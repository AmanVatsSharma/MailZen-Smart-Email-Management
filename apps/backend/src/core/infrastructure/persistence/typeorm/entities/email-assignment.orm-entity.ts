// apps/backend/src/core/infrastructure/persistence/typeorm/entities/email-assignment.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'email_assignments' })
@Index(['emailId'])
@Index(['assigneeId', 'status'])
export class EmailAssignmentOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') emailId: string;
  @Column('uuid') assigneeId: string;
  @Column('uuid') workspaceId: string;
  @Column() status: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
