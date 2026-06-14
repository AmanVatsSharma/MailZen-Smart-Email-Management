/**
 * File:        apps/backend/src/core/application/use-cases/feature/list-flags/list-flags.command.ts
 * Module:      Feature Flag Use Cases
 * Purpose:     Command for ListFlags use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListFlagsDto } from './list-flags.dto';

export class ListFlagsCommand {
  constructor(public readonly input: ListFlagsDto) {}
}
