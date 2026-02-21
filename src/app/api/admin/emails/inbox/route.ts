export const dynamic = 'force-dynamic';

/**
 * Admin Inbox API
 * GET  - List email conversations with filters
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedToId = searchParams.get('assignedToId');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));

    const where: Record<string, unknown> = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (assignedToId) {
      where.assignedToId = assignedToId === 'unassigned' ? null : assignedToId;
    }
    if (priority) {
      where.priority = priority;
    }
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { inboundEmails: { some: { from: { contains: search, mode: 'insensitive' } } } },
        { inboundEmails: { some: { textBody: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    // Hide snoozed conversations unless specifically queried
    if (!searchParams.get('showSnoozed')) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
        { snoozedUntil: null },
        { snoozedUntil: { lt: new Date() } },
      ];
    }

    const [conversations, total, statusCounts] = await Promise.all([
      prisma.emailConversation.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true, loyaltyTier: true, image: true } },
          assignedTo: { select: { id: true, name: true, email: true, image: true } },
          inboundEmails: {
            orderBy: { receivedAt: 'desc' },
            take: 1,
            select: { id: true, from: true, fromName: true, subject: true, textBody: true, receivedAt: true },
          },
          _count: { select: { inboundEmails: true, outboundReplies: true, notes: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailConversation.count({ where }),
      // Get counts per status for sidebar
      prisma.emailConversation.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const counts = statusCounts.reduce(
      (acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      conversations,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      counts: {
        NEW: counts.NEW || 0,
        OPEN: counts.OPEN || 0,
        PENDING: counts.PENDING || 0,
        RESOLVED: counts.RESOLVED || 0,
        CLOSED: counts.CLOSED || 0,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    console.error('[Admin Inbox] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
