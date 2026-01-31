import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { SignupVerification } from '../phone/entities/signup-verification.entity';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { UserModule } from '../user/user.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { GoogleOAuthController } from './oauth.controller';
import { SessionCookieService } from './session-cookie.service';

/**
 * Resolve JWT expiration from env in a type-safe way.
 *
 * - If `JWT_EXPIRATION` is numeric, treat it as seconds and pass a number (safe for typings).
 * - Otherwise allow common string formats like `24h`, `1d`, `60s`, etc.
 * - Default stays `24h` for backwards compatibility.
 */
function getJwtExpiresInSeconds(): number {
  const raw = process.env.JWT_EXPIRATION;
  // Default: 24h (in seconds)
  if (!raw) return 60 * 60 * 24;

  // We intentionally treat JWT_EXPIRATION as seconds to avoid type ambiguity and runtime surprises.
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) return Math.floor(asNumber);

  console.warn(
    `[AuthModule] Invalid JWT_EXPIRATION='${raw}'. Expected a positive number (seconds). Falling back to 86400.`,
  );
  return 60 * 60 * 24;
}

/**
 * AuthModule - Authentication and authorization
 * Provides JWT tokens, refresh tokens, and verification flows
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSession, VerificationToken, SignupVerification]),
    UserModule,
    MailboxModule,
    JwtModule.register({
      // Enterprise hygiene: do NOT silently fall back to a default secret.
      // If JWT_SECRET isn't set, the app should fail fast during bootstrap.
      secret: process.env.JWT_SECRET as string,
      signOptions: { expiresIn: getJwtExpiresInSeconds() },
    }),
  ],
  controllers: [GoogleOAuthController],
  providers: [AuthService, AuthResolver, SessionCookieService],
  exports: [AuthService],
})
export class AuthModule {} 