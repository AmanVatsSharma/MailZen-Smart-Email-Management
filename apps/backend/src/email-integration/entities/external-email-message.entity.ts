import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { EmailProvider } from './email-provider.entity';

/**
 * ExternalEmailMessage Entity - Inbound/received messages synced from external providers
 * Stores Gmail and other provider messages with metadata for unified inbox
 */
@Entity('external_email_messages')
@Unique(['providerId', 'externalMessageId'])
export class ExternalEmailMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, (user) => user.externalMessages)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index()
  providerId: string;

  @ManyToOne(() => EmailProvider, (provider) => provider.externalMessages)
  @JoinColumn({ name: 'providerId' })
  provider: EmailProvider;

  @Column()
  externalMessageId: string;

  @Column({ nullable: true })
  threadId?: string;

  @Column({ nullable: true })
  from?: string;

  @Column('text', { array: true, default: [] })
  to: string[];

  @Column({ nullable: true })
  subject?: string;

  @Column({ type: 'text', nullable: true })
  snippet?: string;

  @Column({ type: 'timestamp', nullable: true })
  internalDate?: Date;

  @Column('text', { array: true, default: [] })
  labels: string[];

  // Raw payload from provider API (Gmail message object, etc.)
  @Column({ type: 'jsonb', nullable: true })
  rawPayload?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
