import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailFilterService } from './email.email-filter.service';
import { CreateEmailFilterInput } from './dto/email-filter.input';
import { EmailFilter } from './entities/email-filter.entity';

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

  @Query(() => [String], {
    description: 'Returns JSON stringified filters for now',
  })
  @UseGuards(JwtAuthGuard)
  async getEmailFilters(@Context() context: RequestContext) {
    const filters = await this.emailFilterService.getFilters(
      context.req.user.id,
    );
    return filters.map((f: EmailFilter) =>
      JSON.stringify({ id: f.id, name: f.name, rules: f.rules }),
    );
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
