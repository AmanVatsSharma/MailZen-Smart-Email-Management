// apps/backend/src/core/infrastructure/persistence/typeorm/entities/phone-verification.orm-entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity({ name: 'phone_verifications' })
@Index(['phoneNumber', 'expiresAt'])
export class PhoneVerificationOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { nullable: true }) userId: string | null;
  @Column() phoneNumber: string;
  @Column() codeHash: string;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
