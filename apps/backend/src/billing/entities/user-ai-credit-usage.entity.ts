import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity('user_ai_credit_usages')
@Unique(['userId', 'periodStart'])
export class UserAiCreditUsage {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  userId: string;

  @Field()
  @Column({ type: 'date' })
  periodStart: string;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  usedCredits: number;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  lastConsumedAt?: Date | null;

  @Field({ nullable: true })
  @Column({ nullable: true })
  lastRequestId?: string | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
