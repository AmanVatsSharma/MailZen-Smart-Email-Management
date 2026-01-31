import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { SignupVerification } from '../phone/entities/signup-verification.entity';
import { randomBytes, createHash } from 'crypto';
import { addSeconds, addMinutes, isAfter } from 'date-fns';

/**
 * AuthService - Handles JWT authentication, refresh tokens, and verification flows
 * Uses TypeORM repositories for secure session management
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepository: Repository<VerificationToken>,
    @InjectRepository(SignupVerification)
    private readonly signupVerificationRepository: Repository<SignupVerification>,
  ) {
    console.log('[AuthService] Initialized with TypeORM repositories');
  }

  /**
   * Resolve JWT expiration from env in a type-safe way.
   *
   * - If `JWT_EXPIRATION` is numeric, treat it as seconds and pass a number.
   * - Otherwise allow common string formats like `24h`, `1d`, `60s`, etc.
   * - Default stays `24h` for backwards compatibility.
   */
  private getJwtExpiresInSeconds(): number {
    const raw = process.env.JWT_EXPIRATION;
    // Default: 24h (in seconds)
    if (!raw) return 60 * 60 * 24;

    // We intentionally treat JWT_EXPIRATION as seconds to avoid type ambiguity and runtime surprises.
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber > 0) return Math.floor(asNumber);

    // Loud logging for debugging; safe fallback.
    console.warn(
      `[AuthService] Invalid JWT_EXPIRATION='${raw}'. Expected a positive number (seconds). Falling back to 86400.`,
    );
    return 60 * 60 * 24;
  }

  validateToken(token: string): any {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'default-secret') {
      throw new Error('JWT secret not configured');
    }
    return this.jwtService.verify(token, { secret });
  }

  login(user: any): { accessToken: string } {
    // Keep JWT payload minimal and stable across auth methods (password, OAuth, etc.)
    // NOTE: Some older callers may pass `roles`; Prisma uses `role` (string).
    const payload = { id: user.id, email: user.email, role: user.role ?? user.roles ?? 'USER' };
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'default-secret') {
      throw new Error('JWT secret not configured');
    }
    return {
      accessToken: this.jwtService.sign(payload, {
        secret,
        expiresIn: this.getJwtExpiresInSeconds(),
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

  /**
   * Generate a new refresh token and store session
   * @param userId - User ID
   * @param userAgent - Client user agent
   * @param ip - Client IP address
   * @returns Raw refresh token (unhashed)
   */
  async generateRefreshToken(userId: string, userAgent?: string, ip?: string): Promise<string> {
    console.log('[AuthService] Generating refresh token for user:', userId);
    
    const raw = randomBytes(48).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    const ttlSeconds = parseInt(process.env.REFRESH_TTL_SECONDS || '2592000', 10); // 30d default
    
    const session = this.sessionRepository.create({
      userId,
      refreshTokenHash: hash,
      userAgent,
      ip,
      expiresAt: addSeconds(new Date(), ttlSeconds),
    });
    
    await this.sessionRepository.save(session);
    console.log('[AuthService] Refresh token session created:', session.id);
    
    return raw;
  }

  /**
   * Rotate refresh token - revoke old and issue new
   * @param refreshToken - Current refresh token
   * @param userAgent - Client user agent
   * @param ip - Client IP address
   * @returns New JWT access token and refresh token
   */
  async rotateRefreshToken(refreshToken: string, userAgent?: string, ip?: string): Promise<{ token: string; refreshToken: string; userId: string; }> {
    console.log('[AuthService] Rotating refresh token');
    
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.sessionRepository.findOne({ where: { refreshTokenHash: hash } });
    
    if (!session || session.revokedAt || isAfter(new Date(), session.expiresAt)) {
      console.log('[AuthService] Invalid or expired refresh token');
      throw new Error('Invalid refresh token');
    }
    
    // Fetch user
    const user = await this.userRepository.findOne({ where: { id: session.userId } });
    if (!user) {
      console.log('[AuthService] User not found for session:', session.userId);
      throw new Error('User not found');
    }

    // Revoke old session
    await this.sessionRepository.update(
      { refreshTokenHash: hash },
      { revokedAt: new Date(), revokedReason: 'rotated' }
    );
    console.log('[AuthService] Old session revoked');

    // Issue new refresh token
    const newRefresh = await this.generateRefreshToken(user.id, userAgent, ip);
    
    // Generate new access token
    const token = this.jwtService.sign(
      { id: user.id, email: user.email },
      { secret: this.getJwtSecret(), expiresIn: this.getJwtExpiresInSeconds() },
    );
    
    console.log('[AuthService] Token rotation successful for user:', user.id);
    return { token, refreshToken: newRefresh, userId: user.id };
  }

  /**
   * Logout user by revoking refresh token session
   * @param refreshToken - Refresh token to revoke
   * @returns Success status
   */
  async logout(refreshToken: string): Promise<boolean> {
    console.log('[AuthService] Logging out user');
    
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.sessionRepository.findOne({ where: { refreshTokenHash: hash } });
    
    if (!session) {
      console.log('[AuthService] Session not found, already logged out');
      return true;
    }
    
    await this.sessionRepository.update(
      { refreshTokenHash: hash },
      { revokedAt: new Date(), revokedReason: 'logout' }
    );
    
    console.log('[AuthService] Session revoked successfully');
    return true;
  }

  /**
   * Create verification token for email verification or password reset
   * @param userId - User ID
   * @param type - Token type (EMAIL_VERIFY or PASSWORD_RESET)
   * @returns Generated token string
   */
  async createVerificationToken(userId: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'): Promise<string> {
    console.log('[AuthService] Creating verification token:', type, 'for user:', userId);
    
    const token = randomBytes(32).toString('hex');
    const ttlMinutes = type === 'PASSWORD_RESET' ? 30 : 60 * 24; // 30m reset, 24h verify
    
    const verificationToken = this.verificationTokenRepository.create({
      userId,
      token,
      type,
      expiresAt: addMinutes(new Date(), ttlMinutes),
    });
    
    await this.verificationTokenRepository.save(verificationToken);
    console.log('[AuthService] Verification token created:', verificationToken.id);
    
    return token;
  }

  /**
   * Consume and validate verification token
   * @param token - Token string
   * @param type - Expected token type
   * @returns User ID if valid
   */
  async consumeVerificationToken(token: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'): Promise<string> {
    console.log('[AuthService] Consuming verification token:', type);
    
    const record = await this.verificationTokenRepository.findOne({ where: { token } });
    
    if (!record || record.type !== type || record.consumedAt || isAfter(new Date(), record.expiresAt)) {
      console.log('[AuthService] Invalid or expired verification token');
      throw new Error('Invalid token');
    }
    
    await this.verificationTokenRepository.update(
      { token },
      { consumedAt: new Date() }
    );
    
    console.log('[AuthService] Verification token consumed for user:', record.userId);
    return record.userId;
  }

  /**
   * Create signup OTP for phone verification (pre-registration)
   * @param phoneNumber - Phone number to verify
   * @returns Success status
   */
  async createSignupOtp(phoneNumber: string): Promise<boolean> {
    console.log('[AuthService] Creating signup OTP for phone:', phoneNumber);
    
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    
    const verification = this.signupVerificationRepository.create({
      phoneNumber,
      code,
      expiresAt: addMinutes(new Date(), 10),
    });
    
    await this.signupVerificationRepository.save(verification);
    console.log('[AuthService] Signup OTP created:', code);
    
    // TODO: integrate AWS SNS to send code
    console.log('[AuthService] TODO: Send OTP via SMS service');
    
    return true;
  }

  /**
   * Verify signup OTP code
   * @param phoneNumber - Phone number
   * @param code - OTP code to verify
   * @returns Success status
   */
  async verifySignupOtp(phoneNumber: string, code: string): Promise<boolean> {
    console.log('[AuthService] Verifying signup OTP for phone:', phoneNumber);
    
    const record = await this.signupVerificationRepository.findOne({
      where: { phoneNumber },
      order: { createdAt: 'DESC' },
    });
    
    if (!record || record.consumedAt || isAfter(new Date(), record.expiresAt)) {
      console.log('[AuthService] Invalid or expired OTP');
      throw new Error('Invalid or expired code');
    }
    
    if (record.code !== code) {
      console.log('[AuthService] Incorrect OTP code');
      await this.signupVerificationRepository.update(
        record.id,
        { attempts: record.attempts + 1 }
      );
      throw new Error('Invalid code');
    }
    
    await this.signupVerificationRepository.update(
      record.id,
      { consumedAt: new Date() }
    );
    
    console.log('[AuthService] Signup OTP verified successfully');
    return true;
  }
} 