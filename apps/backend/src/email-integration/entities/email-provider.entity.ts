import { ObjectType, Field, ID } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Email } from '../../email/entities/email.entity';
import { EmailWarmup } from '../../email/entities/email-warmup.entity';
import { ExternalEmailMessage } from './external-email-message.entity';
import { ExternalEmailLabel } from './external-email-label.entity';

/**
 * EmailProvider Entity - External email provider configuration (Gmail, Outlook, SMTP)
 * Manages OAuth tokens and connection settings for email integration
 */
@ObjectType()
@Entity('email_providers')
export class EmailProvider {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  type: string; // GMAIL, OUTLOOK, CUSTOM_SMTP

  @Field()
  @Column()
  email: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  displayName?: string;

  @Field()
  @Column({ default: false })
  isActive: boolean;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Field()
  @Column({ default: 'connected' })
  status: string; // connected | syncing | error | disconnected

  @Column({ nullable: true })
  host?: string;

  @Column({ type: 'int', nullable: true })
  port?: number;

  @Column({ nullable: true })
  password?: string;

  @Column({ type: 'text', nullable: true })
  accessToken?: string;

  @Column({ type: 'text', nullable: true })
  refreshToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiry?: Date;

  @Column({ nullable: true })
  gmailHistoryId?: string;

  @Column()
  @Index()
  userId: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  @Index()
  workspaceId?: string | null;

  @ManyToOne(() => User, (user) => user.providers)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Email, (email) => email.provider)
  emails: Email[];

  @OneToOne(() => EmailWarmup, (warmup) => warmup.provider, { nullable: true })
  warmup?: EmailWarmup;

  @OneToMany(() => ExternalEmailMessage, (message) => message.provider)
  externalMessages: ExternalEmailMessage[];

  @OneToMany(() => ExternalEmailLabel, (label) => label.provider)
  externalLabels: ExternalEmailLabel[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
