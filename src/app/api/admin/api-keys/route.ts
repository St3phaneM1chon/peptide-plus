/**
 * Admin API - API Key Management
 * GET  /api/admin/api-keys - List all API keys with usage stats
 * POST /api/admin/api-keys - Create a new API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { generateApiKey, type ApiPermission } from '@/lib/api/api-auth.middleware';

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

  // Calculate usage stats for each key
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const keysWithStats = await Promise.all(
    apiKeys.map(async (key) => {
      const [usageToday, usageWeek, usageMonth] = await Promise.all([
        prisma.apiUsageLog.count({
          where: { apiKeyId: key.id, createdAt: { gte: todayStart } },
        }),
        prisma.apiUsageLog.count({
          where: { apiKeyId: key.id, createdAt: { gte: weekStart } },
        }),
        prisma.apiUsageLog.count({
          where: { apiKeyId: key.id, createdAt: { gte: monthStart } },
        }),
      ]);

      let permissions: string[] = [];
      try {
        permissions = JSON.parse(key.permissions);
      } catch {
        permissions = [];
      }

      return {
        ...key,
        permissions,
        usageToday,
        usageWeek,
        usageMonth,
      };
    })
  );

  return NextResponse.json({ success: true, data: keysWithStats });
}, { skipCsrf: true });

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = body.name as string;
  const permissions = body.permissions as ApiPermission[];
  const rateLimit = typeof body.rateLimit === 'number' ? body.rateLimit : 1000;
  const expiresInDays = typeof body.expiresInDays === 'number' ? body.expiresInDays : null;

  if (!name || !name.trim()) {
    return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one permission is required' }, { status: 400 });
  }

  // Generate the key
  const keyData = generateApiKey(name.trim(), permissions, rateLimit);

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
});
