/**
 * File:        core/application/ports/gateways/push.gateway.ts
 * Module:      Application - Notifications Bounded Context
 * Purpose:     Port for sending push notifications (web/mobile).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export const PUSH_GATEWAY = Symbol('IPushGateway');

export interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
}

export interface IPushGateway {
  send(payload: PushPayload): Promise<{ delivered: boolean; reason?: string }>;
}
