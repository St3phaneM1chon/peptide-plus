/**
 * INBOUND EMAIL HANDLER
 *
 * Processes inbound emails from Resend/SendGrid webhooks:
 *  - Deduplication by Message-ID
 *  - Conversation threading via In-Reply-To / References headers
 *  - Customer matching by email address
 *  - Attachment storage
 *  - Conversation lifecycle (auto-reopen on new message)
 *  - Activity logging for full audit trail
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import DOMPurify from 'isomorphic-dompurify';

// ---------------------------------------------------------------------------
// Security constants
// ---------------------------------------------------------------------------

/** Maximum attachment size in bytes (25 MB) */
const MAX_ATTACHMENT_SIZE = 25_000_000;

/** DOMPurify config: preserve email formatting, strip scripts/event handlers */
const DOMPURIFY_EMAIL_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'a', 'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'ul', 'ol', 'li', 'b', 'i', 'u', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'hr', 'font', 'center'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style', 'class', 'id', 'width', 'height', 'align', 'valign', 'bgcolor', 'color', 'size', 'face', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InboundEmailPayload {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
  spamScore?: number;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    content: string; // base64
  }>;
}

export interface ProcessedEmail {
  inboundEmail: any;
  conversation: any;
  isNew: boolean;
  customer: any | null;
}

interface TimelineItem {
  type: 'inbound' | 'outbound' | 'note' | 'activity';
  data: any;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Spam threshold: emails above this score are flagged as spam
// ---------------------------------------------------------------------------

let SPAM_THRESHOLD = parseFloat(process.env.SPAM_THRESHOLD || '5.0');
if (isNaN(SPAM_THRESHOLD)) SPAM_THRESHOLD = 5.0;

// ---------------------------------------------------------------------------
// Main processing function
// ---------------------------------------------------------------------------

/**
 * Process an incoming email from webhook.
 *
 * 1. Deduplicate by messageId
 * 2. Find or create conversation (threading by In-Reply-To / References)
 * 3. Match customer by email
 * 4. Store the email and attachments
 * 5. Create activity log
 * 6. If conversation was RESOLVED/CLOSED, reopen it
 * 7. Update conversation lastMessageAt
 */
export async function processInboundEmail(
  payload: InboundEmailPayload,
): Promise<ProcessedEmail> {
  // 1. Deduplication: check if we already processed this messageId
  const existing = await prisma.inboundEmail.findUnique({
    where: { messageId: payload.messageId },
    include: { conversation: true },
  });

  if (existing) {
    const customer = existing.conversation?.customerId
      ? await prisma.user.findUnique({
          where: { id: existing.conversation.customerId },
        })
      : null;

    return {
      inboundEmail: existing,
      conversation: existing.conversation,
      isNew: false,
      customer,
    };
  }

  // 2. Try to find an existing conversation by threading headers
  const existingConversationId = await findConversationByThread(
    payload.inReplyTo,
    payload.references,
  );

  // 3. Match customer by from-email
  const customer = await matchCustomerByEmail(payload.from);

  // Determine if this is spam
  const isSpam =
    payload.spamScore !== undefined && payload.spamScore >= SPAM_THRESHOLD;

  // 4. Use a transaction to atomically create email + conversation + attachments + activity
  const result = await prisma.$transaction(async (tx) => {
    let conversationId = existingConversationId;
    let isNewConversation = false;

    // If no existing conversation, create one
    if (!conversationId) {
      isNewConversation = true;
      const conversation = await tx.emailConversation.create({
        data: {
          subject: payload.subject || '(No Subject)',
          customerId: customer?.id ?? null,
          status: 'NEW',
          priority: 'NORMAL',
          lastMessageAt: new Date(),
        },
      });
      conversationId = conversation.id;
    }

    // Sanitize HTML body to prevent stored XSS (Faille MEDIUM)
    const sanitizedHtml = payload.html
      ? DOMPurify.sanitize(payload.html, DOMPURIFY_EMAIL_CONFIG)
      : null;

    // Create the InboundEmail record
    const inboundEmail = await tx.inboundEmail.create({
      data: {
        conversationId,
        from: payload.from,
        fromName: payload.fromName ?? null,
        to: payload.to,
        subject: payload.subject || '(No Subject)',
        htmlBody: sanitizedHtml,
        textBody: payload.text ?? null,
        messageId: payload.messageId,
        inReplyTo: payload.inReplyTo ?? null,
        references: payload.references ?? null,
        isSpam,
        spamScore: payload.spamScore ?? null,
        receivedAt: new Date(),
      },
    });

    // Store attachments if any (filter out oversized attachments - Faille MEDIUM)
    if (payload.attachments && payload.attachments.length > 0) {
      const validAttachments = payload.attachments.filter((att) => {
        if (att.size > MAX_ATTACHMENT_SIZE) {
          logger.warn('[InboundHandler] Skipping oversized attachment', { filename: att.filename, size: att.size, maxSize: MAX_ATTACHMENT_SIZE });
          return false;
        }
        return true;
      });

      if (validAttachments.length > 0) {
        await tx.inboundEmailAttachment.createMany({
          data: validAttachments.map((att) => ({
            inboundEmailId: inboundEmail.id,
            filename: att.filename,
            mimeType: att.mimeType,
            size: att.size,
            // Placeholder storageUrl -- real implementation would upload to blob storage
            // and return the URL. For now we store a reference path.
            storageUrl: `attachments/${inboundEmail.id}/${att.filename}`,
          })),
        });
      }
    }

    // If conversation already existed and was RESOLVED or CLOSED, reopen it
    if (!isNewConversation && conversationId) {
      await reopenConversationIfNeeded(conversationId, tx as unknown as typeof prisma);
    }

    // Update conversation's lastMessageAt and optionally link customer
    // If the conversation existed but had no customer, and we matched one, link them
    const shouldLinkCustomer = customer && existingConversationId;
    let linkCustomerData = {};
    if (shouldLinkCustomer) {
      const existingConvo = await tx.emailConversation.findUnique({
        where: { id: conversationId },
        select: { customerId: true },
      });
      if (!existingConvo?.customerId) {
        linkCustomerData = { customerId: customer.id };
      }
    }

    await tx.emailConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        ...linkCustomerData,
      },
    });

