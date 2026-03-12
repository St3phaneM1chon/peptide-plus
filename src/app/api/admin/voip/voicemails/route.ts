export const dynamic = 'force-dynamic';

/**
 * Voicemail API
 * GET - List voicemails with filtering
 * PUT - Mark voicemails as read/archived
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { markVoicemailRead, archiveVoicemail } from '@/lib/voip/voicemail-engine';

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

const voicemailActionSchema = z.object({
  ids: z.array(z.string().max(200)).min(1).max(100),
  action: z.enum(['markRead', 'markUnread', 'archive']),
});

export const PUT = withAdminGuard(async (request) => {
  const body = await request.json();
  const parsed = voicemailActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { ids, action } = parsed.data;

  switch (action) {
    case 'markRead':
      // Use voicemail-engine for individual IDs to ensure consistent behavior
      await Promise.all(ids.map((vmId: string) => markVoicemailRead(vmId)));
      break;
    case 'markUnread':
      await prisma.voicemail.updateMany({
        where: { id: { in: ids } },
        data: { isRead: false },
      });
      break;
    case 'archive':
      await Promise.all(ids.map((vmId: string) => archiveVoicemail(vmId)));
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ updated: ids.length });
});
