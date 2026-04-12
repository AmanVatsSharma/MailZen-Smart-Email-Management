import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AiFeedbackSignal {
  ACCEPT = 'accept',
  EDIT = 'edit',
  DISMISS = 'dismiss',
}

registerEnumType(AiFeedbackSignal, { name: 'AiFeedbackSignal' });

@ObjectType()
@Entity('ai_feedback')
@Index(['userId', 'agentSkill'])
export class AiFeedback {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column({ type: 'varchar' })
  userId: string;

  @Field()
  @Column({ type: 'varchar' })
  agentSkill: string;

  @Field()
  @Column({ type: 'varchar' })
  action: string;

  @Field(() => AiFeedbackSignal)
  @Column({ type: 'varchar' })
  signal: AiFeedbackSignal;

  /** Optional emailId for per-thread context */
  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  emailId?: string | null;

  /** Raw text the user accepted/edited (for learning context) */
  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  draftText?: string | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
