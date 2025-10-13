import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { UserService } from '../user/user.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthResponse } from './dto/auth-response';
import { CreateUserInput } from '../user/dto/create-user.input';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { RefreshInput } from './dto/refresh.input';
import { ForgotPasswordInput } from './dto/forgot-password.input';
import { ResetPasswordInput } from './dto/reset-password.input';
import { VerifyEmailInput } from './dto/verify-email.input';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) {}

  @Mutation(() => AuthResponse)
  async login(@Args('loginInput') loginInput: LoginInput): Promise<AuthResponse> {
    const user = await this.userService.validateUser(
      loginInput.email,
      loginInput.password
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { accessToken } = this.authService.login(user);
    const refreshToken = await this.authService.generateRefreshToken(user.id);
    
    return {
      token: accessToken,
      refreshToken,
      user
    };
  }

  @Mutation(() => AuthResponse)
  async register(@Args('registerInput') registerInput: CreateUserInput): Promise<AuthResponse> {
    if (!registerInput.email || !registerInput.password) {
      throw new BadRequestException('Email and password are required');
    }
    const user = await this.userService.createUser(registerInput);
    const { accessToken } = this.authService.login(user);
    const refreshToken = await this.authService.generateRefreshToken(user.id);
    // Issue email verification token (returning as part of response for local dev)
    const verifyToken = await this.authService.createVerificationToken(user.id, 'EMAIL_VERIFY');
    return { token: accessToken, refreshToken, user };
  }

  @Mutation(() => AuthResponse)
  async refresh(@Args('input') input: RefreshInput): Promise<AuthResponse> {
    const result = await this.authService.rotateRefreshToken(input.refreshToken);
    const user = await this.userService.getUser(result.userId);
    return { token: result.token, refreshToken: result.refreshToken, user };
  }

  @Mutation(() => Boolean)
  async logout(@Args('input') input: RefreshInput): Promise<boolean> {
    return this.authService.logout(input.refreshToken);
  }

  @Mutation(() => Boolean)
  async forgotPassword(@Args('input') input: ForgotPasswordInput): Promise<boolean> {
    const normalized = input.email.trim().toLowerCase();
    // If user not found, do not reveal
    const user = await (this as any).userService.prisma.user.findUnique({ where: { email: normalized } });
    if (user) {
      await this.authService.createVerificationToken(user.id, 'PASSWORD_RESET');
    }
    return true;
  }

  @Mutation(() => Boolean)
  async resetPassword(@Args('input') input: ResetPasswordInput): Promise<boolean> {
    const userId = await this.authService.consumeVerificationToken(input.token, 'PASSWORD_RESET');
    const hashed = await (this as any).userService['prisma'].user.update({
      where: { id: userId },
      data: { password: await (await import('bcryptjs')).hash(input.newPassword, 12), passwordUpdatedAt: new Date() },
    });
    return true;
  }

  @Mutation(() => Boolean)
  async verifyEmail(@Args('input') input: VerifyEmailInput): Promise<boolean> {
    const userId = await this.authService.consumeVerificationToken(input.token, 'EMAIL_VERIFY');
    await (this as any).userService['prisma'].user.update({ where: { id: userId }, data: { isEmailVerified: true } });
    return true;
  }
} 