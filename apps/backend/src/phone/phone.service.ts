import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addMinutes, isAfter } from 'date-fns';
import { PhoneVerification } from './entities/phone-verification.entity';
import { User } from '../user/entities/user.entity';
import { dispatchSmsOtp } from '../common/sms/sms-dispatcher.util';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class PhoneService {
  constructor(
    @InjectRepository(PhoneVerification)
    private readonly phoneVerificationRepo: Repository<PhoneVerification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async sendOtp(userId: string, phoneNumber: string): Promise<boolean> {
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
      console.log(
        `[PhoneService] OTP delivery provider=${deliveryResult.provider} delivered=${deliveryResult.delivered} userId=${userId}`,
      );
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.phoneVerificationRepo.delete({ id: savedRecord.id });
      throw new BadRequestException(`Failed to deliver OTP: ${reason}`);
    }

    return true;
  }

  async verifyOtp(userId: string, code: string): Promise<boolean> {
    const record = await this.phoneVerificationRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (!record || record.consumedAt || isAfter(new Date(), record.expiresAt)) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (record.code !== code) {
      await this.phoneVerificationRepo.increment(
        { id: record.id },
        'attempts',
        1,
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
    return true;
  }
}
