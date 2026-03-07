export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// I-CRM-12: Customer ban/suspend API

// POST: Ban a customer
export const POST = withAdminGuard(async (
  request: NextRequest,
  { params, session }: { params: Promise<{ id: string }>; session: { user: { id: string } } }
) => {
  const { id } = await params;
  const { reason } = await request.json();

  const user = await prisma.user.update({
    where: { id },
    data: {
      isBanned: true,
      bannedAt: new Date(),
      bannedReason: reason || 'No reason provided',
    },
    select: { id: true, email: true, isBanned: true },
  });

  logger.info('Customer banned', { targetId: id, bannedBy: session.user.id, reason });
  return NextResponse.json(user);
}, { requiredPermission: 'users.manage_permissions' });

// DELETE: Unban a customer
export const DELETE = withAdminGuard(async (
  _request: NextRequest,
  { params, session }: { params: Promise<{ id: string }>; session: { user: { id: string } } }
) => {
  const { id } = await params;

  const user = await prisma.user.update({
    where: { id },
    data: {
      isBanned: false,
      bannedAt: null,
      bannedReason: null,
    },
    select: { id: true, email: true, isBanned: true },
  });

  logger.info('Customer unbanned', { targetId: id, unbannedBy: session.user.id });
  return NextResponse.json(user);
}, { requiredPermission: 'users.manage_permissions' });
