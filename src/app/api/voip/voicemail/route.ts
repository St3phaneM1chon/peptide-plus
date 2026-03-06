export const dynamic = 'force-dynamic';

/**
 * Voicemail API
 * GET — List voicemails for an extension/user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { getUnreadCount } from '@/lib/voip/voicemail-engine';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const extensionId = searchParams.get('extensionId');
    const unreadOnly = searchParams.get('unread') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where = {
      ...(extensionId ? { extensionId } : {}),
      ...(unreadOnly ? { isRead: false } : {}),
      isArchived: false,
    };

    const [voicemails, total] = await Promise.all([
      prisma.voicemail.findMany({
        where,
        include: {
          extension: {
            select: { extension: true, user: { select: { name: true } } },
          },
          client: {
            select: { id: true, name: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.voicemail.count({ where }),
    ]);

    // Get unread count for the queried extension (if specified)
    const unreadCount = extensionId
      ? await getUnreadCount(extensionId)
      : undefined;

    return NextResponse.json({
      data: voicemails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      ...(unreadCount !== undefined ? { unreadCount } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
