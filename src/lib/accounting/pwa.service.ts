/**
 * PWA (Progressive Web App) Service
 *
 * Handles install prompts, offline detection, sync queue management,
 * and push notification registration for the mobile accounting app.
 */

// =============================================================================
// Types
// =============================================================================

export interface SyncQueueItem {
  id: string;
  url: string;
  method: string;
  body: string;
  timestamp: number;
  retries: number;
}

export interface OfflineStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
}

// =============================================================================
// Install Prompt
// =============================================================================

let deferredPrompt: Event | null = null;

export function initInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prompt = deferredPrompt as any;
  prompt.prompt();
  const result = await prompt.userChoice;
  deferredPrompt = null;
  return result.outcome === 'accepted';
}

export function canInstall(): boolean {
  return deferredPrompt !== null;
}

// =============================================================================
// Offline Detection
// =============================================================================

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => callback(true);
  const onOffline = () => callback(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

// =============================================================================
// Sync Queue (localStorage-based for offline POST requests)
// =============================================================================

const SYNC_QUEUE_KEY = 'pwa_sync_queue';
const LAST_SYNC_KEY = 'pwa_last_sync';

export function getSyncQueue(): SyncQueueItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addToSyncQueue(url: string, method: string, body: string): string {
  const queue = getSyncQueue();
  const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  queue.push({ id, url, method, body, timestamp: Date.now(), retries: 0 });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  return id;
}

export function removeFromSyncQueue(id: string): void {
  const queue = getSyncQueue().filter(item => item.id !== id);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function clearSyncQueue(): void {
  localStorage.setItem(SYNC_QUEUE_KEY, '[]');
}

export async function processSyncQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getSyncQueue();
  let succeeded = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body,
      });
      if (res.ok) {
        removeFromSyncQueue(item.id);
        succeeded++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  if (succeeded > 0) {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }

  return { succeeded, failed };
}

export function getOfflineStatus(): OfflineStatus {
  return {
    isOnline: isOnline(),
    pendingCount: getSyncQueue().length,
    lastSyncAt: typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_SYNC_KEY) : null,
  };
}

// =============================================================================
// Push Notifications
// =============================================================================

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// =============================================================================
// Storage Management
// =============================================================================

export function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return Promise.resolve(null);
  return navigator.storage.estimate().then(est => ({
    usage: est.usage || 0,
    quota: est.quota || 0,
  }));
}

export async function clearCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(names.map(name => caches.delete(name)));
}
