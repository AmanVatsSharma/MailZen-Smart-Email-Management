/**
 * File:        core/domain/bounded-contexts/automation/value-objects/automation-trigger.vo.ts
 * Module:      Domain - Automation
 * Purpose:     Event that starts an automation. e.g. { type: 'email.received', filter: {...} }
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export class AutomationTrigger {
  private constructor(
    public readonly type: string,
    public readonly filter: Record<string, unknown>,
  ) {}

  static create(type: string, filter: Record<string, unknown> = {}): AutomationTrigger {
    if (!type?.trim()) throw new Error('Trigger type is required');
    return new AutomationTrigger(type.trim(), filter);
  }

  matches(event: { type: string; payload: unknown }): boolean {
    return this.type === event.type;
  }
}
