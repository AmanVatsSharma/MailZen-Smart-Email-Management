import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { UserService } from '../user/user.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthResponse } from './dto/auth-response';
import { CreateUserInput } from '../user/dto/create-user.input';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

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
    
    return {
      token: accessToken,
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
    return { token: accessToken, user };
  }

  // TODO: add refresh, logout, forgot/reset password, email verify in follow-up edits
} 