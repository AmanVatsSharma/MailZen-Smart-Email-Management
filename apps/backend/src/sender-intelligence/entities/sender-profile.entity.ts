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
@Entity('sender_profiles')
@Index(['userId', 'senderEmail'], { unique: true })
export class SenderProfile {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The mailbox owner this profile belongs to */
  @Field()
  @Index()
  @Column({ type: 'varchar' })
  userId: string;

  @Field()
  @Index()
  @Column({ type: 'varchar' })
  senderEmail: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  displayName?: string | null;

  /** Root domain extracted from senderEmail (e.g. acme.com) */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  domain?: string | null;

  /** Total emails received from this sender */
  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  emailCount: number;

  /** Average time (seconds) the user takes to reply */
  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true })
  avgResponseTimeSec?: number | null;

  /** Composite score 0–1 used for VIP fast-lane prioritization */
  @Field(() => Float)
  @Column({ type: 'float', default: 0 })
  relationshipScore: number;

  /** Most common topics discussed with this sender */
  @Field(() => [String])
  @Column({ type: 'jsonb', default: [] })
  topics: string[];

  /** Whether this sender is manually marked as VIP */
  @Field()
  @Column({ type: 'boolean', default: false })
  isVip: boolean;

  @Field(() => String, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastEmailAt?: Date | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
