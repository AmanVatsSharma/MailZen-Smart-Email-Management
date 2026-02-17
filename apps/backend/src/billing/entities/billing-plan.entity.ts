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
@Entity('billing_plans')
export class BillingPlan {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index({ unique: true })
  @Column()
  code: string;

  @Field()
  @Column()
  name: string;

  @Field(() => Int)
  @Column({ default: 0 })
  priceMonthlyCents: number;

  @Field()
  @Column({ default: 'USD' })
  currency: string;

  @Field(() => Int)
  @Column({ default: 1 })
  providerLimit: number;

  @Field(() => Int)
  @Column({ default: 1 })
  mailboxLimit: number;

  @Field(() => Int)
  @Column({ default: 1 })
  workspaceLimit: number;

  @Field(() => Int)
  @Column({ default: 3 })
  workspaceMemberLimit: number;

  @Field(() => Int)
  @Column({ default: 50 })
  aiCreditsPerMonth: number;

  @Field(() => Int)
  @Column({ default: 2048 })
  mailboxStorageLimitMb: number;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
