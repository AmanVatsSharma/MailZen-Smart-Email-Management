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
@Entity('user_notifications')
export class UserNotification {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  userId: string;

  @Field(() => String, { nullable: true })
  @Index()
  @Column({ type: 'varchar', nullable: true })
  workspaceId?: string | null;

  @Field()
  @Column()
  type: string;

  @Field()
  @Column()
  title: string;

  @Field()
  @Column({ type: 'text' })
  message: string;

  @Field()
  @Column({ default: false })
  isRead: boolean;

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
