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
 * ExternalEmailLabel Entity - Provider-owned label metadata (Gmail system + user labels)
 * Used to render label names/colors in the unified inbox UI
 */
@Entity('external_email_labels')
@Unique(['providerId', 'externalLabelId'])
export class ExternalEmailLabel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, (user) => user.externalLabels)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index()
  providerId: string;

  @ManyToOne(() => EmailProvider, (provider) => provider.externalLabels)
  @JoinColumn({ name: 'providerId' })
  provider: EmailProvider;

  // Provider label id (e.g. Gmail label id: INBOX, STARRED, or a custom id)
  @Column()
  externalLabelId: string;

  @Column()
  name: string;

  // Gmail: "system" | "user"
  @Column()
  type: string;

  // Optional UI color (hex string)
  @Column({ default: '#4F46E5', nullable: true })
  color?: string;

  @Column({ default: false })
  isSystem: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
