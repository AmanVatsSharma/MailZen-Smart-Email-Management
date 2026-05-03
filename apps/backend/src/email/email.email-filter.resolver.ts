/**
 * File:        apps/backend/src/email/email.email-filter.resolver.ts
 * Module:      Email · GraphQL Resolver · Email Filters (legacy)
 * Purpose:     GraphQL mutations and queries for legacy EmailFilter rules.
 *              All operations are @deprecated — new code should use the Automation Engine.
 *
 * Exports:
 *   - EmailFilterResolver  — @Resolver('EmailFilter') NestJS class
 *
 * Depends on:
 *   - EmailFilterService  — CRUD for email_filters rows
 *
 * Side-effects:
 *   - DB reads/writes via EmailFilterService
 *
 * Key invariants:
 *   - All three operations carry deprecationReason pointing to Automation Engine
 *   - Legacy filters are preserved for migration read-back; no new features added here
 *
 * Read order:
 *   1. createEmailFilter  — write path (deprecated)
 *   2. getEmailFilters    — read path (deprecated)
 *   3. deleteEmailFilter  — delete path (deprecated)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

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

const DEPRECATION_REASON = 'Use Automation Engine instead. EmailFilter will be removed in v2.';

@Resolver('EmailFilter')
export class EmailFilterResolver {
  constructor(private readonly emailFilterService: EmailFilterService) {}

  @Mutation(() => Boolean, { deprecationReason: DEPRECATION_REASON })
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
    deprecationReason: DEPRECATION_REASON,
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

  @Mutation(() => Boolean, { deprecationReason: DEPRECATION_REASON })
  @UseGuards(JwtAuthGuard)
  async deleteEmailFilter(
    @Args('id') id: string,
    @Context() context: RequestContext,
  ) {
    await this.emailFilterService.deleteFilter(id, context.req.user.id);
    return true;
  }
}
