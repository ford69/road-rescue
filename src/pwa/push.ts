/**
 * Web Push frontend scaffold.
 *
 * Backend currently has only a stub FCM adapter and no VAPID / subscription API.
 * These helpers are ready for wiring once the API exposes:
 *   POST /api/notifications/push-subscription
 *   DELETE /api/notifications/push-subscription
 * and sets VITE_VAPID_PUBLIC_KEY on the frontend build.
 */

export type PushPermissionState = NotificationPermission | 'unsupported';

export function getPushPermission(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (getPushPermission() === 'unsupported') return 'unsupported';
  return Notification.requestPermission();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function isWebPushConfigured(): boolean {
  return Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);
}

/**
 * Creates a browser push subscription when VAPID is configured.
 * Returns null when unsupported or not configured — does not fake success.
 */
export async function subscribeToWebPush(): Promise<PushSubscription | null> {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) return null;
  if ((await requestPushPermission()) !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });
}

export async function unsubscribeFromWebPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (!existing) return true;
  return existing.unsubscribe();
}

/**
 * Placeholder for backend registration. No-ops until the API exists.
 * Frontend engineers can call this after subscribeToWebPush().
 */
export async function registerPushSubscriptionWithBackend(
  subscription: PushSubscription,
): Promise<{ ok: false; reason: 'backend_not_ready' }> {
  void subscription;
  return { ok: false, reason: 'backend_not_ready' };
}
