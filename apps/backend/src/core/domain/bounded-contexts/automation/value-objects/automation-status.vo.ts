/**
 * File:        core/domain/bounded-contexts/automation/value-objects/automation-status.vo.ts
 * Module:      Domain - Automation
 * Purpose:     Status of an automation version (draft|published|archived).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export type AutomationStatusKind = 'draft' | 'published' | 'archived';

export class AutomationStatus {
  private constructor(private readonly kind: AutomationStatusKind) {}

  static draft(): AutomationStatus { return new AutomationStatus('draft'); }
  static published(): AutomationStatus { return new AutomationStatus('published'); }
  static archived(): AutomationStatus { return new AutomationStatus('archived'); }

  static from(kind: string): AutomationStatus {
    switch (kind) {
      case 'draft': return AutomationStatus.draft();
      case 'published': return AutomationStatus.published();
      case 'archived': return AutomationStatus.archived();
      default: throw new Error(`Unknown automation status: ${kind}`);
    }
  }

  isDraft(): boolean { return this.kind === 'draft'; }
  isPublished(): boolean { return this.kind === 'published'; }
  isArchived(): boolean { return this.kind === 'archived'; }

  toString(): AutomationStatusKind { return this.kind; }
}
