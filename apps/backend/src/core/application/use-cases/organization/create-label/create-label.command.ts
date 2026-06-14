/**
 * File:        apps/backend/src/core/application/use-cases/organization/create-label/create-label.command.ts
 * Module:      Organization Use Cases
 * Purpose:     Command for CreateLabel use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { CreateLabelDto } from './create-label.dto';

export class CreateLabelCommand {
  constructor(public readonly input: CreateLabelDto) {}
}
