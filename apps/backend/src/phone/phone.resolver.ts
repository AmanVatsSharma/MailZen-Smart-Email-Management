import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PhoneService } from './phone.service';
import { AuthAbuseProtectionService } from '../auth/auth-abuse-protection.service';

interface RequestContext {
  req: {
    user: { id: string };
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
  };
}

@Resolver('Phone')
@UseGuards(JwtAuthGuard)
export class PhoneResolver {
  constructor(
    private readonly phoneService: PhoneService,
    private readonly authAbuseProtection: AuthAbuseProtectionService,
  ) {}

  @Mutation(() => Boolean)
  async sendPhoneOtp(
    @Args('phoneNumber') phoneNumber: string,
    @Context() ctx: RequestContext,
  ) {
    this.authAbuseProtection.enforceLimit({
      operation: 'phone_send_otp',
      request: ctx?.req,
      identifier: phoneNumber,
    });
    return this.phoneService.sendOtp(ctx.req.user.id, phoneNumber);
  }

  @Mutation(() => Boolean)
  async verifyPhoneOtp(
    @Args('code') code: string,
    @Context() ctx: RequestContext,
  ) {
    this.authAbuseProtection.enforceLimit({
      operation: 'phone_verify_otp',
      request: ctx?.req,
      identifier: ctx?.req?.user?.id,
    });
    return this.phoneService.verifyOtp(ctx.req.user.id, code);
  }
}
