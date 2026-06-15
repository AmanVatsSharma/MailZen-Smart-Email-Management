// apps/backend/src/core/infrastructure/persistence/typeorm/entities/notification.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'notifications' })
@Index(['userId', 'readAt'])
export class NotificationOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column() type: string;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column() channel: string;
  @Column({ type: 'timestamptz', nullable: true }) readAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
