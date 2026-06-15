/**
 * File:        core/domain/bounded-contexts/automation/value-objects/automation-step.vo.ts
 * Module:      Domain - Automation
 * Purpose:     A single action in an automation (e.g. send email, add label, notify).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export type StepKind = 'send_email' | 'add_label' | 'remove_label' | 'mark_read' | 'archive' | 'notify' | 'webhook';

export class AutomationStep {
  private constructor(
    public readonly order: number,
    public readonly kind: StepKind,
    public readonly config: Record<string, unknown>,
  ) {}

  static create(order: number, kind: StepKind, config: Record<string, unknown> = {}): AutomationStep {
    if (order < 0) throw new Error('Step order must be non-negative');
    return new AutomationStep(order, kind, config);
  }
}
