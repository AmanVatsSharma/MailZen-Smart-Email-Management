import { ObjectType, Field, ID } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * Template Entity - Email templates for quick composition
 * Reusable email templates with subject and body
 */
@ObjectType()
@Entity('templates')
export class Template {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column()
  subject: string;

  @Field()
  @Column({ type: 'text' })
  body: string;

  // NOTE: GraphQL can't infer a safe type for `Record<string, any>` without a JSON scalar.
  // For MVP, we keep metadata in the DB but do not expose it in the GraphQL schema.
  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata?: Record<string, any>;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, (user) => user.templates)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
