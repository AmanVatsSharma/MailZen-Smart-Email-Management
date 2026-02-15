import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity('agent_action_audits')
export class AgentActionAudit {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field({ nullable: true })
  @Index()
  @Column({ nullable: true })
  userId?: string | null;

  @Field()
  @Index()
  @Column()
  requestId: string;

  @Field()
  @Column()
  skill: string;

  @Field()
  @Column()
  action: string;

  @Field()
  @Column({ default: false })
  executed: boolean;

  @Field()
  @Column({ default: false })
  approvalRequired: boolean;

  @Field({ nullable: true })
  @Column({ nullable: true })
  approvalTokenSuffix?: string | null;

  @Field()
  @Column({ type: 'text' })
  message: string;

  @Field({ nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
