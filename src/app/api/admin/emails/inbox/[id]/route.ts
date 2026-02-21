export const dynamic = 'force-dynamic';

/**
 * Admin Inbox Conversation Detail API
 * GET  - Get conversation with full thread
 * PUT  - Update conversation (status, assignation, tags, priority, snooze)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

export const GET = withAdminGuard(
  async (request: NextRequest, { session: _session, params }: { session: unknown; params: { id: string } }) => {
    try {
      const { id } = params;

      const conversation = await prisma.emailConversation.findUnique({
        where: { id },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              loyaltyTier: true,
              loyaltyPoints: true,
              locale: true,
              phone: true,
              createdAt: true,
              orders: {
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
              },
            },
          },
          assignedTo: { select: { id: true, name: true, email: true, image: true } },
          inboundEmails: {
            orderBy: { receivedAt: 'asc' },
            include: { attachments: true },
          },
          outboundReplies: {
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { id: true, name: true, email: true, image: true } } },
          },
          notes: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, name: true, email: true, image: true } } },
          },
          activities: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      // Build unified timeline
      type TimelineItem = {
        type: 'inbound' | 'outbound' | 'note' | 'activity';
        id: string;
        timestamp: Date;
        data: unknown;
      };

      const timeline: TimelineItem[] = [
        ...conversation.inboundEmails.map((e) => ({
          type: 'inbound' as const,
          id: e.id,
          timestamp: e.receivedAt,
          data: e,
        })),
        ...conversation.outboundReplies.map((r) => ({
          type: 'outbound' as const,
          id: r.id,
          timestamp: r.createdAt,
          data: r,
        })),
        ...conversation.notes.map((n) => ({
          type: 'note' as const,
          id: n.id,
          timestamp: n.createdAt,
          data: n,
        })),
        ...conversation.activities.map((a) => ({
          type: 'activity' as const,
          id: a.id,
          timestamp: a.createdAt,
          data: a,
        })),
      ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Customer stats
      let customerStats = null;
      if (conversation.customer) {
        const [orderCount, totalSpent, conversationCount] = await Promise.all([
          prisma.order.count({ where: { userId: conversation.customer.id } }),
          prisma.order.aggregate({
            where: { userId: conversation.customer.id, status: { not: 'CANCELLED' } },
            _sum: { total: true },
          }),
          prisma.emailConversation.count({ where: { customerId: conversation.customer.id } }),
        ]);
        customerStats = {
          orderCount,
          totalSpent: totalSpent._sum.total || 0,
          conversationCount,
        };
      }

      return NextResponse.json({ conversation, timeline, customerStats });
    } catch (error) {
      console.error('[Admin Inbox Detail] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const PUT = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      const { id } = params;
      const body = await request.json();
      const { status, assignedToId, priority, tags, snoozedUntil } = body;

      const existing = await prisma.emailConversation.findUnique({
        where: { id },
        select: { status: true, assignedToId: true, priority: true, tags: true },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      const updates: Record<string, unknown> = {};
      const activities: Array<{ action: string; details: string }> = [];

      if (status && status !== existing.status) {
        updates.status = status;
        activities.push({
          action: 'status_changed',
          details: JSON.stringify({ from: existing.status, to: status }),
        });
      }

      if (assignedToId !== undefined && assignedToId !== existing.assignedToId) {
        updates.assignedToId = assignedToId || null;
        activities.push({
          action: 'assigned',
          details: JSON.stringify({ from: existing.assignedToId, to: assignedToId }),
        });
      }

      if (priority && priority !== existing.priority) {
        updates.priority = priority;
        activities.push({
          action: 'priority_changed',
          details: JSON.stringify({ from: existing.priority, to: priority }),
        });
      }

      if (tags !== undefined) {
        const tagsStr = JSON.stringify(tags);
        updates.tags = tagsStr;
        activities.push({
          action: 'tagged',
          details: JSON.stringify({ tags }),
        });
      }

      if (snoozedUntil !== undefined) {
        updates.snoozedUntil = snoozedUntil ? new Date(snoozedUntil) : null;
        activities.push({
          action: 'snoozed',
          details: JSON.stringify({ until: snoozedUntil }),
        });
      }

      const [conversation] = await prisma.$transaction([
        prisma.emailConversation.update({ where: { id }, data: updates }),
        ...activities.map((a) =>
          prisma.conversationActivity.create({
            data: {
              conversationId: id,
              actorId: session.user.id,
              action: a.action,
              details: a.details,
            },
          })
        ),
      ]);

      return NextResponse.json({ conversation });
    } catch (error) {
      console.error('[Admin Inbox Update] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
