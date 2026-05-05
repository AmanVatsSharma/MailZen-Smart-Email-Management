/**
 * File:        apps/backend/src/automation/integrations/slack-oauth.controller.ts
 * Module:      Automation Engine · Integrations
 * Purpose:     REST controller for the Slack OAuth v2 redirect flow.
 *              GET /integrations/slack/install  → redirect to Slack authorize page
 *              GET /integrations/slack/callback → exchange code, store token, redirect to frontend
 *
 * Exports:
 *   - SlackOAuthController  — NestJS @Controller
 *
 * Depends on:
 *   - SlackIntegrationService  — all business logic
 *   - JwtAuthGuard             — protects /install (user must be logged in)
 *
 * Side-effects:
 *   - /install performs a 302 redirect to Slack's OAuth page
 *   - /callback stores the bot token (via SlackIntegrationService) and 302s to the frontend
 *
 * Key invariants:
 *   - /callback does NOT require a JWT cookie — Slack sends the callback directly
 *   - On error, redirects to /settings/integrations?slack=error rather than returning 500
 *   - workspaceId is recovered from the signed OAuth state, never from URL params
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Controller, Get, Logger, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SlackIntegrationService } from './slack-integration.service';
import { serializeStructuredLog } from '../../common/logging/structured-log.util';

@Controller('integrations/slack')
export class SlackOAuthController {
  private readonly logger = new Logger(SlackOAuthController.name);
  private readonly frontendBase =
    process.env.FRONTEND_URL ?? 'http://localhost:3000';

  constructor(private readonly slackService: SlackIntegrationService) {}

  @Get('install')
  @UseGuards(JwtAuthGuard)
  install(
    @Query('workspaceId') workspaceId: string,
    @Res() res: Response,
  ): void {
    if (!workspaceId) {
      res.status(400).send('workspaceId required');
      return;
    }
    const url = this.slackService.getInstallUrl(workspaceId);
    res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') slackError: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (slackError) {
      this.logger.warn(
        serializeStructuredLog({ event: 'slack_oauth_user_denied', error: slackError }),
      );
      res.redirect(`${this.frontendBase}/settings/integrations?slack=denied`);
      return;
    }

    try {
      const { workspaceId } = await this.slackService.handleCallback(code, state);
      res.redirect(
        `${this.frontendBase}/settings/integrations?slack=connected&workspaceId=${workspaceId}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        serializeStructuredLog({ event: 'slack_oauth_callback_error', error: message }),
      );
      res.redirect(`${this.frontendBase}/settings/integrations?slack=error`);
    }
  }
}
