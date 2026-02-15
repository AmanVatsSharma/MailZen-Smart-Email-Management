import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailProviderService } from './email-provider.service';
import { Provider } from './entities/provider.entity';
import { ProviderActionResult } from './entities/provider-action-result.entity';
import { SmtpSettingsInput } from './dto/smtp-settings.input';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailProvider } from './entities/email-provider.entity';
import { GmailSyncService } from '../gmail-sync/gmail-sync.service';
import { OutlookSyncService } from '../outlook-sync/outlook-sync.service';

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
    @InjectRepository(EmailProvider)
    private readonly emailProviderRepo: Repository<EmailProvider>,
    private readonly gmailSync: GmailSyncService,
    private readonly outlookSync: OutlookSyncService,
  ) {}

  @Mutation(() => Provider)
  async connectGmail(
    @Args('code') code: string,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.connectGmail(code, ctx.req.user.id);
  }

  @Mutation(() => Provider)
  async connectOutlook(
    @Args('code') code: string,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.connectOutlook(code, ctx.req.user.id);
  }

  @Mutation(() => Provider)
  async connectSmtp(
    @Args('settings') settings: SmtpSettingsInput,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.connectSmtp(settings, ctx.req.user.id);
  }

  @Mutation(() => ProviderActionResult)
  async disconnectProvider(
    @Args('id') id: string,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.disconnectProvider(id, ctx.req.user.id);
  }

  @Mutation(() => Provider)
  async updateProvider(
    @Args('id') id: string,
    // Explicit type required (nullable boolean unions can break GraphQL reflection).
    @Args('isActive', { type: () => Boolean, nullable: true })
    isActive: boolean,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.setActiveProvider(
      id,
      ctx.req.user.id,
      isActive ?? undefined,
    );
  }

  @Mutation(() => Provider)
  async syncProvider(@Args('id') id: string, @Context() ctx: RequestContext) {
    // Trigger real provider-specific sync into DB when available.
    const provider = await this.emailProviderRepo.findOne({
      where: { id, userId: ctx.req.user.id },
    });
    if (provider?.type === 'GMAIL') {
      await this.gmailSync.syncGmailProvider(id, ctx.req.user.id, 25);
      const providers = await this.emailProviderService.listProvidersUi(
        ctx.req.user.id,
      );
      const syncedProvider = providers.find((p) => p.id === id);
      if (syncedProvider) return syncedProvider;
      return this.emailProviderService.syncProvider(id, ctx.req.user.id);
    }

    if (provider?.type === 'OUTLOOK') {
      await this.outlookSync.syncOutlookProvider(id, ctx.req.user.id, 25);
      const providers = await this.emailProviderService.listProvidersUi(
        ctx.req.user.id,
      );
      const syncedProvider = providers.find((p) => p.id === id);
      if (syncedProvider) return syncedProvider;
      return this.emailProviderService.syncProvider(id, ctx.req.user.id);
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
    @Args('isActive', { type: () => Boolean, nullable: true })
    isActive: boolean,
    @Context() ctx: RequestContext,
  ) {
    return this.emailProviderService.setActiveProvider(
      id,
      ctx.req.user.id,
      isActive ?? undefined,
    );
  }
}
