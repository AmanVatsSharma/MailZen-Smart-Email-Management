/**
 * File:        apps/backend/src/core/domain/bounded-contexts/messaging/email-filter.specification.ts
 * Module:      Core · Domain · Messaging
 * Purpose:     Specification pattern for matching an Email against a set of
 *              field/value/condition rules. Replaces the imperative filter logic
 *              in the legacy EmailFilterService with composable predicates.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { Email } from './email.aggregate';

export type FilterCondition =
  | 'CONTAINS'
  | 'EQUALS'
  | 'STARTS_WITH'
  | 'ENDS_WITH';

export type FilterAction =
  | 'MARK_READ'
  | 'MARK_IMPORTANT'
  | 'MOVE_TO_FOLDER'
  | 'APPLY_LABEL'
  | 'FORWARD_TO';

export interface EmailFilterRule {
  field: 'subject' | 'from' | 'body' | 'bodyHtml' | 'to';
  condition: FilterCondition;
  value: string;
  action: FilterAction;
  actionValue?: string;
}

export interface EmailFilter {
  readonly id: string;
  readonly name: string;
  readonly rules: ReadonlyArray<EmailFilterRule>;
  matches(email: Email): boolean;
  toJSON(): { id: string; name: string; rules: EmailFilterRule[] };
}

export function buildEmailFilter(input: {
  id: string;
  name: string;
  rules: ReadonlyArray<EmailFilterRule>;
}): EmailFilter {
  return {
    id: input.id,
    name: input.name,
    rules: input.rules,
    matches(email: Email): boolean {
      return input.rules.every((rule) => evaluateRule(email, rule));
    },
    toJSON() {
      return { id: input.id, name: input.name, rules: [...input.rules] };
    },
  };
}

function fieldValue(email: Email, field: EmailFilterRule['field']): string {
  switch (field) {
    case 'subject': return email.subject;
    case 'from': return email.from.toString();
    case 'body': return email.bodyText;
    case 'bodyHtml': return email.bodyHtml;
    case 'to': return email.toRecipients.map((r) => r.toString()).join(',');
  }
}

function evaluateRule(email: Email, rule: EmailFilterRule): boolean {
  const value = fieldValue(email, rule.field).toLowerCase();
  const test = rule.value.toLowerCase();
  switch (rule.condition) {
    case 'CONTAINS': return value.includes(test);
    case 'EQUALS': return value === test;
    case 'STARTS_WITH': return value.startsWith(test);
    case 'ENDS_WITH': return value.endsWith(test);
  }
}

export function and(left: EmailFilter, right: EmailFilter): EmailFilter {
  return {
    id: `and(${left.id},${right.id})`,
    name: `${left.name} AND ${right.name}`,
    rules: [...left.rules, ...right.rules],
    matches: (e) => left.matches(e) && right.matches(e),
    toJSON: () => ({ id: 'and', name: 'and', rules: [...left.rules, ...right.rules] }),
  };
}

export function or(left: EmailFilter, right: EmailFilter): EmailFilter {
  return {
    id: `or(${left.id},${right.id})`,
    name: `${left.name} OR ${right.name}`,
    rules: [...left.rules],
    matches: (e) => left.matches(e) || right.matches(e),
    toJSON: () => ({ id: 'or', name: 'or', rules: [...left.rules] }),
  };
}

export function not(inner: EmailFilter): EmailFilter {
  return {
    id: `not(${inner.id})`,
    name: `NOT ${inner.name}`,
    rules: [...inner.rules],
    matches: (e) => !inner.matches(e),
    toJSON: () => ({ id: 'not', name: 'not', rules: [...inner.rules] }),
  };
}
