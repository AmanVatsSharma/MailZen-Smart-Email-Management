import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailFilterService } from './email.email-filter.service';
import { CreateEmailFilterInput } from './dto/email-filter.input';
import { EmailFilter } from '@prisma/client';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver('EmailFilter')
export class EmailFilterResolver {
  constructor(private readonly emailFilterService: EmailFilterService) {}

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async createEmailFilter(
    @Args('input') input: CreateEmailFilterInput,
    @Context() context: RequestContext,
  ) {
    await this.emailFilterService.createFilter(input, context.req.user.id);
    return true;
  }

  @Query(() => [EmailFilter])
  @UseGuards(JwtAuthGuard)
  async getEmailFilters(@Context() context: RequestContext) {
    return this.emailFilterService.getFilters(context.req.user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteEmailFilter(
    @Args('id') id: string,
    @Context() context: RequestContext,
  ) {
    await this.emailFilterService.deleteFilter(id, context.req.user.id);
    return true;
  }
} 