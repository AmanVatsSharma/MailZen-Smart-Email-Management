import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PhoneService } from './phone.service';

interface RequestContext { req: { user: { id: string } } }

@Resolver('Phone')
@UseGuards(JwtAuthGuard)
export class PhoneResolver {
  constructor(private readonly phoneService: PhoneService) {}

  @Mutation(() => Boolean)
  async sendPhoneOtp(@Args('phoneNumber') phoneNumber: string, @Context() ctx: RequestContext) {
    return this.phoneService.sendOtp(ctx.req.user.id, phoneNumber);
  }

  @Mutation(() => Boolean)
  async verifyPhoneOtp(@Args('code') code: string, @Context() ctx: RequestContext) {
    return this.phoneService.verifyOtp(ctx.req.user.id, code);
  }
}
