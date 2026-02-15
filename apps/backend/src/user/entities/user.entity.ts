import { ObjectType, Field, ID } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';
import { Email } from '../../email/entities/email.entity';
import { EmailProvider } from '../../email-integration/entities/email-provider.entity';
import { ExternalEmailMessage } from '../../email-integration/entities/external-email-message.entity';
import { ExternalEmailLabel } from '../../email-integration/entities/external-email-label.entity';
import { EmailFilter } from '../../email/entities/email-filter.entity';
import { EmailFolder } from '../../email/entities/email-folder.entity';
import { EmailLabel } from '../../email/entities/email-label.entity';
import { Template } from '../../template/entities/template.entity';
import { UserSession } from '../../auth/entities/user-session.entity';
import { VerificationToken } from '../../auth/entities/verification-token.entity';
import { AuditLog } from '../../auth/entities/audit-log.entity';
import { Mailbox } from '../../mailbox/entities/mailbox.entity';
import { PhoneVerification } from '../../phone/entities/phone-verification.entity';

/**
 * User Entity - Core user account with authentication and profile data
 * Supports both password-based and OAuth (Google) authentication
 */
@ObjectType()
@Entity('users')
export class User {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  @Index()
  email: string;

  // Password may be null for OAuth-only accounts (Google login, etc.)
  @Column({ nullable: true })
  password?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  name?: string;

  @Field()
  @Column({ default: 'USER' })
  role: string;

  @Field()
  @Column({ default: false })
  isEmailVerified: boolean;

  @Field({ nullable: true })
  @Column({ nullable: true })
  phoneNumber?: string;

  @Field()
  @Column({ default: false })
  isPhoneVerified: boolean;

  // Security: Failed login tracking
  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastFailedLoginAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lockoutUntil?: Date;

  @Column({ type: 'timestamp', nullable: true })
  passwordUpdatedAt?: Date;

  // OAuth subject for Google Sign-In (stable per Google account)
  @Column({ unique: true, nullable: true })
  @Index()
  googleSub?: string;

  // Persisted inbox selection for multi-inbox switching
  @Column({ type: 'varchar', nullable: true })
  activeInboxType?: 'MAILBOX' | 'PROVIDER';

  @Column({ nullable: true })
  activeInboxId?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  activeWorkspaceId?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => Contact, (contact) => contact.user)
  contacts: Contact[];

  @OneToMany(() => Email, (email) => email.user)
  emails: Email[];

  @OneToMany(() => EmailProvider, (provider) => provider.user)
  providers: EmailProvider[];

  @OneToMany(() => ExternalEmailMessage, (message) => message.user)
  externalMessages: ExternalEmailMessage[];

  @OneToMany(() => EmailFilter, (filter) => filter.user)
  filters: EmailFilter[];

  @OneToMany(() => EmailFolder, (folder) => folder.user)
  folders: EmailFolder[];

  @OneToMany(() => EmailLabel, (label) => label.user)
  labels: EmailLabel[];

  @OneToMany(() => ExternalEmailLabel, (label) => label.user)
  externalLabels: ExternalEmailLabel[];

  @OneToMany(() => Template, (template) => template.user)
  templates: Template[];

  @OneToMany(() => UserSession, (session) => session.user)
  sessions: UserSession[];

  @OneToMany(() => VerificationToken, (token) => token.user)
  verificationTokens: VerificationToken[];

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];

  @OneToMany(() => Mailbox, (mailbox) => mailbox.user)
  mailboxes: Mailbox[];

  @OneToMany(() => PhoneVerification, (verification) => verification.user)
  phoneVerifications: PhoneVerification[];
}
