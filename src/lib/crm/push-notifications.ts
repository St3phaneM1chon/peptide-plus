/**
 * CRM PUSH NOTIFICATIONS
 * Send push notifications to CRM users via Web Push API.
 * Subscriptions stored in-memory (backed by /tmp for persistence across restarts).
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { readFileSync, writeFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebPushLib = any;

// ---------------------------------------------------------------------------
// In-memory subscription store (persisted to /tmp)
// ---------------------------------------------------------------------------

const STORE_PATH = '/tmp/crm-push-subscriptions.json';
const subscriptionStore = new Map<string, PushSubscriptionData[]>();
let storeLoaded = false;

function loadStore(): void {
  if (storeLoaded) return;
  storeLoaded = true;
  try {
    const data = readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(data) as Record<string, PushSubscriptionData[]>;
    for (const [k, v] of Object.entries(parsed)) {
      subscriptionStore.set(k, v);
    }
  } catch {
    // No existing store file
  }
}

function saveStore(): void {
  try {
    const obj: Record<string, PushSubscriptionData[]> = {};
    for (const [k, v] of subscriptionStore.entries()) {
      obj[k] = v;
    }
    writeFileSync(STORE_PATH, JSON.stringify(obj), 'utf-8');
  } catch {
    logger.warn('[push-notifications] Failed to persist subscription store');
  }
}

// ---------------------------------------------------------------------------
// Lazy web-push loader
// ---------------------------------------------------------------------------

let webPushModule: WebPushLib | null = null;
let webPushLoadAttempted = false;

async function getWebPush(): Promise<WebPushLib | null> {
  if (webPushLoadAttempted) return webPushModule;
  webPushLoadAttempted = true;

  try {
    const wp = await import('web-push' as string);
    webPushModule = wp.default || wp;

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@attitudes.vip';

    if (vapidPublicKey && vapidPrivateKey && webPushModule) {
      webPushModule.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      logger.info('Web Push configured with VAPID details');
    } else {
      logger.warn('VAPID keys not configured. Push notifications will be logged only.');
      webPushModule = null;
    }
  } catch {
    logger.warn('web-push package not available. Push notifications will be logged only.');
    webPushModule = null;
  }

  return webPushModule;
}

// ---------------------------------------------------------------------------
// Send push notification to a user
// ---------------------------------------------------------------------------

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  loadStore();
  const wp = await getWebPush();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });

  if (!user) {
    logger.warn('Cannot send push notification: user not found', { userId });
    return;
  }

  const subscriptions = subscriptionStore.get(userId) || [];

  if (subscriptions.length === 0) {
    logger.info('No push subscriptions for user, skipping notification', { userId, title });
    return;
  }

  const payload = JSON.stringify({ title, body, url: url || '/admin/crm' });

  if (!wp) {
    logger.info('Push notification (logged, web-push unavailable)', {
      userId, title, body, url, subscriptionCount: subscriptions.length,
    });
    return;
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) => wp.sendNotification(sub, payload))
  );

  const validSubscriptions: PushSubscriptionData[] = [];
  let removedCount = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      validSubscriptions.push(subscriptions[index]);
    } else {
      const error = result.reason as { statusCode?: number; status?: number; message?: string };
      const statusCode = error?.statusCode || error?.status;
      if (statusCode === 410 || statusCode === 404) {
        removedCount++;
      } else {
        validSubscriptions.push(subscriptions[index]);
        logger.warn('Push notification delivery failed', {
          userId, error: error?.message || String(error),
        });
      }
    }
  });

  if (removedCount > 0) {
    subscriptionStore.set(userId, validSubscriptions);
    saveStore();
  }

  logger.info('Push notification sent', {
    userId, title,
    delivered: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    removedExpired: removedCount,
  });
}

// ---------------------------------------------------------------------------
// Subscribe to push notifications
// ---------------------------------------------------------------------------

export async function subscribeToPush(
  userId: string,
  subscription: PushSubscriptionData
): Promise<void> {
  loadStore();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    logger.warn('Cannot subscribe to push: user not found', { userId });
    return;
  }

  const existing = subscriptionStore.get(userId) || [];
  const filtered = existing.filter((s) => s.endpoint !== subscription.endpoint);
  filtered.push(subscription);
  const capped = filtered.slice(-5);

  subscriptionStore.set(userId, capped);
  saveStore();

  logger.info('Push subscription stored', {
    userId, endpoint: subscription.endpoint.slice(0, 60), totalSubscriptions: capped.length,
  });
}

// ---------------------------------------------------------------------------
// Notify: Deal Won
// ---------------------------------------------------------------------------

/**
 * Send a push notification to the deal owner when a deal is won.
 */
export async function notifyDealWon(dealId: string): Promise<void> {
  const deal = await prisma.crmDeal.findUnique({
    where: { id: dealId },
    select: {
      title: true,
      value: true,
      currency: true,
      assignedToId: true,
      assignedTo: { select: { name: true } },
    },
  });

  if (!deal) {
    logger.warn('Cannot notify deal won: deal not found', { dealId });
    return;
  }

  const value = Number(deal.value);
  const formattedValue = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: deal.currency,
  }).format(value);

  await sendPushNotification(
    deal.assignedToId,
    'Deal Won!',
    `${deal.title} closed for ${formattedValue}`,
    `/admin/crm/deals/${dealId}`
  );
}

// ---------------------------------------------------------------------------
// Notify: New Lead Assigned
// ---------------------------------------------------------------------------

/**
 * Send a push notification to the assigned agent when a new lead is created.
 */
export async function notifyNewLead(leadId: string): Promise<void> {
  const lead = await prisma.crmLead.findUnique({
    where: { id: leadId },
    select: {
      contactName: true,
      companyName: true,
      source: true,
      assignedToId: true,
      assignedTo: { select: { name: true } },
    },
  });

  if (!lead) {
    logger.warn('Cannot notify new lead: lead not found', { leadId });
    return;
  }

  if (!lead.assignedToId) {
    logger.info('New lead has no assigned agent, skipping push notification', { leadId });
    return;
  }

  const company = lead.companyName ? ` (${lead.companyName})` : '';

  await sendPushNotification(
    lead.assignedToId,
    'New Lead Assigned',
    `${lead.contactName}${company} via ${lead.source}`,
    `/admin/crm/leads/${leadId}`
  );
}
