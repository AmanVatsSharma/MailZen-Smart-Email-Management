/**
 * File:        apps/backend/src/automation/condition-evaluator.ts
 * Module:      Automation Engine · Condition Evaluator
 * Purpose:     Pure recursive evaluator for AutomationConditionNode boolean trees.
 *              Called by the dispatcher before enqueueing a run — returns true when
 *              the trigger event satisfies the automation's configured conditions.
 *
 * Exports:
 *   - evaluateCondition(node, ctx) → boolean  — main evaluation entry point
 *
 * Depends on:
 *   - @mailzen/shared-types — AutomationConditionNode, ConditionOp, AutomationEvent
 *
 * Side-effects:
 *   - none (pure function)
 *
 * Key invariants:
 *   - Unknown field paths return false (not throws) — permissive for event shape evolution
 *   - Unknown ops throw — programmer error, not event shape mismatch
 *   - Nested trees evaluated recursively; short-circuit on first failure (all) / success (any)
 *
 * Read order:
 *   1. evaluateCondition  — top-level; branches on node shape
 *   2. evaluateLeaf       — leaf comparisons
 *   3. resolveField       — dot-notation field access on event context
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { AutomationConditionNode, AutomationEvent, ConditionOp } from '@mailzen/shared-types';

type EvalContext = {
  event: AutomationEvent;
  stepOutputs?: Record<number, Record<string, unknown>>;
};

function resolveField(field: string, ctx: EvalContext): unknown {
  const segments = field.split('.');
  let current: unknown = ctx.event;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function applyOp(op: ConditionOp, fieldValue: unknown, expected: unknown): boolean {
  const strField = String(fieldValue ?? '').toLowerCase();
  const strExpected = String(expected ?? '').toLowerCase();

  switch (op) {
    case 'equals':
      return String(fieldValue) === String(expected);
    case 'not_equals':
      return String(fieldValue) !== String(expected);
    case 'contains':
      return strField.includes(strExpected);
    case 'not_contains':
      return !strField.includes(strExpected);
    case 'starts_with':
      return strField.startsWith(strExpected);
    case 'ends_with':
      return strField.endsWith(strExpected);
    case 'gt':
      return Number(fieldValue) > Number(expected);
    case 'lt':
      return Number(fieldValue) < Number(expected);
    case 'gte':
      return Number(fieldValue) >= Number(expected);
    case 'lte':
      return Number(fieldValue) <= Number(expected);
    case 'is_empty':
      return fieldValue == null || String(fieldValue).trim() === '';
    case 'is_not_empty':
      return fieldValue != null && String(fieldValue).trim() !== '';
    default: {
      const exhaustive: never = op;
      throw new Error(`Unknown condition op: ${exhaustive}`);
    }
  }
}

function evaluateLeaf(
  node: { field: string; op: ConditionOp; value?: string | number | boolean },
  ctx: EvalContext,
): boolean {
  const fieldValue = resolveField(node.field, ctx);
  if (fieldValue === undefined) return false;

  if (Array.isArray(fieldValue)) {
    return fieldValue.some((item) => applyOp(node.op, item, node.value));
  }

  return applyOp(node.op, fieldValue, node.value);
}

export function evaluateCondition(node: AutomationConditionNode, ctx: EvalContext): boolean {
  if ('all' in node) {
    return node.all.every((child) => evaluateCondition(child, ctx));
  }
  if ('any' in node) {
    return node.any.some((child) => evaluateCondition(child, ctx));
  }
  return evaluateLeaf(node, ctx);
}
