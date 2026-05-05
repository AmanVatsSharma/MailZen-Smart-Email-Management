/**
 * File:        apps/backend/src/automation/actions/webhook-post.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     POSTs the automation run context to an external webhook URL.
 *              Signs the payload with HMAC-SHA256 using the workspace's stored secret.
 *
 * Exports:
 *   - WebhookPostActionHandler  — Injectable handler for 'webhook.post'
 *
 * Depends on:
 *   - WebhookIntegrationService  — loads and decrypts the HMAC signing secret
 *
 * Side-effects:
 *   - Outbound HTTP POST to the configured webhook URL
 *
 * Key invariants:
 *   - X-MailZen-Signature header: "sha256=<hex>" per architecture invariant §2.5
 *   - If no active webhook integration → returns skipped=true (safe)
 *   - POST body: { runId, workspaceId, triggerEvent, stepIndex, stepInput }
 *   - 30-second fetch timeout; throws on non-2xx so the worker can retry
 *
 * Read order:
 *   1. execute()  — resolve URL/secret → build payload → sign → POST
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { AutomationStep, WebhookPostStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { WebhookIntegrationService } from '../integrations/webhook-integration.service';
import { serializeStructuredLog } from '../../common/logging/structured-log.util';

@Injectable()
export class WebhookPostActionHandler implements ActionHandler {
  private readonly logger = new Logger(WebhookPostActionHandler.name);
  readonly actionType = 'webhook.post' as const;

  constructor(
    private readonly webhookIntegrationService: WebhookIntegrationService,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'webhook.post') return { skipped: true };

    const webhookStep = step as WebhookPostStep;

    const integration = await this.webhookIntegrationService.getIntegrationById(webhookStep.integrationId, ctx.workspaceId);
    if (!integration) return { skipped: true };

    const config = integration.config as Record<string, unknown> | null;
    const url = config?.['url'] as string | undefined;
    if (!url) return { skipped: true };

    const secret = await this.webhookIntegrationService.getDecryptedSecretById(webhookStep.integrationId, ctx.workspaceId);
    if (!secret) return { skipped: true };

    const payload = {
      runId: ctx.runId,
      workspaceId: ctx.workspaceId,
      stepIndex: ctx.stepIndex,
      correlationId: ctx.correlationId,
      triggerEvent: ctx.triggerEvent,
      stepInput: webhookStep,
    };
    const body = JSON.stringify(payload);

    const signature = createHmac('sha256', secret).update(body).digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MailZen-Signature': `sha256=${signature}`,
          'X-MailZen-Run-Id': ctx.runId,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Webhook POST failed with status ${response.status}`);
      }

      this.logger.log(
        serializeStructuredLog({
          event: 'automation_webhook_post_succeeded',
          runId: ctx.runId,
          url,
          status: response.status,
          correlationId: ctx.correlationId,
        }),
      );

      return { data: { url, status: response.status } };
    } finally {
      clearTimeout(timeout);
    }
  }
}
