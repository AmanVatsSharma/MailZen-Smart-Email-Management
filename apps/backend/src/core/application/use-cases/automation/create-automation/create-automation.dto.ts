/**
 * File:        apps/backend/src/core/application/use-cases/automation/create-automation/create-automation.dto.ts
 * Module:      Automation Use Cases
 * Purpose:     Data transfer object for CreateAutomation use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { AutomationTrigger } from '../../../../../domain/bounded-contexts/automation/value-objects/automation-trigger.vo';
import { AutomationCondition } from '../../../../../domain/bounded-contexts/automation/value-objects/automation-condition.vo';
import { AutomationStep } from '../../../../../domain/bounded-contexts/automation/value-objects/automation-step.vo';

export interface CreateAutomationDto {
  workflowId: string;
  workspaceId: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  steps: AutomationStep[];
}
