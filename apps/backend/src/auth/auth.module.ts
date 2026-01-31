import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { GoogleOAuthController } from './oauth.controller';
import { SessionCookieService } from './session-cookie.service';

@Module({
  imports: [
    UserModule,
    PrismaModule,
    MailboxModule,
    JwtModule.register({
      // Enterprise hygiene: do NOT silently fall back to a default secret.
      // If JWT_SECRET isn't set, the app should fail fast during bootstrap.
      secret: process.env.JWT_SECRET as string,
      signOptions: { expiresIn: process.env.JWT_EXPIRATION ? `${process.env.JWT_EXPIRATION}s` : '24h' },
    }),
  ],
  controllers: [GoogleOAuthController],
  providers: [AuthService, AuthResolver, SessionCookieService],
  exports: [AuthService],
})
export class AuthModule {} 