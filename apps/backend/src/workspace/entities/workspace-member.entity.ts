import { Field, ID, ObjectType } from '@nestjs/graphql';
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
@Entity('workspace_members')
@Unique(['workspaceId', 'email'])
export class WorkspaceMember {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Index()
  @Column()
  workspaceId: string;

  @Field({ nullable: true })
  @Index()
  @Column({ nullable: true })
  userId?: string | null;

  @Field()
  @Column()
  email: string;

  @Field()
  @Column({ default: 'MEMBER' })
  role: string;

  @Field()
  @Column({ default: 'active' })
  status: string;

  @Field()
  @Column()
  invitedByUserId: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
