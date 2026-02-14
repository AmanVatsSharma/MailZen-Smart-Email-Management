import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { UserService } from '../user/user.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthResponse } from './dto/auth-response';
import { CreateUserInput } from '../user/dto/create-user.input';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly mailboxService: MailboxService,
    private readonly sessionCookie: SessionCookieService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Mutation(() => AuthResponse)
  async login(
    @Args('loginInput') loginInput: LoginInput,
    @Context() ctx: any,
  ): Promise<AuthResponse> {
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
    else if ((process.env.NODE_ENV || 'development') !== 'production')
      console.warn(
        '[AuthResolver.login] Missing res in GraphQL context; cannot set cookie',
      );

    return {
      token: accessToken,
      refreshToken,
      user,
    };
  }

  @Mutation(() => AuthResponse)
  async register(
    @Args('registerInput') registerInput: CreateUserInput,
    @Context() ctx: any,
  ): Promise<AuthResponse> {
    if (!registerInput.email || !registerInput.password) {
      throw new BadRequestException('Email and password are required');
    }
    const user = await this.userService.createUser(registerInput);
    const { accessToken } = this.authService.login(user);
    const refreshToken = await this.authService.generateRefreshToken(user.id);
    // Issue email verification token (returning as part of response for local dev)
    const verifyToken = await this.authService.createVerificationToken(
      user.id,
      'EMAIL_VERIFY',
    );

    const res = ctx?.res;
    if (res) this.sessionCookie.setTokenCookie(res, accessToken);
    else if ((process.env.NODE_ENV || 'development') !== 'production')
      console.warn(
        '[AuthResolver.register] Missing res in GraphQL context; cannot set cookie',
      );

    return { token: accessToken, refreshToken, user };
  }

  @Mutation(() => AuthResponse)
  async refresh(@Args('input') input: RefreshInput): Promise<AuthResponse> {
    const result = await this.authService.rotateRefreshToken(
      input.refreshToken,
    );
    const user = await this.userService.getUser(result.userId);
    return { token: result.token, refreshToken: result.refreshToken, user };
  }

  @Mutation(() => Boolean)
  async logout(
    // Explicit GraphQL type required (TS unions like `RefreshInput | undefined` can break reflection).
    @Args('input', { type: () => RefreshInput, nullable: true })
    input: RefreshInput,
    @Context() ctx: any,
  ): Promise<boolean> {
    // Always clear cookie so browser session ends.
    const res = ctx?.res;
    if (res) this.sessionCookie.clearTokenCookie(res);
    else if ((process.env.NODE_ENV || 'development') !== 'production')
      console.warn(
        '[AuthResolver.logout] Missing res in GraphQL context; cannot clear cookie',
      );

    // Refresh tokens are planned “later”; keep backward compatibility if clients still pass it.
    if (input?.refreshToken) {
      await this.authService.logout(input.refreshToken);
    }
    return true;
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Args('input') input: ForgotPasswordInput,
  ): Promise<boolean> {
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
  ): Promise<boolean> {
    const userId = await this.authService.consumeVerificationToken(
      input.token,
      'PASSWORD_RESET',
    );
    const hashed = await bcrypt.hash(input.newPassword, 12);
    await this.userRepo.update({ id: userId }, {
      password: hashed,
      passwordUpdatedAt: new Date(),
    } as any);
    return true;
  }

  @Mutation(() => Boolean)
  async verifyEmail(@Args('input') input: VerifyEmailInput): Promise<boolean> {
    const userId = await this.authService.consumeVerificationToken(
      input.token,
      'EMAIL_VERIFY',
    );
    await this.userRepo.update({ id: userId }, {
      isEmailVerified: true,
    } as any);
    return true;
  }

  // Phone-only signup flow (no Gmail/Outlook required)
  @Mutation(() => Boolean)
  async signupSendOtp(
    @Args('input') input: SignupPhoneInput,
  ): Promise<boolean> {
    return this.authService.createSignupOtp(input.phoneNumber);
  }

  @Mutation(() => AuthResponse)
  async signupVerify(
    @Args('input') input: VerifySignupInput,
    @Context() ctx: any,
  ): Promise<AuthResponse> {
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
    else if ((process.env.NODE_ENV || 'development') !== 'production')
      console.warn(
        '[AuthResolver.signupVerify] Missing res in GraphQL context; cannot set cookie',
      );
    return { token: accessToken, refreshToken, user };
  }
}
