// apps/backend/src/core/infrastructure/persistence/typeorm/entities/tracking-pixel.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'tracking_pixels' })
@Index(['emailId'])
@Index(['hash'], { unique: true })
export class TrackingPixelOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') emailId: string;
  @Column({ length: 64, unique: true }) hash: string;
  @Column({ type: 'int', default: 0 }) openCount: number;
  @Column({ type: 'jsonb', default: () => "'[]'" }) openedBy: Array<{ ip: string; userAgent: string; at: Date }>;
  @CreateDateColumn() createdAt: Date;
}
