export const dynamic = 'force-dynamic';

/**
 * Admin Inbox API
 * GET   - List email conversations with filters
 * PATCH - Bulk update conversation statuses
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedToId = searchParams.get('assignedToId');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy'); // 'priority' | 'lastMessage' | 'created'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));

    // Build where conditions using AND to combine search + snooze filters properly
    const andConditions: Record<string, unknown>[] = [];

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
      andConditions.push({
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { inboundEmails: { some: { from: { contains: search, mode: 'insensitive' } } } },
          { inboundEmails: { some: { textBody: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }
    // Hide snoozed conversations unless specifically queried
    if (!searchParams.get('showSnoozed')) {
      andConditions.push({
        OR: [
          { snoozedUntil: null },
          { snoozedUntil: { lt: new Date() } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Determine sort order based on sortBy parameter
    const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    const isPrioritySort = sortBy === 'priority';
    const orderBy = sortBy === 'created'
      ? { createdAt: 'desc' as const }
      : { lastMessageAt: 'desc' as const };

    const selectFields = {
      id: true,
      subject: true,
      status: true,
      priority: true,
      lastMessageAt: true,
      snoozedUntil: true,
      createdAt: true,
      customer: { select: { id: true, name: true, email: true, loyaltyTier: true, image: true } },
      assignedTo: { select: { id: true, name: true, email: true, image: true } },
      inboundEmails: {
        orderBy: { receivedAt: 'desc' as const },
        take: 1,
        select: { id: true, from: true, fromName: true, subject: true, textBody: true, receivedAt: true },
      },
      _count: { select: { inboundEmails: true, outboundReplies: true, notes: true } },
    };

    const [rawConversations, total, statusCounts] = await Promise.all([
      prisma.emailConversation.findMany({
        where,
        select: selectFields,
        orderBy,
        // For priority sort, fetch all matching to sort in memory, then paginate
        ...(isPrioritySort ? {} : { skip: (page - 1) * limit, take: limit }),
      }),
      prisma.emailConversation.count({ where }),
      // Get counts per status for sidebar
      prisma.emailConversation.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    // Apply priority-based sorting in memory when requested
    let conversations = rawConversations;
    if (isPrioritySort) {
      conversations = [...rawConversations].sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 99;
        const pb = PRIORITY_ORDER[b.priority] ?? 99;
        if (pa !== pb) return pa - pb;
        // Secondary sort: most recent message first
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });
      // Apply pagination after sorting
      conversations = conversations.slice((page - 1) * limit, page * limit);
    }

    // Add search highlighting snippets when a search term is provided
    let conversationsWithHighlights = conversations as Array<Record<string, unknown>>;
    if (search) {
      const searchLower = search.toLowerCase();
      conversationsWithHighlights = conversations.map(conv => {
        let searchHighlight: string | null = null;
        // Check subject first
        const subject = (conv.subject || '') as string;
        const subjectIdx = subject.toLowerCase().indexOf(searchLower);
        if (subjectIdx !== -1) {
          const start = Math.max(0, subjectIdx - 100);
          const end = Math.min(subject.length, subjectIdx + search.length + 100);
          searchHighlight = (start > 0 ? '...' : '') + subject.slice(start, end) + (end < subject.length ? '...' : '');
        }
        // Check from field in latest inbound email
        if (!searchHighlight && conv.inboundEmails && (conv.inboundEmails as Array<Record<string, unknown>>).length > 0) {
          const latestEmail = (conv.inboundEmails as Array<Record<string, unknown>>)[0];
          const from = ((latestEmail.from || '') as string);
          const fromIdx = from.toLowerCase().indexOf(searchLower);
          if (fromIdx !== -1) {
            const start = Math.max(0, fromIdx - 100);
            const end = Math.min(from.length, fromIdx + search.length + 100);
            searchHighlight = (start > 0 ? '...' : '') + from.slice(start, end) + (end < from.length ? '...' : '');
          }
          // Check textBody
          if (!searchHighlight) {
            const body = ((latestEmail.textBody || '') as string);
            const bodyIdx = body.toLowerCase().indexOf(searchLower);
            if (bodyIdx !== -1) {
              const start = Math.max(0, bodyIdx - 100);
              const end = Math.min(body.length, bodyIdx + search.length + 100);
              searchHighlight = (start > 0 ? '...' : '') + body.slice(start, end) + (end < body.length ? '...' : '');
            }
          }
        }
        return { ...conv, searchHighlight };
      });
    }

    const counts = statusCounts.reduce(
      (acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      conversations: search ? conversationsWithHighlights : conversations,
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
    logger.error('[Admin Inbox] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * PATCH - Bulk update conversation statuses
 * Body: { ids: string[], action: 'close' | 'resolve' | 'reopen' | 'assign', assigneeId?: string }
 * Max 50 conversations per request
 */
const BULK_ACTIONS: Record<string, string> = {
  close: 'CLOSED',
  resolve: 'RESOLVED',
  reopen: 'OPEN',
  assign: '', // special: only assigns, does not change status
};

export const PATCH = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { ids, action, assigneeId } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }
    if (ids.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 conversations per request' }, { status: 400 });
    }
    if (!action || !BULK_ACTIONS.hasOwnProperty(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${Object.keys(BULK_ACTIONS).join(', ')}` },
        { status: 400 },
      );
    }
    if (action === 'assign' && !assigneeId) {
      return NextResponse.json({ error: 'assigneeId is required for assign action' }, { status: 400 });
    }

    // Validate all IDs are strings
    const validIds = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (validIds.length !== ids.length) {
      return NextResponse.json({ error: 'All ids must be non-empty strings' }, { status: 400 });
    }

    // Build the update data
    const updateData: Record<string, unknown> = {};
    if (action === 'assign') {
      updateData.assignedToId = assigneeId;
    } else {
      updateData.status = BULK_ACTIONS[action];
    }

    // Execute the bulk update and create activity logs in a transaction
    const activityAction = action === 'assign' ? 'bulk_assigned' : `bulk_${action}`;
    const activityDetails = action === 'assign'
      ? JSON.stringify({ assigneeId, count: validIds.length })
      : JSON.stringify({ newStatus: BULK_ACTIONS[action], count: validIds.length });

    const result = await prisma.$transaction([
      prisma.emailConversation.updateMany({
        where: { id: { in: validIds } },
        data: updateData,
      }),
      // Create activity log for each conversation
      ...validIds.map((id) =>
        prisma.conversationActivity.create({
          data: {
            conversationId: id,
            actorId: session.user.id,
            action: activityAction,
            details: activityDetails,
          },
        })
      ),
    ]);

    const updatedCount = (result[0] as { count: number }).count;

    logAdminAction({
      adminUserId: session.user.id,
      action: 'BULK_UPDATE_CONVERSATIONS',
      targetType: 'EmailConversation',
      targetId: validIds.join(','),
      newValue: { action, ids: validIds, assigneeId: assigneeId || null },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      updated: updatedCount,
      action,
      ids: validIds,
    });
  } catch (error) {
    logger.error('[Admin Inbox] Bulk update error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
