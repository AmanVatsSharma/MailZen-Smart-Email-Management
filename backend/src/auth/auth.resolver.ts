import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
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
  async login(
    @Args('loginInput') loginInput: LoginInput,
    @Context() ctx: any,
  ): Promise<AuthResponse> {
    const user = await this.userService.validateUser(
      loginInput.email,
      loginInput.password
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { accessToken } = this.authService.login(user);
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      const maxAgeSeconds = parseInt(process.env.JWT_EXPIRATION || '86400');
      if (ctx?.res?.cookie) {
        ctx.res.cookie('token', accessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          path: '/',
          maxAge: maxAgeSeconds * 1000,
        });
      } else if (ctx?.res?.setHeader) {
        ctx.res.setHeader('Set-Cookie', `token=${accessToken}; Path=/; Max-Age=${maxAgeSeconds}; ${isProduction ? 'Secure; ' : ''}HttpOnly; SameSite=Lax`);
      }
    } catch (e) {
      // ignore cookie set failure to still return token
    }
    
    return {
      token: accessToken,
      user
    };
  }
} 