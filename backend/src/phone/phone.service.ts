import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addMinutes, isAfter } from 'date-fns';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class PhoneService {
  constructor(private readonly prisma: PrismaService) {}

  async sendOtp(userId: string, phoneNumber: string): Promise<boolean> {
    const code = generateOtp();
    await this.prisma.phoneVerification.create({
      data: {
        userId,
        phoneNumber,
        code,
        expiresAt: addMinutes(new Date(), 10),
      },
    });
    // TODO: integrate AWS SNS/Twilio to actually send `code`
    return true;
  }

  async verifyOtp(userId: string, code: string): Promise<boolean> {
    const record = await this.prisma.phoneVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.consumedAt || isAfter(new Date(), record.expiresAt)) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (record.code !== code) {
      await this.prisma.phoneVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } as any } });
      throw new BadRequestException('Invalid code');
    }
    await this.prisma.$transaction([
      this.prisma.phoneVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { isPhoneVerified: true, phoneNumber: record.phoneNumber } }),
    ]);
    return true;
  }
}
