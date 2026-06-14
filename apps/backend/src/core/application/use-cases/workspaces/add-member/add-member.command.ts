/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/add-member/add-member.command.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Command for AddMember use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AddMemberDto } from './add-member.dto';

export class AddMemberCommand {
  constructor(public readonly input: AddMemberDto) {}
}
