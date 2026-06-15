// apps/backend/src/core/infrastructure/persistence/typeorm/entities/tracking-link.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'tracking_links' })
@Index(['emailId'])
@Index(['hash'], { unique: true })
export class TrackingLinkOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') emailId: string;
  @Column({ length: 64, unique: true }) hash: string;
  @Column({ type: 'text' }) url: string;
  @Column({ type: 'int', default: 0 }) clickCount: number;
  @Column({ type: 'jsonb', default: () => "'[]'" }) clickedBy: Array<{ ip: string; userAgent: string; at: Date }>;
  @CreateDateColumn() createdAt: Date;
}
