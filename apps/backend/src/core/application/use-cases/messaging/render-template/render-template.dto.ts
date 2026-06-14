/**
 * File:        apps/backend/src/core/application/use-cases/messaging/render-template/render-template.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the RenderTemplate use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface RenderTemplateInput {
  templateId: string;
  variables: Readonly<Record<string, unknown>>;
}

export interface RenderTemplateOutput {
  subject: string;
  body: string;
}
