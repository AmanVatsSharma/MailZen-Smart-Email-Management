/**
 * File:        libs/shared-types/src/automation.types.ts
 * Module:      Shared Types · Automation Engine
 * Purpose:     Discriminated unions for all automation trigger, condition, step, and event
 *              types. Shared between backend (NestJS) and frontend (Next.js) so both use
 *              the same type vocabulary without duplication.
 *
 * Exports:
 *   - AutomationTriggerType    — union of all supported trigger type strings
 *   - AutomationTrigger        — discriminated union of trigger config objects
 *   - AutomationConditionNode  — recursive boolean tree (all / any / leaf)
 *   - ConditionOp              — supported comparison operators
 *   - AutomationActionType     — union of all supported action type strings
 *   - AutomationStep           — discriminated union of action step objects
 *   - AutomationEvent          — discriminated union of runtime events published to the bus
 *
 * Depends on:
 *   - none (pure TypeScript, no runtime dependencies)
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - Every discriminated union uses a `type` field as the discriminant
 *   - AutomationEvent carries workspaceId + userId for tenancy enforcement at the dispatcher
 *   - Steps carry `stepIndex` only at runtime (AutomationVersion.steps is an ordered array)
 *
 * Read order:
 *   1. AutomationTriggerType / AutomationTrigger  — trigger taxonomy
 *   2. AutomationConditionNode                    — condition tree shape
 *   3. AutomationActionType / AutomationStep      — action taxonomy
 *   4. AutomationEvent                            — runtime event union
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

// ─── Trigger types ────────────────────────────────────────────────────────────

export type AutomationTriggerType =
  | 'email.received'
  | 'email.thread.replied'
  | 'email.thread.assigned'
  | 'email.label.added'
  | 'schedule.cron'
  | 'manual';

export type EmailReceivedTrigger = {
  type: 'email.received';
};

export type EmailThreadRepliedTrigger = {
  type: 'email.thread.replied';
};

export type EmailThreadAssignedTrigger = {
  type: 'email.thread.assigned';
};

export type EmailLabelAddedTrigger = {
  type: 'email.label.added';
  /** If set, only fires when this label (by name) is added */
  labelName?: string;
};

export type ScheduleCronTrigger = {
  type: 'schedule.cron';
  /** Standard 5-field cron expression, e.g. "0 9 * * 1" = every Monday 9am */
  expression: string;
  /** IANA timezone, e.g. "America/New_York". Defaults to UTC if omitted. */
  timezone?: string;
};

export type ManualTrigger = {
  type: 'manual';
};

export type AutomationTrigger =
  | EmailReceivedTrigger
  | EmailThreadRepliedTrigger
  | EmailThreadAssignedTrigger
  | EmailLabelAddedTrigger
  | ScheduleCronTrigger
  | ManualTrigger;

// ─── Condition tree ───────────────────────────────────────────────────────────

export type ConditionOp =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'is_empty'
  | 'is_not_empty';

export type ConditionLeaf = {
  field: string;
  op: ConditionOp;
  value?: string | number | boolean;
};

export type ConditionAll = {
  all: AutomationConditionNode[];
};

export type ConditionAny = {
  any: AutomationConditionNode[];
};

export type AutomationConditionNode = ConditionAll | ConditionAny | ConditionLeaf;

// ─── Action / Step types ──────────────────────────────────────────────────────

export type AutomationActionType =
  | 'email.label.add'
  | 'email.label.remove'
  | 'email.archive'
  | 'email.assign'
  | 'email.draft.create'
  | 'email.draft.send'
  | 'notify.user'
  | 'notify.slack'
  | 'ai.classify'
  | 'ai.summarize'
  | 'ai.draft.reply'
  | 'webhook.post'
  | 'delay';

export type EmailLabelAddStep = {
  type: 'email.label.add';
  labelId?: string;
  labelName?: string;
  /** Create the label if it doesn't exist yet */
  createIfMissing?: boolean;
};

export type EmailLabelRemoveStep = {
  type: 'email.label.remove';
  labelId?: string;
  labelName?: string;
};

export type EmailArchiveStep = {
  type: 'email.archive';
};

export type EmailAssignStep = {
  type: 'email.assign';
  /** Direct assignment target */
  userId?: string;
  /** Round-robin among workspace members */
  roundRobin?: boolean;
};

export type EmailDraftCreateStep = {
  type: 'email.draft.create';
  subject?: string;
  body?: string;
};

export type EmailDraftSendStep = {
  type: 'email.draft.send';
  /** Uses draft from a prior email.draft.create step output if omitted */
  draftId?: string;
};

export type NotifyUserStep = {
  type: 'notify.user';
  targetUserId: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type NotifySlackStep = {
  type: 'notify.slack';
  /** Slack channel ID or DM target (e.g. "#general" or "@username") */
  channel: string;
  message: string;
};

export type AiClassifyStep = {
  type: 'ai.classify';
};

export type AiSummarizeStep = {
  type: 'ai.summarize';
};

export type AiDraftReplyStep = {
  type: 'ai.draft.reply';
  /** Prompt hint for the AI, e.g. "polite decline" */
  tone?: string;
};

export type WebhookPostStep = {
  type: 'webhook.post';
  /** workspace_integrations.id for the WEBHOOK_GENERIC integration to use */
  integrationId: string;
};

export type DelayStep = {
  type: 'delay';
  /** Delay duration in milliseconds */
  durationMs: number;
};

export type AutomationStep =
  | EmailLabelAddStep
  | EmailLabelRemoveStep
  | EmailArchiveStep
  | EmailAssignStep
  | EmailDraftCreateStep
  | EmailDraftSendStep
  | NotifyUserStep
  | NotifySlackStep
  | AiClassifyStep
  | AiSummarizeStep
  | AiDraftReplyStep
  | WebhookPostStep
  | DelayStep;

// ─── Runtime events (published to AutomationEventBus) ─────────────────────────

export type AutomationEventBase = {
  workspaceId: string;
  userId: string;
  correlationId?: string;
};

export type EmailReceivedEvent = AutomationEventBase & {
  type: 'email.received';
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  labels: string[];
};

export type EmailThreadRepliedEvent = AutomationEventBase & {
  type: 'email.thread.replied';
  messageId: string;
  threadId: string;
  replyFrom: string;
};

export type EmailThreadAssignedEvent = AutomationEventBase & {
  type: 'email.thread.assigned';
  threadId: string;
  assignedToUserId: string;
  assignedByUserId: string;
};

export type EmailLabelAddedEvent = AutomationEventBase & {
  type: 'email.label.added';
  messageId: string;
  threadId?: string;
  labelId: string;
  labelName: string;
};

export type ScheduleCronEvent = AutomationEventBase & {
  type: 'schedule.cron';
  automationId: string;
  scheduledAt: Date;
};

export type ManualTriggerEvent = AutomationEventBase & {
  type: 'manual';
  automationId: string;
  contextOverride?: Record<string, unknown>;
};

export type AutomationEvent =
  | EmailReceivedEvent
  | EmailThreadRepliedEvent
  | EmailThreadAssignedEvent
  | EmailLabelAddedEvent
  | ScheduleCronEvent
  | ManualTriggerEvent;
