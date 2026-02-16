import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { UserService } from '../user/user.service';
import {
  UnauthorizedException,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthResponse } from './dto/auth-response';
import { CreateUserInput } from '../user/dto/create-user.input';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { RefreshInput } from './dto/refresh.input';
import { ForgotPasswordInput } from './dto/forgot-password.input';
import { ResetPasswordInput } from './dto/reset-password.input';
import { VerifyEmailInput } from './dto/verify-email.input';
import { SignupPhoneInput } from './dto/signup-phone.input';
import { VerifySignupInput } from './dto/verify-signup.input';
import { MailboxService } from '../mailbox/mailbox.service';
import { SessionCookieService } from './session-cookie.service';
import { User } from '../user/entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthMeResponse } from './dto/auth-me.response';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { AuthAbuseProtectionService } from './auth-abuse-protection.service';

interface RequestContext {
  req: {
    user?: { id: string };
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
  };
  res?: Response;
}

@Resolver()
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly mailboxService: MailboxService,
    private readonly sessionCookie: SessionCookieService,
    private readonly authAbuseProtection: AuthAbuseProtectionService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private warnMissingResponseContext(operation: string): void {
    if ((process.env.NODE_ENV || 'development') === 'production') return;
    this.logger.warn(
      serializeStructuredLog({
        event: 'auth_resolver_missing_response_context',
        operation,
      }),
    );
  }

  private async getAliasSetupState(userId: string): Promise<{
    hasMailzenAlias: boolean;
    requiresAliasSetup: boolean;
    nextStep: string;
  }> {
    const mailboxes = await this.mailboxService.getUserMailboxes(userId);
    const hasMailzenAlias = mailboxes.length > 0;

    return {
      hasMailzenAlias,
      requiresAliasSetup: !hasMailzenAlias,
      nextStep: hasMailzenAlias ? '/' : '/auth/alias-select',
    };
  }

  @Query(() => AuthMeResponse)
  @UseGuards(JwtAuthGuard)
  async authMe(@Context() ctx: RequestContext): Promise<AuthMeResponse> {
    const userId = ctx?.req?.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    const user = await this.userService.getUser(userId);
    const aliasState = await this.getAliasSetupState(user.id);

    return {
      user,
      ...aliasState,
    };
  }

  @Mutation(() => AuthResponse)
  async login(
    @Args('loginInput') loginInput: LoginInput,
    @Context() ctx: RequestContext,
  ): Promise<AuthResponse> {
    this.authAbuseProtection.enforceLimit({
      operation: 'login',
      request: ctx?.req,
      identifier: loginInput.email,
    });
    const user = await this.userService.validateUser(
      loginInput.email,
      loginInput.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { accessToken } = this.authService.login(user);
    const refreshToken = await this.authService.generateRefreshToken(user.id);

    // Enterprise-grade session: set HttpOnly cookie so Next middleware + browser requests remain consistent.
    const res = ctx?.res;
    if (res) this.sessionCookie.setTokenCookie(res, accessToken);
    else this.warnMissingResponseContext('login');

    const aliasState = await this.getAliasSetupState(user.id);

    return {
      token: accessToken,
      refreshToken,
      user,
      ...aliasState,
    };
  }

  @Mutation(() => AuthResponse)
  async register(
    @Args('registerInput') registerInput: CreateUserInput,
    @Context() ctx: RequestContext,
  ): Promise<AuthResponse> {
    this.authAbuseProtection.enforceLimit({
      operation: 'register',
      request: ctx?.req,
      identifier: registerInput.email,
    });
    if (!registerInput.email || !registerInput.password) {
      throw new BadRequestException('Email and password are required');
    }
    const user = await this.userService.createUser(registerInput);
    const { accessToken } = this.authService.login(user);
    const refreshToken = await this.authService.generateRefreshToken(user.id);
    // Issue email verification token (returning as part of response for local dev)
    await this.authService.createVerificationToken(user.id, 'EMAIL_VERIFY');

    const res = ctx?.res;
    if (res) this.sessionCookie.setTokenCookie(res, accessToken);
    else this.warnMissingResponseContext('register');

    const aliasState = await this.getAliasSetupState(user.id);
    return { token: accessToken, refreshToken, user, ...aliasState };
  }

  @Mutation(() => AuthResponse)
  async refresh(@Args('input') input: RefreshInput): Promise<AuthResponse> {
    const result = await this.authService.rotateRefreshToken(
      input.refreshToken,
    );
    const user = await this.userService.getUser(result.userId);
    const aliasState = await this.getAliasSetupState(user.id);
    return {
      token: result.token,
      refreshToken: result.refreshToken,
      user,
      ...aliasState,
    };
  }

  @Mutation(() => Boolean)
  async logout(
    // Explicit GraphQL type required (TS unions like `RefreshInput | undefined` can break reflection).
    @Args('input', { type: () => RefreshInput, nullable: true })
    input: RefreshInput,
    @Context() ctx: RequestContext,
  ): Promise<boolean> {
    // Always clear cookie so browser session ends.
    const res = ctx?.res;
    if (res) this.sessionCookie.clearTokenCookie(res);
    else this.warnMissingResponseContext('logout');

    // Refresh tokens are planned “later”; keep backward compatibility if clients still pass it.
    if (input?.refreshToken) {
      await this.authService.logout(input.refreshToken);
    }
    return true;
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Args('input') input: ForgotPasswordInput,
    @Context() ctx: RequestContext,
  ): Promise<boolean> {
    this.authAbuseProtection.enforceLimit({
      operation: 'forgot_password',
      request: ctx?.req,
      identifier: input.email,
    });
    const normalized = input.email.trim().toLowerCase();
    // If user not found, do not reveal
    const user = await this.userRepo.findOne({ where: { email: normalized } });
    if (user) {
      await this.authService.createVerificationToken(user.id, 'PASSWORD_RESET');
    }
    return true;
  }

  @Mutation(() => Boolean)
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
    @Context() ctx: RequestContext,
  ): Promise<boolean> {
    this.authAbuseProtection.enforceLimit({
      operation: 'reset_password',
      request: ctx?.req,
      identifier: input.token,
    });
    const userId = await this.authService.consumeVerificationToken(
      input.token,
      'PASSWORD_RESET',
    );
    const hashed = await bcrypt.hash(input.newPassword, 12);
    await this.userRepo.update(
      { id: userId },
      {
        password: hashed,
        passwordUpdatedAt: new Date(),
      },
    );
    return true;
  }

  @Mutation(() => Boolean)
  async verifyEmail(@Args('input') input: VerifyEmailInput): Promise<boolean> {
    const userId = await this.authService.consumeVerificationToken(
      input.token,
      'EMAIL_VERIFY',
    );
    await this.userRepo.update(
      { id: userId },
      {
        isEmailVerified: true,
      },
    );
    return true;
  }

  // Phone-only signup flow (no Gmail/Outlook required)
  @Mutation(() => Boolean)
  async signupSendOtp(
    @Args('input') input: SignupPhoneInput,
    @Context() ctx: RequestContext,
  ): Promise<boolean> {
    this.authAbuseProtection.enforceLimit({
      operation: 'signup_send_otp',
      request: ctx?.req,
      identifier: input.phoneNumber,
    });
    return this.authService.createSignupOtp(input.phoneNumber);
  }

  @Mutation(() => AuthResponse)
  async signupVerify(
    @Args('input') input: VerifySignupInput,
    @Context() ctx: RequestContext,
  ): Promise<AuthResponse> {
    this.authAbuseProtection.enforceLimit({
      operation: 'signup_verify',
      request: ctx?.req,
      identifier: input.phoneNumber,
    });
    await this.authService.verifySignupOtp(input.phoneNumber, input.code);
    // Create user account
    const user = await this.userService.createUser({
      email: input.email,
      password: input.password,
      name: input.name,
    });
    // Create mailbox (auto-suggest if not provided)
    await this.mailboxService.createMailbox(user.id, input.desiredLocalPart);
    // Issue tokens
    const { accessToken } = this.authService.login(user);
    const refreshToken = await this.authService.generateRefreshToken(user.id);
    const res = ctx?.res;
    if (res) this.sessionCookie.setTokenCookie(res, accessToken);
    else this.warnMissingResponseContext('signupVerify');
    const aliasState = await this.getAliasSetupState(user.id);
    return { token: accessToken, refreshToken, user, ...aliasState };
  }
}
