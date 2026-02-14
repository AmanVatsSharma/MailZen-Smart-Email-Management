import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

/**
 * UserModule - User management and authentication
 * Provides user CRUD operations and validation
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog])],
  providers: [UserResolver, UserService],
  exports: [UserService],
})
export class UserModule {}
