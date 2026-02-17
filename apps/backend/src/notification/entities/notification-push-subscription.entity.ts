import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity('notification_push_subscriptions')
export class NotificationPushSubscription {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  userId: string;

  @Field({ nullable: true })
  @Index()
  @Column({ nullable: true })
  workspaceId?: string | null;

  @Field()
  @Index({ unique: true })
  @Column({ type: 'text' })
  endpoint: string;

  @Field()
  @Column()
  p256dh: string;

  @Field()
  @Column()
  auth: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  userAgent?: string | null;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field(() => Int)
  @Column({ type: 'integer', default: 0 })
  failureCount: number;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastDeliveredAt?: Date | null;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastFailureAt?: Date | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
