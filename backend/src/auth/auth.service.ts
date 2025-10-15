import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, createHash } from 'crypto';
import { addSeconds, addMinutes, isAfter } from 'date-fns';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService, private readonly prisma: PrismaService) {}

  validateToken(token: string): any {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'default-secret') {
      throw new Error('JWT secret not configured');
    }
    return this.jwtService.verify(token, { secret });
  }

  login(user: any): { accessToken: string } {
    const payload = { id: user.id, email: user.email, roles: user.roles };
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'default-secret') {
      throw new Error('JWT secret not configured');
    }
    return {
      accessToken: this.jwtService.sign(payload, {
        secret,
        expiresIn: process.env.JWT_EXPIRATION ? `${process.env.JWT_EXPIRATION}s` : '24h',
      }),
    };
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'default-secret') {
      throw new Error('JWT secret not configured');
    }
    return secret;
  }

  async generateRefreshToken(userId: string, userAgent?: string, ip?: string): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    const ttlSeconds = parseInt(process.env.REFRESH_TTL_SECONDS || '2592000', 10); // 30d default
    await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: hash,
        userAgent,
        ip,
        expiresAt: addSeconds(new Date(), ttlSeconds),
      },
    });
    return raw;
  }

  async rotateRefreshToken(refreshToken: string, userAgent?: string, ip?: string): Promise<{ token: string; refreshToken: string; userId: string; }> {
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.prisma.userSession.findUnique({ where: { refreshTokenHash: hash } });
    if (!session || session.revokedAt || isAfter(new Date(), session.expiresAt)) {
      throw new Error('Invalid refresh token');
    }
    // Fetch user
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new Error('User not found');

    // Revoke old session and issue new one
    await this.prisma.userSession.update({ where: { refreshTokenHash: hash }, data: { revokedAt: new Date(), revokedReason: 'rotated' } });

    const newRefresh = await this.generateRefreshToken(user.id, userAgent, ip);
    const token = this.jwtService.sign({ id: user.id, email: user.email }, { secret: this.getJwtSecret(), expiresIn: process.env.JWT_EXPIRATION ? `${process.env.JWT_EXPIRATION}s` : '24h' });
    return { token, refreshToken: newRefresh, userId: user.id };
  }

  async logout(refreshToken: string): Promise<boolean> {
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.prisma.userSession.findUnique({ where: { refreshTokenHash: hash } });
    if (!session) return true;
    await this.prisma.userSession.update({ where: { refreshTokenHash: hash }, data: { revokedAt: new Date(), revokedReason: 'logout' } });
    return true;
  }

  async createVerificationToken(userId: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const ttlMinutes = type === 'PASSWORD_RESET' ? 30 : 60 * 24; // 30m reset, 24h verify
    await this.prisma.verificationToken.create({
      data: {
        userId,
        token,
        type,
        expiresAt: addMinutes(new Date(), ttlMinutes),
      },
    });
    return token;
  }

  async consumeVerificationToken(token: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'): Promise<string> {
    const record = await this.prisma.verificationToken.findUnique({ where: { token } });
    if (!record || record.type !== type || record.consumedAt || isAfter(new Date(), record.expiresAt)) {
      throw new Error('Invalid token');
    }
    await this.prisma.verificationToken.update({ where: { token }, data: { consumedAt: new Date() } });
    return record.userId;
  }

  async createSignupOtp(phoneNumber: string): Promise<boolean> {
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    await this.prisma.signupVerification.create({
      data: {
        phoneNumber,
        code,
        expiresAt: addMinutes(new Date(), 10),
      },
    });
    // TODO: integrate AWS SNS to send code
    return true;
  }

  async verifySignupOtp(phoneNumber: string, code: string): Promise<boolean> {
    const record = await this.prisma.signupVerification.findFirst({
      where: { phoneNumber },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.consumedAt || isAfter(new Date(), record.expiresAt)) {
      throw new Error('Invalid or expired code');
    }
    if (record.code !== code) {
      await this.prisma.signupVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } as any } });
      throw new Error('Invalid code');
    }
    await this.prisma.signupVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return true;
  }
} 