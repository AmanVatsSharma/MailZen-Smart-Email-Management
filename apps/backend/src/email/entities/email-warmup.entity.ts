import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { EmailProvider } from '../../email-integration/entities/email-provider.entity';
import { WarmupActivity } from './warmup-activity.entity';

/**
 * EmailWarmup Entity - Email warmup campaign configuration
 * Gradually increases sending volume to build sender reputation
 */
@Entity('email_warmups')
export class EmailWarmup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  providerId: string;

  @OneToOne(() => EmailProvider, provider => provider.warmup)
  @JoinColumn({ name: 'providerId' })
  provider: EmailProvider;

  @Column({ default: 'PENDING' })
  status: string; // PENDING, ACTIVE, PAUSED, COMPLETED

  @Column({ default: 5 })
  currentDailyLimit: number;

  @Column({ default: 5 })
  dailyIncrement: number;

  @Column({ default: 100 })
  maxDailyEmails: number;

  @Column({ default: 15 })
  minimumInterval: number;

  @Column({ default: 80 })
  targetOpenRate: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WarmupActivity, activity => activity.warmup)
  activities: WarmupActivity[];
}
