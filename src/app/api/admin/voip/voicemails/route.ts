export const dynamic = 'force-dynamic';

/**
 * Voicemail API
 * GET - List voicemails with filtering
 * PUT - Mark voicemails as read/archived
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

export const GET = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);

  const extensionId = searchParams.get('extensionId');
  const isRead = searchParams.get('isRead');
  const isArchived = searchParams.get('isArchived');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (extensionId) where.extensionId = extensionId;
  if (isRead !== null && isRead !== undefined) where.isRead = isRead === 'true';
  if (isArchived !== null && isArchived !== undefined) where.isArchived = isArchived === 'true';

  const [voicemails, total] = await prisma.$transaction([
    prisma.voicemail.findMany({
      where,
      include: {
        extension: {
          select: {
            extension: true,
            user: { select: { name: true, email: true } },
          },
        },
        client: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.voicemail.count({ where }),
  ]);

  return NextResponse.json({
    voicemails,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}, { skipCsrf: true });

export const PUT = withAdminGuard(async (request) => {
  const body = await request.json();
  const { ids, action } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  switch (action) {
    case 'markRead':
      await prisma.voicemail.updateMany({
        where: { id: { in: ids } },
        data: { isRead: true },
      });
      break;
    case 'markUnread':
      await prisma.voicemail.updateMany({
        where: { id: { in: ids } },
        data: { isRead: false },
      });
      break;
    case 'archive':
      await prisma.voicemail.updateMany({
        where: { id: { in: ids } },
        data: { isArchived: true },
      });
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ updated: ids.length });
});
