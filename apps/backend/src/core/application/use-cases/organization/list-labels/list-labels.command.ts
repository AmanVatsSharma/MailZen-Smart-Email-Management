/**
 * File:        apps/backend/src/core/application/use-cases/organization/list-labels/list-labels.command.ts
 * Module:      Organization Use Cases
 * Purpose:     Command for ListLabels use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListLabelsDto } from './list-labels.dto';

export class ListLabelsCommand {
  constructor(public readonly input: ListLabelsDto) {}
}
