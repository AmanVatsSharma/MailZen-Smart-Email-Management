/**
 * File:        apps/backend/src/automation/actions/notify-slack.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Posts a message to a Slack channel or DM via the Slack Web API
 *              chat.postMessage endpoint. Uses the workspace's bot token stored
 *              in workspace_integrations (provider = SLACK).
 *
 * Exports:
 *   - NotifySlackActionHandler  — Injectable handler for 'notify.slack'
 *
 * Depends on:
 *   - SlackIntegrationService  — getDecryptedToken + getSlackIntegration (for defaultChannel)
 *
 * Side-effects:
 *   - Calls Slack API (chat.postMessage) — external HTTP call
 *
 * Key invariants:
 *   - If Slack is not connected (or revoked), returns { skipped: true } — run continues
 *   - If step.channel is empty, falls back to the workspace default channel from config
 *   - Non-2xx or Slack API error returns { skipped: true } with error logged — same soft-fail
 *     behaviour as ai.classify to avoid cascading run failures on transient Slack errors
 *   - Bot token is never logged
 *
 * Read order:
 *   1. execute  — full flow: resolve token → resolve channel → postMessage
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable, Logger } from '@nestjs/common';
import { AutomationStep, NotifySlackStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { SlackIntegrationService } from '../integrations/slack-integration.service';
import { serializeStructuredLog } from '../../common/logging/structured-log.util';

interface SlackPostMessageResponse {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

@Injectable()
export class NotifySlackActionHandler implements ActionHandler {
  readonly actionType = 'notify.slack' as const;
  private readonly logger = new Logger(NotifySlackActionHandler.name);

  constructor(private readonly slackService: SlackIntegrationService) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'notify.slack') return { skipped: true };

    const slackStep = step as NotifySlackStep;

    // Resolve bot token — soft-skip if workspace has no active Slack integration
    let token: string;
    try {
      token = await this.slackService.getDecryptedToken(ctx.workspaceId);
    } catch {
      this.logger.warn(
        serializeStructuredLog({
          event: 'notify_slack_skipped_not_connected',
          workspaceId: ctx.workspaceId,
          runId: ctx.runId,
        }),
      );
      return { skipped: true };
    }

    // Resolve channel: step value → workspace default → skip
    let channel = slackStep.channel?.trim() ?? '';
    if (!channel) {
      const integration = await this.slackService.getSlackIntegration(ctx.workspaceId);
      const defaultCh = integration?.config?.['defaultChannel'] as
        | { id: string; name: string }
        | undefined;
      channel = defaultCh?.id ?? '';
    }

    if (!channel) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'notify_slack_skipped_no_channel',
          workspaceId: ctx.workspaceId,
          runId: ctx.runId,
        }),
      );
      return { skipped: true };
    }

    const body = JSON.stringify({ channel, text: slackStep.message });

    try {
      const resp = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${token}`,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const data = (await resp.json()) as SlackPostMessageResponse;

      if (!data.ok) {
        this.logger.error(
          serializeStructuredLog({
            event: 'notify_slack_api_error',
            slackError: data.error,
            workspaceId: ctx.workspaceId,
            runId: ctx.runId,
          }),
        );
        // Soft-skip on API errors (e.g. channel_not_found, not_in_channel)
        return { skipped: true };
      }

      this.logger.log(
        serializeStructuredLog({
          event: 'notify_slack_sent',
          workspaceId: ctx.workspaceId,
          runId: ctx.runId,
          channel: data.channel,
          ts: data.ts,
        }),
      );

      return { data: { channel: data.channel, ts: data.ts } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        serializeStructuredLog({
          event: 'notify_slack_fetch_error',
          error: message,
          workspaceId: ctx.workspaceId,
          runId: ctx.runId,
        }),
      );
      return { skipped: true };
    }
  }
}
