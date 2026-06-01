/**
 * File:        apps/frontend/lib/push-notifications.ts
 * Module:      Push Notifications · Browser API Helper
 * Purpose:     Wraps ServiceWorker registration and PushManager subscribe/unsubscribe
 *              into simple async functions consumed by the notification settings page.
 *
 * Exports:
 *   - isPushSupported() → boolean              — guard for SSR and unsupported browsers
 *   - requestPushPermission() → PermissionState — requests Notification permission
 *   - subscribeToPush() → PushSubscriptionFields — registers SW + subscribes, returns keys
 *   - unsubscribeFromPush() → void             — unsubscribes the current push subscription
 *   - getCurrentPushEndpoint() → string | null — returns current endpoint if subscribed
 *
 * Depends on:
 *   - none (browser globals only)
 *
 * Side-effects:
 *   - Registers /sw.js ServiceWorker on first call to subscribeToPush()
 *   - Calls Notification.requestPermission() if not yet granted
 *
 * Key invariants:
 *   - All exports guard against SSR (typeof window === 'undefined')
 *   - The VAPID public key environment variable is optional; if absent, subscribe still works
 *     without server push but the backend mutation will store the endpoint for future use
 *   - p256dh and auth are base64url-encoded (ArrayBuffer → Uint8Array → btoa with URL-safe swap)
 *
 * Read order:
 *   1. isPushSupported      — capability check
 *   2. requestPushPermission — permission prompt
 *   3. subscribeToPush       — main subscribe flow (registers SW, creates subscription)
 *   4. unsubscribeFromPush   — teardown
 *   5. getCurrentPushEndpoint — read-only accessor
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

export type PushSubscriptionFields = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
};

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  return Notification.requestPermission();
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function subscribeToPush(): Promise<PushSubscriptionFields> {
  if (!isPushSupported()) throw new Error('Push notifications not supported in this browser.');

  const permission = await requestPushPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied.');

  const registration = await getRegistration();

  // Unsubscribe any stale subscription before creating a fresh one
  const existing = await registration.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const subscribeOptions: PushSubscriptionOptionsInit = { userVisibleOnly: true };
  if (vapidKey) {
    subscribeOptions.applicationServerKey = vapidKey;
  }

  const subscription = await registration.pushManager.subscribe(subscribeOptions);
  const json = subscription.toJSON();

  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) throw new Error('Push subscription keys missing.');

  return {
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    userAgent: navigator.userAgent,
  };
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}

export async function getCurrentPushEndpoint(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return null;
  const subscription = await registration.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}
