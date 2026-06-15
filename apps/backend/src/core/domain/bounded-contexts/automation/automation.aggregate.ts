/**
 * File:        core/domain/bounded-contexts/automation/automation.aggregate.ts
 * Module:      Domain - Automation Bounded Context
 * Purpose:     Automation aggregate root. Each save() creates a new immutable
 *              version row; published versions are never mutated.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result } from '../../shared/result';
import { WorkspaceId } from '../../shared/value-objects/ids';
import { AutomationStatus } from './value-objects/automation-status.vo';
import { AutomationTrigger } from './value-objects/automation-trigger.vo';
import { AutomationCondition } from './value-objects/automation-condition.vo';
import { AutomationStep } from './value-objects/automation-step.vo';

export interface AutomationProps {
  versionId: string;
  workflowId: string;
  workspaceId: string;
  version: number;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  steps: AutomationStep[];
  status: AutomationStatus;
  publishedAt: Date | null;
  createdAt: Date;
}

export class Automation extends AggregateRoot<AutomationProps> {
  get versionId(): string { return this.props.versionId; }
  get workflowId(): string { return this.props.workflowId; }
  get workspaceId(): string { return this.props.workspaceId; }
  get version(): number { return this.props.version; }
  get name(): string { return this.props.name; }
  get trigger(): AutomationTrigger { return this.props.trigger; }
  get conditions(): readonly AutomationCondition[] { return this.props.conditions; }
  get steps(): readonly AutomationStep[] { return this.props.steps; }
  get status(): AutomationStatus { return this.props.status; }
  get publishedAt(): Date | null { return this.props.publishedAt; }

  private constructor(props: AutomationProps) {
    super(props);
  }

  static create(input: {
    workflowId: string;
    workspaceId: string;
    name: string;
    trigger: AutomationTrigger;
    conditions: AutomationCondition[];
    steps: AutomationStep[];
  }): Result<Automation, Error> {
    if (!input.name?.trim()) {
      return Result.err(new Error('Automation name is required'));
    }
    if (input.steps.length === 0) {
      return Result.err(new Error('Automation must have at least one step'));
    }

    const props: AutomationProps = {
      versionId: crypto.randomUUID(),
      workflowId: input.workflowId,
      workspaceId: input.workspaceId,
      version: 1,
      name: input.name.trim(),
      trigger: input.trigger,
      conditions: input.conditions,
      steps: input.steps,
      status: AutomationStatus.draft(),
      publishedAt: null,
      createdAt: new Date(),
    };
    return Result.ok(new Automation(props));
  }

  static reconstitute(props: AutomationProps): Automation {
    return new Automation(props);
  }

  publish(): Result<Automation, Error> {
    if (this.props.status.isPublished()) {
      return Result.err(new Error('Automation is already published'));
    }
    return Result.ok(
      new Automation({
        ...this.props,
        status: AutomationStatus.published(),
        publishedAt: new Date(),
      }),
    );
  }

  archive(): Automation {
    return new Automation({
      ...this.props,
      status: AutomationStatus.archived(),
    });
  }
}
