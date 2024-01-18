import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  validateToken(token: string): any {
    return this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
  }

  login(user: any): { accessToken: string } {
    const payload = { id: user.id, email: user.email, roles: user.roles };
    return { 
      accessToken: this.jwtService.sign(payload, { 
        secret: process.env.JWT_SECRET || 'default-secret', 
        expiresIn: process.env.JWT_EXPIRATION ? `${process.env.JWT_EXPIRATION}s` : '24h' 
      }) 
    };
  }
} 