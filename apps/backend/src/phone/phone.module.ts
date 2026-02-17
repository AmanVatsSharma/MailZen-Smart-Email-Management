import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { PhoneVerification } from './entities/phone-verification.entity';
import { SignupVerification } from './entities/signup-verification.entity';
import { PhoneService } from './phone.service';
import { PhoneResolver } from './phone.resolver';
import { User } from '../user/entities/user.entity';

/**
 * PhoneModule - Phone verification management
 * Handles OTP verification for phone numbers
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PhoneVerification,
      SignupVerification,
      User,
      AuditLog,
    ]),
  ],
  providers: [PhoneService, PhoneResolver],
  exports: [PhoneService],
})
export class PhoneModule {}
