import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailProviderService } from './email-provider.service';
import { Provider } from './entities/provider.entity';
import { ProviderActionResult } from './entities/provider-action-result.entity';
import { SmtpSettingsInput } from './dto/smtp-settings.input';
import { PrismaService } from '../prisma/prisma.service';
import { GmailSyncService } from '../gmail-sync/gmail-sync.service';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

/**
 * Frontend-facing provider connect + management mutations.
 *
 * This intentionally matches the names used in:
 * - `apps/frontend/lib/providers/provider-utils.ts`
 */
@Resolver(() => Provider)
@UseGuards(JwtAuthGuard)
export class EmailProviderConnectResolver {
  constructor(
    private readonly emailProviderService: EmailProviderService,
    private readonly prisma: PrismaService,
    private readonly gmailSync: GmailSyncService,
  ) {}

  @Mutation(() => Provider)
  async connectGmail(@Args('code') code: string, @Context() ctx: RequestContext) {
    return this.emailProviderService.connectGmail(code, ctx.req.user.id);
  }

  @Mutation(() => Provider)
  async connectOutlook(@Args('code') code: string, @Context() ctx: RequestContext) {
    return this.emailProviderService.connectOutlook(code, ctx.req.user.id);
  }

  @Mutation(() => Provider)
  async connectSmtp(@Args('settings') settings: SmtpSettingsInput, @Context() ctx: RequestContext) {
    return this.emailProviderService.connectSmtp(settings, ctx.req.user.id);
  }

  @Mutation(() => ProviderActionResult)
  async disconnectProvider(@Args('id') id: string, @Context() ctx: RequestContext) {
    return this.emailProviderService.disconnectProvider(id, ctx.req.user.id);
  }

  @Mutation(() => Provider)
  async updateProvider(
    @Args('id') id: string,
    @Args('isActive', { nullable: true }) isActive: boolean | null,
    @Context() ctx: RequestContext
  ) {
    return this.emailProviderService.setActiveProvider(id, ctx.req.user.id, isActive ?? undefined);
  }

  @Mutation(() => Provider)
  async syncProvider(@Args('id') id: string, @Context() ctx: RequestContext) {
    // If it's a Gmail provider, trigger a real sync into DB.
    const provider = await this.prisma.emailProvider.findFirst({ where: { id, userId: ctx.req.user.id } });
    if (provider?.type === 'GMAIL') {
      await this.gmailSync.syncGmailProvider(id, ctx.req.user.id, 25);
      const providers = await this.emailProviderService.listProvidersUi(ctx.req.user.id);
      return (providers.find(p => p.id === id) || (await this.emailProviderService.syncProvider(id, ctx.req.user.id))) as any;
    }
    return this.emailProviderService.syncProvider(id, ctx.req.user.id);
  }

  @Query(() => [Provider])
  async providers(@Context() ctx: RequestContext) {
    return this.emailProviderService.listProvidersUi(ctx.req.user.id);
  }

  /**
   * Backwards-compatible alias for older frontend queries.
   * Prefer `providers`.
   */
  @Query(() => [Provider])
  async getEmailProviders(@Context() ctx: RequestContext) {
    return this.emailProviderService.listProvidersUi(ctx.req.user.id);
  }

  /**
   * Backwards-compatible alias for older frontend mutations.
   * Prefer `updateProvider`.
   */
  @Mutation(() => Provider)
  async updateProviderStatus(
    @Args('id') id: string,
    @Args('isActive', { nullable: true }) isActive: boolean | null,
    @Context() ctx: RequestContext
  ) {
    return this.emailProviderService.setActiveProvider(id, ctx.req.user.id, isActive ?? undefined);
  }
}

