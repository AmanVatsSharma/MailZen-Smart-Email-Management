import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { UserService } from '../user/user.service';
import { UnauthorizedException } from '@nestjs/common';
import { AuthResponse } from './dto/auth-response';

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
} 