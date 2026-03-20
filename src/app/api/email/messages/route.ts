export const dynamic = 'force-dynamic';

/**
 * Mobile Email Messages API
 * GET /api/email/messages — List emails from configured accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET — List email conversations / inbound emails.
 * Returns data in the format the iOS app expects.
 */
export const GET = withMobileGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'INBOX';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch email conversations with inbound emails AND outbound replies
    const conversations = await prisma.emailConversation.findMany({
      where: {
        status: { not: 'CLOSED' },
      },
      include: {
        inboundEmails: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
        },
        outboundReplies: {
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
        assignedTo: {
          select: { name: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Map to iOS expected format — use real toEmail instead of hardcoded info@
    const messages = conversations.map(conv => {
      const latestEmail = conv.inboundEmails[0];
      // Determine real recipient: use 'to' field from InboundEmail, fallback to info@
      const toEmail = latestEmail?.to || 'info@biocyclepeptides.com';
      return {
        id: conv.id,
        subject: conv.subject || '(Sans objet)',
        from: {
          email: latestEmail?.from || 'unknown@unknown.com',
          name: latestEmail?.fromName || null,
        },
        to: [{ email: toEmail, name: null }],
        cc: [],
        bcc: [],
        body: latestEmail?.textBody || '',
        bodyHtml: latestEmail?.htmlBody || null,
        isRead: conv.status !== 'NEW',
        isStarred: conv.priority === 'URGENT' || conv.priority === 'HIGH',
        hasAttachments: false,
        attachments: [],
        accountEmail: toEmail,
        folder: folder,
        receivedAt: (latestEmail?.receivedAt || conv.createdAt).toISOString(),
        replyToId: null,
        threadId: conv.id,
      };
    });

    return NextResponse.json(messages);
  } catch (error) {
    logger.error('[Email Messages] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list emails' }, { status: 500 });
  }
});
