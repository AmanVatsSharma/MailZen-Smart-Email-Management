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
@Entity('agent_action_audits')
export class AgentActionAudit {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String, { nullable: true })
  @Index()
  @Column({ type: 'varchar', nullable: true })
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

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  approvalTokenSuffix?: string | null;

  @Field()
  @Column({ type: 'text' })
  message: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Field()
  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