    // Create activity log for the received email
    await tx.conversationActivity.create({
      data: {
        conversationId,
        actorId: null,
        action: 'email_received',
        details: JSON.stringify({
          from: payload.from,
          fromName: payload.fromName ?? null,
          subject: payload.subject,
          messageId: payload.messageId,
          isSpam,
          attachmentCount: payload.attachments?.length ?? 0,
          customerId: customer?.id ?? null,
        }),
      },
    });

    // Fetch the final conversation state
    const finalConversation = await tx.emailConversation.findUnique({
      where: { id: conversationId },
    });

    return {
      inboundEmail,
      conversation: finalConversation,
      isNew: isNewConversation,
      customer,
    };
  });

  return result;
}

// ---------------------------------------------------------------------------
// Threading: find existing conversation by In-Reply-To / References
// ---------------------------------------------------------------------------

/**
 * Find an existing conversation by threading headers.
 *
 * Strategy:
 *  1. Check In-Reply-To header against InboundEmail.messageId
 *  2. If not found, parse References header (space-separated message IDs)
 *     and check each one against InboundEmail.messageId
 *  3. Return the conversationId of the first match, or null
 *
 * Exported so it can be reused by other modules that need to resolve
 * email threading without running the full inbound processing pipeline.
 */
export async function findConversationByThread(
  inReplyTo?: string,
  references?: string,
): Promise<string | null> {
  // Try In-Reply-To first (most specific, direct reply)
  if (inReplyTo) {
    const cleaned = cleanMessageId(inReplyTo);
    if (cleaned) {
      const match = await prisma.inboundEmail.findUnique({
        where: { messageId: cleaned },
        select: { conversationId: true },
      });
      if (match?.conversationId) {
        return match.conversationId;
      }
    }
  }

  // Try References header (may contain multiple message IDs, newest last)
  if (references) {
    const refIds = parseReferencesHeader(references);

    // Search from newest to oldest for the best thread match
    for (const refId of refIds.reverse()) {
      const match = await prisma.inboundEmail.findUnique({
        where: { messageId: refId },
        select: { conversationId: true },
      });
      if (match?.conversationId) {
        return match.conversationId;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Conversation reopen
// ---------------------------------------------------------------------------

/**
 * Reopen a conversation if it is currently RESOLVED or CLOSED.
 * Returns true if the conversation was reopened, false if it was already open
 * or in another non-terminal state.
 *
 * Accepts an optional Prisma transaction client so it can be used inside
 * existing transactions. Falls back to the default prisma client.
 */
export async function reopenConversationIfNeeded(
  conversationId: string,
  txClient?: typeof prisma,
): Promise<boolean> {
  const db = txClient ?? prisma;
  const conversation = await db.emailConversation.findUnique({
    where: { id: conversationId },
  });

  if (
    !conversation ||
    (conversation.status !== 'RESOLVED' && conversation.status !== 'CLOSED')
  ) {
    return false;
  }

  await db.emailConversation.update({
    where: { id: conversationId },
    data: { status: 'OPEN' },
  });

  // Log the automatic reopen
  await db.conversationActivity.create({
    data: {
      conversationId,
      actorId: null,
      action: 'status_changed',
      details: JSON.stringify({
        from: conversation.status,
        to: 'OPEN',
        reason: 'New inbound email received',
        triggeredBy: 'system',
      }),
    },
  });

  return true;
}

// ---------------------------------------------------------------------------
// Customer matching
// ---------------------------------------------------------------------------

/**
 * Match a customer User by email address (case-insensitive).
 */
async function matchCustomerByEmail(email: string): Promise<any | null> {
  const cleanedEmail = email.trim().toLowerCase();

  // Handle "Name <email@domain.com>" format
  const extracted = extractEmailAddress(cleanedEmail);

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: extracted,
        mode: 'insensitive',
      },
    },
  });

  return user ?? null;
}

