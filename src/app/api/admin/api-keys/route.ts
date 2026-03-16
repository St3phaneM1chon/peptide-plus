export const dynamic = 'force-dynamic';

/**
 * Admin API - API Key Management
 * GET  /api/admin/api-keys - List all API keys with usage stats
 * POST /api/admin/api-keys - Create a new API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { generateApiKey, ALL_PERMISSIONS, type ApiPermission } from '@/lib/api/api-auth.middleware';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  permissions: z.array(z.string()).min(1, 'At least one permission is required').refine(
    (perms) => perms.every((p) => ALL_PERMISSIONS.includes(p as ApiPermission)),
    { message: 'Invalid permission value' }
  ),
  rateLimit: z.number().int().min(1).max(100000).default(1000),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

export const GET = withAdminGuard(async () => {
  const apiKeys = await prisma.apiKey.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      rateLimit: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      createdBy: true,
    },
  });

  // Calculate usage stats in batch queries instead of N+1 per key
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const keyIds = apiKeys.map((k) => k.id);

  // 3 batch groupBy queries instead of 3N individual count queries
  const [todayCounts, weekCounts, monthCounts] = keyIds.length > 0
    ? await Promise.all([
        prisma.apiUsageLog.groupBy({
          by: ['apiKeyId'],
          where: { apiKeyId: { in: keyIds }, createdAt: { gte: todayStart } },
          _count: true,
        }),
        prisma.apiUsageLog.groupBy({
          by: ['apiKeyId'],
          where: { apiKeyId: { in: keyIds }, createdAt: { gte: weekStart } },
          _count: true,
        }),
        prisma.apiUsageLog.groupBy({
          by: ['apiKeyId'],
          where: { apiKeyId: { in: keyIds }, createdAt: { gte: monthStart } },
          _count: true,
        }),
      ])
    : [[], [], []];

  const todayMap = new Map(todayCounts.map((r) => [r.apiKeyId, r._count]));
  const weekMap = new Map(weekCounts.map((r) => [r.apiKeyId, r._count]));
  const monthMap = new Map(monthCounts.map((r) => [r.apiKeyId, r._count]));

  const keysWithStats = apiKeys.map((key) => {
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(key.permissions);
    } catch (err) {
      logger.error('[ApiKeys] Failed to parse permissions JSON for key', { keyId: key.id, error: err });
      permissions = [];
    }

    return {
      ...key,
      permissions,
      usageToday: todayMap.get(key.id) || 0,
      usageWeek: weekMap.get(key.id) || 0,
      usageMonth: monthMap.get(key.id) || 0,
    };
  });

  return NextResponse.json({ success: true, data: keysWithStats });
}, { skipCsrf: true, requiredPermission: 'admin.settings' });

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    logger.error('[ApiKeys] Invalid JSON body in POST request', err);
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation error' },
      { status: 400 }
    );
  }

  const { name, permissions, rateLimit, expiresInDays } = parsed.data;

  // Generate the key
  const keyData = generateApiKey(name, permissions as ApiPermission[], rateLimit);

  // Calculate expiration
  let expiresAt: Date | null = null;
  if (expiresInDays && expiresInDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  // Create in database
  const apiKey = await prisma.apiKey.create({
    data: {
      name: keyData.name,
      keyHash: keyData.keyHash,
      keyPrefix: keyData.keyPrefix,
      permissions: keyData.permissions,
      rateLimit: keyData.rateLimit,
      expiresAt,
      createdBy: session.user.id,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      rateLimit: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  // Return the raw key ONCE - it's not stored anywhere
  return NextResponse.json(
    {
      success: true,
      data: {
        ...apiKey,
        rawKey: keyData.key,
        _note: 'Save this key securely. It will not be shown again.',
      },
    },
    { status: 201 }
  );
}, { requiredPermission: 'admin.settings', requireMfa: true });
