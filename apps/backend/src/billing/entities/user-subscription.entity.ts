import { Field, ID, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity('user_subscriptions')
export class UserSubscription {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  userId: string;

  @Field()
  @Column()
  planCode: string;

  @Field()
  @Column({ default: 'active' })
  status: string;

  @Field()
  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  endsAt?: Date | null;

  @Field()
  @Column({ default: false })
  isTrial: boolean;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt?: Date | null;

  @Field()
  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  billingProviderCustomerId?: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
