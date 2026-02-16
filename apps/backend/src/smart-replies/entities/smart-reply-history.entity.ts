import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@ObjectType()
@Entity('smart_reply_history')
@Index(['userId', 'createdAt'])
export class SmartReplyHistory {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  userId: string;

  @Field()
  @Column({ type: 'text' })
  conversationPreview: string;

  @Field(() => [String])
  @Column({ type: 'jsonb', default: () => "'[]'" })
  suggestions: string[];

  @Field()
  @Column({ default: 'internal' })
  source: string;

  @Field()
  @Column({ default: false })
  blockedSensitive: boolean;

  @Field()
  @Column({ default: false })
  fallbackUsed: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
