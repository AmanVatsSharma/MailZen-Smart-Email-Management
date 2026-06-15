// apps/backend/src/core/infrastructure/persistence/typeorm/entities/session.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'sessions' })
@Index(['userId'])
@Index(['refreshTokenHash'])
@Index(['expiresAt'])
export class SessionOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column({ length: 128 }) refreshTokenHash: string;
  @Column({ type: 'text', nullable: true }) ipAddress: string | null;
  @Column({ type: 'text', nullable: true }) userAgent: string | null;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
