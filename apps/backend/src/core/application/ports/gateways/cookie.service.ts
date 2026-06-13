/**
 * File:        core/application/ports/gateways/cookie.service.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Cookie service port for HTTP session cookie management
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export const COOKIE_SERVICE = Symbol('ICookieService');

export interface CookieService {
  setAuthCookie(res: any, token: string): void;
  clearAuthCookie(res: any): void;
}