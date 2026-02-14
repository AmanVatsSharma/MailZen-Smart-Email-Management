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
@Entity('smart_reply_settings')
export class SmartReplySettings {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index({ unique: true })
  @Column()
  userId: string;

  @Field()
  @Column({ default: true })
  enabled: boolean;

  @Field()
  @Column({ default: 'professional' })
  defaultTone: string;

  @Field()
  @Column({ default: 'medium' })
  defaultLength: string;

  @Field()
  @Column({ default: 'balanced' })
  aiModel: string;

  @Field()
  @Column({ default: true })
  includeSignature: boolean;

  @Field(() => Int)
  @Column({ default: 75 })
  personalization: number;

  @Field(() => Int)
  @Column({ default: 60 })
  creativityLevel: number;

  @Field(() => Int)
  @Column({ default: 3 })
  maxSuggestions: number;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  customInstructions?: string | null;

  @Field()
  @Column({ default: true })
  keepHistory: boolean;

  @Field(() => Int)
  @Column({ default: 30 })
  historyLength: number;

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn()
  updatedAt: Date;
}
