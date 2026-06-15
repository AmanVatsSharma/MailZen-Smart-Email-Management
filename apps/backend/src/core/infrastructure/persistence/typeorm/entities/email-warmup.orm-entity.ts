// apps/backend/src/core/infrastructure/persistence/typeorm/entities/email-warmup.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'email_warmups' })
@Index(['mailboxId'], { unique: true })
export class EmailWarmupOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') mailboxId: string;
  @Column() status: string;
  @Column({ type: 'timestamptz' }) startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) endedAt: Date | null;
  @Column({ type: 'int', default: 0 }) dailyTarget: number;
  @Column({ type: 'int', default: 0 }) sentToday: number;
  @Column({ type: 'real', default: 0 }) healthScore: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
