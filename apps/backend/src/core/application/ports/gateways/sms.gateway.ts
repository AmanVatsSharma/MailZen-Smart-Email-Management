/**
 * File:        core/application/ports/gateways/sms.gateway.ts
 * Module:      Application - Phone Bounded Context
 * Purpose:     Port for sending SMS messages. Adapters: ConsoleSmsGateway (dev),
 *              TwilioSmsGateway, WebhookSmsGateway.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export const SMS_GATEWAY = Symbol('ISmsGateway');

export interface SmsMessage {
  to: string;          // E.164 format e.g. +14155550100
  body: string;        // <= 1600 chars (concat-safe)
  metadata?: Record<string, string>;
}

export interface ISmsGateway {
  send(message: SmsMessage): Promise<{ messageId: string }>;
}
