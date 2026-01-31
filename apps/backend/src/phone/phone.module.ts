import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhoneVerification } from './entities/phone-verification.entity';
import { SignupVerification } from './entities/signup-verification.entity';
import { PhoneService } from './phone.service';
import { PhoneResolver } from './phone.resolver';

/**
 * PhoneModule - Phone verification management
 * Handles OTP verification for phone numbers
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PhoneVerification, SignupVerification]),
  ],
  providers: [PhoneService, PhoneResolver],
  exports: [PhoneService],
})
export class PhoneModule {}