// ---------------------------------------------------------------------------
// Conversation thread view
// ---------------------------------------------------------------------------

/**
 * Get conversation with all messages (inbound + outbound + notes + activities)
 * sorted chronologically into a unified timeline.
 */
export async function getConversationThread(conversationId: string) {
  const conversation = await prisma.emailConversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: true,
      assignedTo: true,
      inboundEmails: {
        include: { attachments: true },
        orderBy: { receivedAt: 'asc' },
      },
      outboundReplies: {
        include: { sender: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
      notes: {
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    return null;
  }

  // Build unified timeline
  const timeline: TimelineItem[] = [];

  for (const email of conversation.inboundEmails) {
    timeline.push({
      type: 'inbound',
      data: email,
      timestamp: email.receivedAt,
    });
  }

  for (const reply of conversation.outboundReplies) {
    timeline.push({
      type: 'outbound',
      data: reply,
      timestamp: reply.sentAt ?? reply.createdAt,
    });
  }

  for (const note of conversation.notes) {
    timeline.push({
      type: 'note',
      data: note,
      timestamp: note.createdAt,
    });
  }

  for (const activity of conversation.activities) {
    timeline.push({
      type: 'activity',
      data: activity,
      timestamp: activity.createdAt,
    });
  }

  // Sort chronologically (oldest first)
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return { conversation, timeline };
}

// ---------------------------------------------------------------------------
// Conversation status management
// ---------------------------------------------------------------------------

/**
 * Update conversation status with activity logging.
 */
export async function updateConversationStatus(
  conversationId: string,
  status: string,
  actorId?: string,
) {
  const validStatuses = ['NEW', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.emailConversation.findUnique({
      where: { id: conversationId },
    });

    if (!current) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const previousStatus = current.status;

    // No-op if status hasn't changed
    if (previousStatus === status) {
      return current;
    }

    const updated = await tx.emailConversation.update({
      where: { id: conversationId },
      data: { status },
    });

    await tx.conversationActivity.create({
      data: {
        conversationId,
        actorId: actorId ?? null,
        action: 'status_changed',
        details: JSON.stringify({
          from: previousStatus,
          to: status,
        }),
      },
    });

    return updated;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Conversation assignment
// ---------------------------------------------------------------------------

/**
 * Assign conversation to an agent.
 */
export async function assignConversation(
  conversationId: string,
  assignedToId: string,
  actorId?: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.emailConversation.findUnique({
      where: { id: conversationId },
    });

    if (!current) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const previousAssignee = current.assignedToId;

    const updated = await tx.emailConversation.update({
      where: { id: conversationId },
      data: {
        assignedToId,
        // Auto-transition from NEW to OPEN when first assigned
        ...(current.status === 'NEW' ? { status: 'OPEN' } : {}),
      },
    });

    await tx.conversationActivity.create({
      data: {
        conversationId,
        actorId: actorId ?? null,
        action: 'assigned',
        details: JSON.stringify({
          from: previousAssignee,
          to: assignedToId,
        }),
      },
    });

    // If status was changed to OPEN as part of assignment, log that too
    if (current.status === 'NEW') {
      await tx.conversationActivity.create({
        data: {
          conversationId,
          actorId: actorId ?? null,
          action: 'status_changed',
          details: JSON.stringify({
            from: 'NEW',
            to: 'OPEN',
            reason: 'Auto-opened on assignment',
          }),
        },
      });
    }

    return updated;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Conversation tags
// ---------------------------------------------------------------------------

/**
 * Update tags on a conversation (replaces all tags).
 * Tags are stored as a JSON-encoded string array in the `tags` column.
 */
export async function updateConversationTags(
  conversationId: string,
  tags: string[],
  actorId?: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.emailConversation.findUnique({
      where: { id: conversationId },
    });

    if (!current) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Parse previous tags for the activity log
    let previousTags: string[] = [];
    if (current.tags) {
      try {
        previousTags = JSON.parse(current.tags);
      } catch (error) {
        console.error('[InboundEmail] Failed to parse conversation tags JSON:', error);
        previousTags = [];
      }
    }

    // Deduplicate and normalize tags
    const normalizedTags = [...new Set(tags.map((t) => t.trim().toLowerCase()))].filter(
      (t) => t.length > 0,
    );

    const updated = await tx.emailConversation.update({
      where: { id: conversationId },
      data: {
        tags: JSON.stringify(normalizedTags),
      },
    });

    // Compute added and removed for the activity log
    const added = normalizedTags.filter((t) => !previousTags.includes(t));
    const removed = previousTags.filter((t) => !normalizedTags.includes(t));

    if (added.length > 0 || removed.length > 0) {
      await tx.conversationActivity.create({
        data: {
          conversationId,
          actorId: actorId ?? null,
          action: 'tags_updated',
          details: JSON.stringify({
            previous: previousTags,
            current: normalizedTags,
            added,
            removed,
          }),
        },
      });
    }

    return updated;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Clean a Message-ID header value by stripping angle brackets and whitespace.
 * e.g. "<abc@domain.com>" -> "abc@domain.com"
 */
function cleanMessageId(raw: string): string {
  return raw.trim().replace(/^</, '').replace(/>$/, '').trim();
}

/**
 * Parse a References header into an array of cleaned message IDs.
 * References is a space-separated list of message IDs, each optionally
 * wrapped in angle brackets.
 */
function parseReferencesHeader(references: string): string[] {
  // Split by whitespace or by '>' followed by optional whitespace and '<'
  const parts = references
    .trim()
    .split(/\s+/)
    .map((part) => cleanMessageId(part))
    .filter((part) => part.length > 0);

  return parts;
}

/**
 * Extract a bare email address from a "Name <email>" format or plain email.
 * e.g. "John Doe <john@example.com>" -> "john@example.com"
 * e.g. "john@example.com" -> "john@example.com"
 */
function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match) {
    return match[1].trim().toLowerCase();
  }
  return raw.trim().toLowerCase();
}
