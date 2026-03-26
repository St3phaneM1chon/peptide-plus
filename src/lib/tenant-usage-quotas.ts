/**
 * #60 Tenant Usage Quotas - Track storage + API calls per tenant
 */

import { prisma } from '@/lib/db';
import { getRedisClient, isRedisAvailable } from '@/lib/redis';
import { logger } from '@/lib/logger';

export interface TenantQuota {
  tenantId: string;
  plan: string;
  limits: QuotaLimits;
  usage: QuotaUsage;
  percentages: Record<string, number>;
  alerts: QuotaAlert[];
}

export interface QuotaLimits {
  storageGB: number;
  apiCallsPerDay: number;
  productsMax: number;
  usersMax: number;
  emailsPerMonth: number;
}

export interface QuotaUsage {
  storageGB: number;
  apiCallsToday: number;
  products: number;
  users: number;
  emailsThisMonth: number;
}

export interface QuotaAlert {
  resource: string;
  level: 'warning' | 'critical' | 'exceeded';
  message: string;
  usagePercent: number;
}

export const PLAN_LIMITS: Record<string, QuotaLimits> = {
  free: { storageGB: 1, apiCallsPerDay: 1000, productsMax: 50, usersMax: 5, emailsPerMonth: 500 },
  starter: { storageGB: 10, apiCallsPerDay: 10000, productsMax: 500, usersMax: 25, emailsPerMonth: 5000 },
  professional: { storageGB: 50, apiCallsPerDay: 50000, productsMax: 5000, usersMax: 100, emailsPerMonth: 25000 },
  enterprise: { storageGB: 500, apiCallsPerDay: 500000, productsMax: 50000, usersMax: 1000, emailsPerMonth: 100000 },
};

export async function getTenantUsage(tenantId: string): Promise<QuotaUsage> {
  try {
    const [products, users] = await Promise.all([
      prisma.product.count({ where: { tenantId } }).catch(() => 0),
      prisma.user.count({ where: { tenantId } }).catch(() => 0),
    ]);
    let apiCallsToday = 0;
    if (isRedisAvailable()) {
      try {
        const redis = await getRedisClient();
        const today = new Date().toISOString().slice(0, 10);
        const count = await redis?.get(`quota:api:${tenantId}:${today}`);
        apiCallsToday = parseInt(count || '0', 10);
      } catch { /* Redis unavailable */ }
    }
    return { storageGB: 0, apiCallsToday, products, users, emailsThisMonth: 0 };
  } catch (error) {
    logger.error('[tenant-quotas] Usage fetch error:', error);
    return { storageGB: 0, apiCallsToday: 0, products: 0, users: 0, emailsThisMonth: 0 };
  }
}

export async function getTenantQuota(tenantId: string, plan: string = 'starter'): Promise<TenantQuota> {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
  const usage = await getTenantUsage(tenantId);
  const pct = (used: number, max: number) => max > 0 ? Math.round((used / max) * 10000) / 100 : 0;
  const percentages: Record<string, number> = {
    storage: pct(usage.storageGB, limits.storageGB),
    apiCalls: pct(usage.apiCallsToday, limits.apiCallsPerDay),
    products: pct(usage.products, limits.productsMax),
    users: pct(usage.users, limits.usersMax),
    emails: pct(usage.emailsThisMonth, limits.emailsPerMonth),
  };
  const alerts: QuotaAlert[] = [];
  for (const [resource, p] of Object.entries(percentages)) {
    if (p >= 100) alerts.push({ resource, level: 'exceeded', message: `${resource} quota exceeded (${p.toFixed(0)}%)`, usagePercent: p });
    else if (p >= 90) alerts.push({ resource, level: 'critical', message: `${resource} at ${p.toFixed(0)}%`, usagePercent: p });
    else if (p >= 75) alerts.push({ resource, level: 'warning', message: `${resource} at ${p.toFixed(0)}%`, usagePercent: p });
  }
  return { tenantId, plan, limits, usage, percentages, alerts };
}

export async function incrementApiCallCount(tenantId: string): Promise<boolean> {
  if (!isRedisAvailable()) return true;
  try {
    const redis = await getRedisClient();
    if (!redis) return true;
    const today = new Date().toISOString().slice(0, 10);
    const key = `quota:api:${tenantId}:${today}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 86400);
    const limit = PLAN_LIMITS.professional.apiCallsPerDay;
    return count <= limit;
  } catch {
    return true;
  }
}
