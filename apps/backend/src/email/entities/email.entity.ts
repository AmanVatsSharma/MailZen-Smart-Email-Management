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
import { EmailProvider } from '../../email-integration/entities/email-provider.entity';
import { EmailFolder } from './email-folder.entity';
import { EmailLabelAssignment } from './email-label-assignment.entity';
import { Attachment } from './attachment.entity';
import { EmailAnalytics } from '../../email-analytics/entities/email-analytics.entity';

/**
 * Email Entity - Core email message with tracking and relationships
 * Supports drafts, scheduled sends, and delivery tracking
 */
@ObjectType()
@Entity('emails')
export class Email {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  subject: string;

  @Field()
  @Column({ type: 'text' })
  body: string;

  @Field()
  @Column()
  from: string;

  @Field(() => [String])
  @Column('text', { array: true })
  to: string[];

  @Column({ nullable: true })
  @Index()
  inboundMessageId?: string | null;

  @Column({ nullable: true })
  @Index()
  inboundThreadKey?: string | null;

  @Field()
  @Column({ default: 'DRAFT' })
  status: string;

  @Field()
  @Column({ default: false })
  isImportant: boolean;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, (user) => user.emails)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  @Index()
  providerId?: string;

  @ManyToOne(() => EmailProvider, (provider) => provider.emails, {
    nullable: true,
  })
  @JoinColumn({ name: 'providerId' })
  provider?: EmailProvider;

  @Column({ nullable: true })
  @Index()
  folderId?: string;

  @ManyToOne(() => EmailFolder, (folder) => folder.emails, { nullable: true })
  @JoinColumn({ name: 'folderId' })
  folder?: EmailFolder;

  @OneToMany(() => EmailLabelAssignment, (assignment) => assignment.email)
  labels: EmailLabelAssignment[];

  @OneToMany(() => Attachment, (attachment) => attachment.email)
  attachments: Attachment[];

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => EmailAnalytics, (analytics) => analytics.email, {
    nullable: true,
  })
  analytics?: EmailAnalytics;
}
