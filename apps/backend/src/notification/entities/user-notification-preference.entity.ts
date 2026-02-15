import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity('user_notification_preferences')
export class UserNotificationPreference {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index({ unique: true })
  @Column()
  userId: string;

  @Field()
  @Column({ default: true })
  inAppEnabled: boolean;

  @Field()
  @Column({ default: true })
  emailEnabled: boolean;

  @Field()
  @Column({ default: false })
  pushEnabled: boolean;

  @Field()
  @Column({ default: true })
  syncFailureEnabled: boolean;

  @Field()
  @Column({ default: true })
  mailboxInboundAcceptedEnabled: boolean;

  @Field()
  @Column({ default: false })
  mailboxInboundDeduplicatedEnabled: boolean;

  @Field()
  @Column({ default: true })
  mailboxInboundRejectedEnabled: boolean;

  @Field(() => Float)
  @Column({ type: 'double precision', default: 99 })
  mailboxInboundSlaTargetSuccessPercent: number;

  @Field(() => Float)
  @Column({ type: 'double precision', default: 1 })
  mailboxInboundSlaWarningRejectedPercent: number;

  @Field(() => Float)
  @Column({ type: 'double precision', default: 5 })
  mailboxInboundSlaCriticalRejectedPercent: number;

  @Field()
  @Column({ default: true })
  mailboxInboundSlaAlertsEnabled: boolean;

  @Field(() => Int)
  @Column({ default: 60 })
  mailboxInboundSlaAlertCooldownMinutes: number;

  @Column({ nullable: true })
  mailboxInboundSlaLastAlertStatus?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  mailboxInboundSlaLastAlertedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  notificationDigestLastSentAt?: Date | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
