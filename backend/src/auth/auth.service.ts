import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, createHash } from 'crypto';
import { addSeconds } from 'date-fns';

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
} 