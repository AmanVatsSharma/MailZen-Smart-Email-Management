/**
 * File:        core/domain/bounded-contexts/automation/value-objects/automation-condition.vo.ts
 * Module:      Domain - Automation
 * Purpose:     Boolean expression that gates an automation step.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'exists' | 'in';

export class AutomationCondition {
  private constructor(
    public readonly field: string,
    public readonly op: ConditionOp,
    public readonly value: unknown,
  ) {}

  static create(field: string, op: ConditionOp, value: unknown): AutomationCondition {
    if (!field?.trim()) throw new Error('Condition field is required');
    return new AutomationCondition(field.trim(), op, value);
  }

  evaluate(context: Record<string, unknown>): boolean {
    const actual = context[this.field];
    switch (this.op) {
      case 'eq': return actual === this.value;
      case 'neq': return actual !== this.value;
      case 'gt': return Number(actual) > Number(this.value);
      case 'lt': return Number(actual) < Number(this.value);
      case 'contains': return String(actual ?? '').includes(String(this.value));
      case 'exists': return actual != null;
      case 'in': return Array.isArray(this.value) && this.value.includes(actual);
      default: return false;
    }
  }
}
