// apps/backend/src/core/infrastructure/persistence/typeorm/entities/membership.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'memberships' })
@Index(['workspaceId', 'userId'], { unique: true })
export class MembershipOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column('uuid') userId: string;
  @Column() role: string;
  @Column({ default: false }) pendingInvitation: boolean;
  @Column({ type: 'timestamptz', nullable: true }) invitedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) joinedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) removedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
