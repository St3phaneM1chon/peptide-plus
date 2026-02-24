export const dynamic = 'force-dynamic';

/**
 * Admin Inbox Conversation Detail API
 * GET  - Get conversation with full thread
 * PUT  - Update conversation (status, assignation, tags, priority, snooze)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const updateConversationSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'SNOOZED', 'CLOSED', 'SPAM']).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  snoozedUntil: z.string().datetime().nullable().optional(),
  internalNote: z.string().max(5000).optional(),
});

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

      // Auto-reopen snoozed conversations whose snooze time has passed
      if (
        conversation.status === 'SNOOZED' &&
        conversation.snoozedUntil &&
        new Date(conversation.snoozedUntil) <= new Date()
      ) {
        await prisma.$transaction([
          prisma.emailConversation.update({
            where: { id },
            data: { status: 'OPEN', snoozedUntil: null },
          }),
          prisma.conversationActivity.create({
            data: {
              conversationId: id,
              actorId: null,
              action: 'snooze_expired',
              details: JSON.stringify({ previousSnoozedUntil: conversation.snoozedUntil }),
            },
          }),
        ]);
        conversation.status = 'OPEN';
        conversation.snoozedUntil = null;
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
      logger.error('[Admin Inbox Detail] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const PUT = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      // Rate limiting
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip') || '127.0.0.1';
      const rl = await rateLimitMiddleware(ip, '/api/admin/emails/inbox/update');
      if (!rl.success) {
        const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
        Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
        return res;
      }
      // CSRF validation
      const csrfValid = await validateCsrf(request);
      if (!csrfValid) {
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }

      const { id } = params;
      const body = await request.json();
      const parsed = updateConversationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
      }
      const { status, assignedToId, priority, tags, snoozedUntil, internalNote } = parsed.data;

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
        if (snoozedUntil) {
          const snoozeDate = new Date(snoozedUntil);
          if (isNaN(snoozeDate.getTime())) {
            return NextResponse.json({ error: 'Invalid snoozedUntil date' }, { status: 400 });
          }
          const now = new Date();
          if (snoozeDate <= now) {
            return NextResponse.json({ error: 'snoozedUntil must be a future date' }, { status: 400 });
          }
          const maxSnooze = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          if (snoozeDate > maxSnooze) {
            return NextResponse.json({ error: 'snoozedUntil cannot be more than 30 days ahead' }, { status: 400 });
          }
          updates.snoozedUntil = snoozeDate;
          updates.status = 'SNOOZED';
          activities.push({
            action: 'snoozed',
            details: JSON.stringify({ until: snoozedUntil }),
          });
        } else {
          // Clear snooze
          updates.snoozedUntil = null;
          if (existing.status === 'SNOOZED') {
            updates.status = 'OPEN';
          }
          activities.push({
            action: 'snooze_cleared',
            details: JSON.stringify({ previousStatus: existing.status }),
          });
        }
      }

      // Handle inline internal note (convenience shortcut — full notes via POST /inbox/[id]/note)
      const noteOps = [];
      if (typeof internalNote === 'string' && internalNote.trim()) {
        noteOps.push(
          prisma.conversationNote.create({
            data: {
              conversationId: id,
              authorId: session.user.id,
              content: internalNote.trim(),
            },
          })
        );
        activities.push({
          action: 'note_added',
          details: JSON.stringify({ preview: internalNote.trim().substring(0, 200) }),
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
        ...noteOps,
      ]);

      logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_CONVERSATION',
        targetType: 'EmailConversation',
        targetId: id,
        previousValue: { status: existing.status, assignedToId: existing.assignedToId, priority: existing.priority },
        newValue: updates,
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ conversation });
    } catch (error) {
      logger.error('[Admin Inbox Update] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
