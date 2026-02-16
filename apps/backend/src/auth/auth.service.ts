import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { AuditLog } from './entities/audit-log.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { SignupVerification } from '../phone/entities/signup-verification.entity';
import { dispatchSmsOtp } from '../common/sms/sms-dispatcher.util';
import { randomBytes, createHash } from 'crypto';
import { addSeconds, addMinutes, isAfter } from 'date-fns';
import {
  fingerprintIdentifier,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

/**
 * AuthService - Handles JWT authentication, refresh tokens, and verification flows
 * Uses TypeORM repositories for secure session management
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepository: Repository<VerificationToken>,
    @InjectRepository(SignupVerification)
    private readonly signupVerificationRepository: Repository<SignupVerification>,
  ) {}

  private async writeAuditLog(input: {
    action: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditEntry = this.auditLogRepository.create({
        action: input.action,
        userId: input.userId,
        metadata: input.metadata,
      });
      await this.auditLogRepository.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_audit_log_write_failed',
          action: input.action,
          userId: input.userId || null,
          error: String(error),
        }),
      );
    }
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
    this.logger.warn(
      serializeStructuredLog({
        event: 'auth_jwt_expiration_invalid',
        rawJwtExpiration: raw,
        fallbackSeconds: 60 * 60 * 24,
      }),
    );
    return 60 * 60 * 24;
  }

  private resolveSignupOtpMaxAttempts(): number {
    const parsed = Number(process.env.MAILZEN_SIGNUP_OTP_MAX_ATTEMPTS || '5');
    const candidate = Number.isFinite(parsed) ? Math.floor(parsed) : 5;
    if (candidate < 1) return 1;
    if (candidate > 20) return 20;
    return candidate;
  }

  validateToken(token: string): any {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'default-secret') {
      throw new Error('JWT secret not configured');
    }
    return this.jwtService.verify(token, { secret });
  }

  login(user: { id: string; email: string; role?: string; roles?: string }): {
    accessToken: string;
  } {
    // Keep JWT payload minimal and stable across auth methods (password, OAuth, etc.)
    // NOTE: Some older callers may pass `roles`; current auth payload uses `role` (string).
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role ?? user.roles ?? 'USER',
    };
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
  async generateRefreshToken(
    userId: string,
    userAgent?: string,
    ip?: string,
  ): Promise<string> {
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_refresh_token_generate_start',
        userId,
      }),
    );

    const raw = randomBytes(48).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    const ttlSeconds = parseInt(
      process.env.REFRESH_TTL_SECONDS || '2592000',
      10,
    ); // 30d default

    const session = this.sessionRepository.create({
      userId,
      refreshTokenHash: hash,
      userAgent,
      ip,
      expiresAt: addSeconds(new Date(), ttlSeconds),
    });

    await this.sessionRepository.save(session);
    await this.writeAuditLog({
      action: 'auth_refresh_token_issued',
      userId,
      metadata: {
        sessionId: session.id,
        expiresAtIso: session.expiresAt.toISOString(),
      },
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_refresh_token_generate_completed',
        userId,
        sessionId: session.id,
      }),
    );

    return raw;
  }

  /**
   * Rotate refresh token - revoke old and issue new
   * @param refreshToken - Current refresh token
   * @param userAgent - Client user agent
   * @param ip - Client IP address
   * @returns New JWT access token and refresh token
   */
  async rotateRefreshToken(
    refreshToken: string,
    userAgent?: string,
    ip?: string,
  ): Promise<{ token: string; refreshToken: string; userId: string }> {
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_refresh_token_rotate_start',
      }),
    );

    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.sessionRepository.findOne({
      where: { refreshTokenHash: hash },
    });

    if (
      !session ||
      session.revokedAt ||
      isAfter(new Date(), session.expiresAt)
    ) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_refresh_token_rotate_invalid_session',
        }),
      );
      throw new Error('Invalid refresh token');
    }

    // Fetch user
    const user = await this.userRepository.findOne({
      where: { id: session.userId },
    });
    if (!user) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_refresh_token_rotate_user_missing',
          userId: session.userId,
        }),
      );
      throw new Error('User not found');
    }

    // Revoke old session
    await this.sessionRepository.update(
      { refreshTokenHash: hash },
      { revokedAt: new Date(), revokedReason: 'rotated' },
    );
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_refresh_token_rotate_old_session_revoked',
        userId: user.id,
      }),
    );

    // Issue new refresh token
    const newRefresh = await this.generateRefreshToken(user.id, userAgent, ip);

    // Generate new access token
    const token = this.jwtService.sign(
      { id: user.id, email: user.email },
      { secret: this.getJwtSecret(), expiresIn: this.getJwtExpiresInSeconds() },
    );

    this.logger.log(
      serializeStructuredLog({
        event: 'auth_refresh_token_rotate_completed',
        userId: user.id,
      }),
    );
    await this.writeAuditLog({
      action: 'auth_refresh_token_rotated',
      userId: user.id,
      metadata: {
        revokedSessionId: session.id,
      },
    });
    return { token, refreshToken: newRefresh, userId: user.id };
  }

  /**
   * Logout user by revoking refresh token session
   * @param refreshToken - Refresh token to revoke
   * @returns Success status
   */
  async logout(refreshToken: string): Promise<boolean> {
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_logout_start',
      }),
    );

    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.sessionRepository.findOne({
      where: { refreshTokenHash: hash },
    });

    if (!session) {
      this.logger.log(
        serializeStructuredLog({
          event: 'auth_logout_session_missing',
        }),
      );
      return true;
    }

    await this.sessionRepository.update(
      { refreshTokenHash: hash },
      { revokedAt: new Date(), revokedReason: 'logout' },
    );
    await this.writeAuditLog({
      action: 'auth_logout_completed',
      userId: session.userId,
      metadata: {
        sessionId: session.id,
      },
    });

    this.logger.log(
      serializeStructuredLog({
        event: 'auth_logout_completed',
        userId: session.userId,
        sessionId: session.id,
      }),
    );
    return true;
  }

  /**
   * Create verification token for email verification or password reset
   * @param userId - User ID
   * @param type - Token type (EMAIL_VERIFY or PASSWORD_RESET)
   * @returns Generated token string
   */
  async createVerificationToken(
    userId: string,
    type: 'EMAIL_VERIFY' | 'PASSWORD_RESET',
  ): Promise<string> {
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_verification_token_create_start',
        verificationType: type,
        userId,
      }),
    );

    const token = randomBytes(32).toString('hex');
    const ttlMinutes = type === 'PASSWORD_RESET' ? 30 : 60 * 24; // 30m reset, 24h verify

    const verificationToken = this.verificationTokenRepository.create({
      userId,
      token,
      type,
      expiresAt: addMinutes(new Date(), ttlMinutes),
    });

    await this.verificationTokenRepository.save(verificationToken);
    await this.writeAuditLog({
      action: 'auth_verification_token_issued',
      userId,
      metadata: {
        verificationType: type,
        verificationTokenId: verificationToken.id,
        expiresAtIso: verificationToken.expiresAt.toISOString(),
      },
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_verification_token_create_completed',
        verificationType: type,
        userId,
        verificationTokenId: verificationToken.id,
      }),
    );

    return token;
  }

  /**
   * Consume and validate verification token
   * @param token - Token string
   * @param type - Expected token type
   * @returns User ID if valid
   */
  async consumeVerificationToken(
    token: string,
    type: 'EMAIL_VERIFY' | 'PASSWORD_RESET',
  ): Promise<string> {
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_verification_token_consume_start',
        verificationType: type,
      }),
    );

    const record = await this.verificationTokenRepository.findOne({
      where: { token },
    });

    if (
      !record ||
      record.type !== type ||
      record.consumedAt ||
      isAfter(new Date(), record.expiresAt)
    ) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_verification_token_consume_invalid',
          verificationType: type,
        }),
      );
      throw new Error('Invalid token');
    }

    await this.verificationTokenRepository.update(
      { token },
      { consumedAt: new Date() },
    );
    await this.writeAuditLog({
      action: 'auth_verification_token_consumed',
      userId: record.userId,
      metadata: {
        verificationType: type,
        verificationTokenId: record.id,
      },
    });

    this.logger.log(
      serializeStructuredLog({
        event: 'auth_verification_token_consume_completed',
        verificationType: type,
        userId: record.userId,
        verificationTokenId: record.id,
      }),
    );
    return record.userId;
  }

  /**
   * Create signup OTP for phone verification (pre-registration)
   * @param phoneNumber - Phone number to verify
   * @returns Success status
   */
  async createSignupOtp(phoneNumber: string): Promise<boolean> {
    const phoneFingerprint = fingerprintIdentifier(phoneNumber);
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_signup_otp_create_start',
        phoneFingerprint,
      }),
    );

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const verification = this.signupVerificationRepository.create({
      phoneNumber,
      code,
      expiresAt: addMinutes(new Date(), 10),
    });

    const savedRecord =
      await this.signupVerificationRepository.save(verification);
    await this.writeAuditLog({
      action: 'auth_signup_otp_requested',
      metadata: {
        signupVerificationId: savedRecord.id,
        phoneFingerprint,
        expiresAtIso: savedRecord.expiresAt.toISOString(),
      },
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_signup_otp_persisted',
        phoneFingerprint,
        signupVerificationId: savedRecord.id,
      }),
    );

    try {
      const deliveryResult = await dispatchSmsOtp({
        phoneNumber,
        code,
        purpose: 'SIGNUP_OTP',
      });
      this.logger.log(
        serializeStructuredLog({
          event: 'auth_signup_otp_delivery_completed',
          phoneFingerprint,
          provider: deliveryResult.provider,
          delivered: deliveryResult.delivered,
        }),
      );
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.signupVerificationRepository.delete({ id: savedRecord.id });
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_signup_otp_delivery_failed',
          phoneFingerprint,
          signupVerificationId: savedRecord.id,
          error: reason,
        }),
      );
      throw new BadRequestException(`Failed to deliver signup OTP: ${reason}`);
    }

    return true;
  }

  /**
   * Verify signup OTP code
   * @param phoneNumber - Phone number
   * @param code - OTP code to verify
   * @returns Success status
   */
  async verifySignupOtp(phoneNumber: string, code: string): Promise<boolean> {
    const phoneFingerprint = fingerprintIdentifier(phoneNumber);
    this.logger.log(
      serializeStructuredLog({
        event: 'auth_signup_otp_verify_start',
        phoneFingerprint,
      }),
    );

    const record = await this.signupVerificationRepository.findOne({
      where: { phoneNumber },
      order: { createdAt: 'DESC' },
    });

    if (!record || record.consumedAt || isAfter(new Date(), record.expiresAt)) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_signup_otp_verify_invalid_or_expired',
          phoneFingerprint,
        }),
      );
      throw new Error('Invalid or expired code');
    }

    const maxAttempts = this.resolveSignupOtpMaxAttempts();
    if (record.attempts >= maxAttempts) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_signup_otp_verify_attempts_exceeded',
          phoneFingerprint,
          attempts: record.attempts,
          maxAttempts,
        }),
      );
      throw new Error('Invalid or expired code');
    }

    if (record.code !== code) {
      const updatedAttempts = record.attempts + 1;
      this.logger.warn(
        serializeStructuredLog({
          event: 'auth_signup_otp_verify_code_mismatch',
          phoneFingerprint,
          attempts: updatedAttempts,
          maxAttempts,
        }),
      );
      await this.signupVerificationRepository.update(record.id, {
        attempts: updatedAttempts,
      });
      throw new Error('Invalid code');
    }

    await this.signupVerificationRepository.update(record.id, {
      consumedAt: new Date(),
    });
    await this.writeAuditLog({
      action: 'auth_signup_otp_verified',
      metadata: {
        signupVerificationId: record.id,
        phoneFingerprint,
      },
    });

    this.logger.log(
      serializeStructuredLog({
        event: 'auth_signup_otp_verify_completed',
        phoneFingerprint,
        signupVerificationId: record.id,
      }),
    );
    return true;
  }
}
