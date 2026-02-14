import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { EmailWarmup } from './email-warmup.entity';

/**
 * WarmupActivity Entity - Daily warmup campaign activity tracking
 * Records emails sent and engagement metrics per day
 */
@Entity('warmup_activities')
@Unique(['warmupId', 'date'])
export class WarmupActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  warmupId: string;

  @ManyToOne(() => EmailWarmup, (warmup) => warmup.activities)
  @JoinColumn({ name: 'warmupId' })
  warmup: EmailWarmup;

  @Column({ default: 0 })
  emailsSent: number;

  @Column({ type: 'float', default: 0 })
  openRate: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
