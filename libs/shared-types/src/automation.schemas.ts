/**
 * File:        libs/shared-types/src/automation.schemas.ts
 * Module:      Automation Engine · JSON Schema / AJV Validation
 * Purpose:     AJV JSON schemas for runtime validation of automation trigger configs,
 *              condition trees, and action step arrays passed via GraphQL mutations.
 *              Used by the backend resolver to reject malformed input with descriptive errors.
 *
 * Exports:
 *   - TRIGGER_SCHEMA            — JSON Schema for a single trigger config object
 *   - CONDITION_SCHEMA          — JSON Schema for a condition tree node (recursive)
 *   - STEPS_SCHEMA              — JSON Schema for an ordered array of step objects
 *   - validateTrigger(data)     — AJV-compiled validator; returns error string or null
 *   - validateCondition(data)   — AJV-compiled validator; returns error string or null
 *   - validateSteps(data)       — AJV-compiled validator; returns error string or null
 *
 * Depends on:
 *   - ajv  — JSON Schema draft-07 runtime validator
 *
 * Side-effects:
 *   - none — validators are compiled once on module load (cheap, pure in-memory)
 *
 * Key invariants:
 *   - Schemas are intentionally permissive on extra properties (additionalProperties not
 *     enforced) to avoid breaking callers that add forward-compatible fields
 *   - Each trigger type requires its own `type` string literal for discriminated union
 *   - Condition leaf `op` must be one of the 12 registered ConditionOp values
 *   - Steps array must contain at least one item
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, useDefaults: true });

// ─── Trigger schemas ──────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  'email.received',
  'email.thread.replied',
  'email.thread.assigned',
  'email.label.added',
  'schedule.cron',
  'manual',
] as const;

export const TRIGGER_SCHEMA = {
  type: 'object',
  required: ['type'],
  properties: {
    type: { type: 'string', enum: TRIGGER_TYPES },
    // email.received / replied / assigned / label.added have no required extra fields
    labelName: { type: 'string' },
    // schedule.cron
    expression: { type: 'string' },
    timezone: { type: 'string' },
  },
  if: { properties: { type: { const: 'schedule.cron' } } },
  then: { required: ['expression'] },
};

// ─── Condition schema (recursive) ────────────────────────────────────────

const CONDITION_OPS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'gt',
  'lt',
  'gte',
  'lte',
  'is_empty',
  'is_not_empty',
] as const;

// AJV v6 needs $schema to be omitted or draft-07 for recursive schemas via $ref
export const CONDITION_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'AutomationCondition',
  type: 'object',
  oneOf: [
    // AND group
    {
      required: ['all'],
      properties: {
        all: { type: 'array', items: { $ref: '#' }, minItems: 1 },
      },
    },
    // OR group
    {
      required: ['any'],
      properties: {
        any: { type: 'array', items: { $ref: '#' }, minItems: 1 },
      },
    },
    // Leaf
    {
      required: ['field', 'op', 'value'],
      properties: {
        field: { type: 'string', minLength: 1 },
        op: { type: 'string', enum: CONDITION_OPS },
        value: {},
      },
    },
  ],
};

// ─── Step schemas ─────────────────────────────────────────────────────────

const STEP_BASE = {
  type: 'object',
  required: ['type'],
  properties: {
    type: { type: 'string' },
  },
};

const EMAIL_LABEL_STEP = {
  allOf: [
    STEP_BASE,
    {
      properties: {
        type: { enum: ['email.label.add', 'email.label.remove'] },
        labelId: { type: 'string' },
        labelName: { type: 'string' },
        createIfMissing: { type: 'boolean' },
      },
    },
  ],
};

const EMAIL_ARCHIVE_STEP = {
  allOf: [
    STEP_BASE,
    { properties: { type: { const: 'email.archive' } } },
  ],
};

const EMAIL_ASSIGN_STEP = {
  allOf: [
    STEP_BASE,
    {
      properties: {
        type: { const: 'email.assign' },
        userId: { type: 'string' },
        roundRobin: { type: 'boolean' },
      },
    },
  ],
};

const NOTIFY_USER_STEP = {
  allOf: [
    STEP_BASE,
    {
      required: ['type', 'title', 'message'],
      properties: {
        type: { const: 'notify.user' },
        targetUserId: { type: 'string' },
        title: { type: 'string' },
        message: { type: 'string' },
      },
    },
  ],
};

const AI_CLASSIFY_STEP = {
  allOf: [
    STEP_BASE,
    { properties: { type: { const: 'ai.classify' } } },
  ],
};

const WEBHOOK_POST_STEP = {
  allOf: [
    STEP_BASE,
    {
      required: ['type', 'integrationId'],
      properties: {
        type: { const: 'webhook.post' },
        integrationId: { type: 'string' },
        payload: { type: 'object' },
      },
    },
  ],
};

const DELAY_STEP = {
  allOf: [
    STEP_BASE,
    {
      required: ['type', 'delayMs'],
      properties: {
        type: { const: 'delay' },
        delayMs: { type: 'number', minimum: 1000 },
      },
    },
  ],
};

export const STEPS_SCHEMA = {
  type: 'array',
  minItems: 1,
  items: {
    type: 'object',
    required: ['type'],
    properties: {
      type: {
        type: 'string',
        enum: [
          'email.label.add',
          'email.label.remove',
          'email.archive',
          'email.assign',
          'email.draft.create',
          'email.draft.send',
          'notify.user',
          'notify.slack',
          'ai.classify',
          'ai.summarize',
          'ai.draft.reply',
          'webhook.post',
          'delay',
        ],
      },
    },
    // Step-specific constraints applied via anyOf for discriminated union
    anyOf: [
      EMAIL_LABEL_STEP,
      EMAIL_ARCHIVE_STEP,
      EMAIL_ASSIGN_STEP,
      NOTIFY_USER_STEP,
      AI_CLASSIFY_STEP,
      WEBHOOK_POST_STEP,
      DELAY_STEP,
      // Permissive fallback for draft/summarize/slack steps (M2 additions)
      { required: ['type'] },
    ],
  },
};

// ─── Compiled validators ──────────────────────────────────────────────────

const validateTriggerFn = ajv.compile(TRIGGER_SCHEMA);
const validateConditionFn = ajv.addSchema(CONDITION_SCHEMA).compile(CONDITION_SCHEMA);
const validateStepsFn = ajv.compile(STEPS_SCHEMA);

function formatErrors(errors: Ajv.ErrorObject[] | null | undefined): string {
  if (!errors?.length) return 'Unknown validation error';
  return errors.map((e) => `${e.dataPath || '(root)'} ${e.message}`).join('; ');
}

export function validateTrigger(data: unknown): string | null {
  const valid = validateTriggerFn(data);
  return valid ? null : formatErrors(validateTriggerFn.errors);
}

export function validateCondition(data: unknown): string | null {
  const valid = validateConditionFn(data);
  return valid ? null : formatErrors(validateConditionFn.errors);
}

export function validateSteps(data: unknown): string | null {
  const valid = validateStepsFn(data);
  return valid ? null : formatErrors(validateStepsFn.errors);
}
