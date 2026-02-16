import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addMinutes, isAfter } from 'date-fns';
import { PhoneVerification } from './entities/phone-verification.entity';
import { User } from '../user/entities/user.entity';
import { dispatchSmsOtp } from '../common/sms/sms-dispatcher.util';
import {
  fingerprintIdentifier,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class PhoneService {
  private readonly logger = new Logger(PhoneService.name);

  constructor(
    @InjectRepository(PhoneVerification)
    private readonly phoneVerificationRepo: Repository<PhoneVerification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async sendOtp(userId: string, phoneNumber: string): Promise<boolean> {
    const phoneFingerprint = fingerprintIdentifier(phoneNumber || '');
    this.logger.log(
      serializeStructuredLog({
        event: 'phone_otp_send_start',
        userId,
        phoneFingerprint,
      }),
    );
    const code = generateOtp();
    const savedRecord = await this.phoneVerificationRepo.save(
      this.phoneVerificationRepo.create({
        userId,
        phoneNumber,
        code,
        expiresAt: addMinutes(new Date(), 10),
      }),
    );

    try {
      const deliveryResult = await dispatchSmsOtp({
        phoneNumber,
        code,
        purpose: 'PHONE_VERIFY_OTP',
      });
      this.logger.log(
        serializeStructuredLog({
          event: 'phone_otp_send_delivery_completed',
          userId,
          phoneFingerprint,
          provider: deliveryResult.provider,
          delivered: deliveryResult.delivered,
        }),
      );
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.phoneVerificationRepo.delete({ id: savedRecord.id });
      this.logger.warn(
        serializeStructuredLog({
          event: 'phone_otp_send_delivery_failed',
          userId,
          phoneFingerprint,
          phoneVerificationId: savedRecord.id,
          error: reason,
        }),
      );
      throw new BadRequestException(`Failed to deliver OTP: ${reason}`);
    }

    return true;
  }

  async verifyOtp(userId: string, code: string): Promise<boolean> {
    this.logger.log(
      serializeStructuredLog({
        event: 'phone_otp_verify_start',
        userId,
      }),
    );
    const record = await this.phoneVerificationRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const phoneFingerprint = record?.phoneNumber
      ? fingerprintIdentifier(record.phoneNumber)
      : undefined;
    if (!record || record.consumedAt || isAfter(new Date(), record.expiresAt)) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'phone_otp_verify_invalid_or_expired',
          userId,
          phoneFingerprint,
        }),
      );
      throw new BadRequestException('Invalid or expired code');
    }
    if (record.code !== code) {
      await this.phoneVerificationRepo.increment(
        { id: record.id },
        'attempts',
        1,
      );
      this.logger.warn(
        serializeStructuredLog({
          event: 'phone_otp_verify_code_mismatch',
          userId,
          phoneFingerprint,
          attempts: record.attempts + 1,
        }),
      );
      throw new BadRequestException('Invalid code');
    }
    await this.phoneVerificationRepo.manager.transaction(async (em) => {
      await em
        .getRepository(PhoneVerification)
        .update({ id: record.id }, { consumedAt: new Date() });
      await em.getRepository(User).update({ id: userId }, {
        isPhoneVerified: true,
        phoneNumber: record.phoneNumber,
      } as any);
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'phone_otp_verify_completed',
        userId,
        phoneFingerprint,
        phoneVerificationId: record.id,
      }),
    );
    return true;
  }
}
