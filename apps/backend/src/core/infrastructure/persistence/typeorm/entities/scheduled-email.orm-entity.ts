// apps/backend/src/core/infrastructure/persistence/typeorm/entities/scheduled-email.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'scheduled_emails' })
@Index(['status', 'sendAt'])
export class ScheduledEmailOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') emailId: string;
  @Column('uuid') workspaceId: string;
  @Column() status: string;
  @Column({ type: 'timestamptz' }) sendAt: Date;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  @Column({ type: 'timestamptz', nullable: true }) sentAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) canceledAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
