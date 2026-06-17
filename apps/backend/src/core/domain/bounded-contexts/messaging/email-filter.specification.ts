/**
 * File:        apps/backend/src/core/domain/bounded-contexts/messaging/email-filter.specification.ts
 * Module:      Core · Domain · Messaging
 * Purpose:     Specification pattern for matching an Email against a set of
 *              field/value/condition rules. Replaces the imperative filter logic
 *              in the legacy EmailFilterService with composable predicates.
 *
 *              EmailFilter is implemented as an aggregate-style class so that
 *              repositories can call `EmailFilter.reconstitute(...)` to rebuild
 *              it from persistence and `toDomain()` can call
 *              `EmailFilter.compose(...)` to build it from raw spec data.
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

export interface EmailFilterProps {
  id: string;
  workspaceId: string;
  name: string;
  rules: ReadonlyArray<EmailFilterRule>;
  conditions?: ReadonlyArray<EmailFilterRule>;
  actions?: ReadonlyArray<EmailFilterRule>;
  priority?: number;
  enabled?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EmailFilter {
  public readonly props: EmailFilterProps;
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly rules: ReadonlyArray<EmailFilterRule>;
  public readonly conditions: ReadonlyArray<EmailFilterRule>;
  public readonly actions: ReadonlyArray<EmailFilterRule>;
  public readonly priority: number;
  public readonly enabled: boolean;
  public readonly isActive: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: EmailFilterProps) {
    this.props = props;
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.rules = props.rules;
    this.conditions = props.conditions ?? props.rules;
    this.actions = props.actions ?? props.rules;
    this.priority = props.priority ?? 0;
    this.enabled = props.enabled ?? true;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Build a filter from raw persisted data without running validation.
   * Used by TypeORM repositories when rehydrating from the database.
   */
  static reconstitute(props: EmailFilterProps): EmailFilter {
    return new EmailFilter(props);
  }

  /**
   * Build a filter from a use-case input (id, name, rules). Legacy
   * composition API preserved for `buildEmailFilter` callers.
   */
  static compose(input: {
    id: string;
    name: string;
    rules: ReadonlyArray<EmailFilterRule>;
  }): EmailFilter {
    return new EmailFilter({
      id: input.id,
      workspaceId: '',
      name: input.name,
      rules: input.rules,
    });
  }

  matches(email: Email): boolean {
    return this.rules.every((rule) => evaluateRule(email, rule));
  }

  toJSON(): { id: string; name: string; rules: EmailFilterRule[] } {
    return { id: this.id, name: this.name, rules: [...this.rules] };
  }
}

/**
 * Backwards-compatible builder. New code should use
 * `EmailFilter.compose({ id, name, rules })` or
 * `EmailFilter.reconstitute(props)`.
 */
export function buildEmailFilter(input: {
  id: string;
  name: string;
  rules: ReadonlyArray<EmailFilterRule>;
}): EmailFilter {
  return EmailFilter.compose(input);
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
  return EmailFilter.compose({
    id: `and(${left.id},${right.id})`,
    name: `${left.name} AND ${right.name}`,
    rules: [...left.rules, ...right.rules],
  });
}

export function or(left: EmailFilter, right: EmailFilter): EmailFilter {
  return EmailFilter.compose({
    id: `or(${left.id},${right.id})`,
    name: `${left.name} OR ${right.name}`,
    rules: [...left.rules],
  });
}

export function not(inner: EmailFilter): EmailFilter {
  return EmailFilter.compose({
    id: `not(${inner.id})`,
    name: `NOT ${inner.name}`,
    rules: [...inner.rules],
  });
}
