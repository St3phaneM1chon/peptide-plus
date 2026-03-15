/**
 * EMAIL SYNC BIDIRECTIONAL
 * Synchronize inbound emails via IMAP and log outbound emails as CRM activities.
 * Graceful degradation when IMAP env vars are not configured.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// IMAP connection helper (lazy, optional dependency)
// ---------------------------------------------------------------------------

interface ImapEmail {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  messageId: string;
  date: Date;
}

function isImapConfigured(): boolean {
  return !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS);
}

/**
 * Fetch unread emails from IMAP. Returns empty array if IMAP is not configured
 * or if the imapflow package is not installed.
 */
async function fetchUnreadEmails(): Promise<ImapEmail[]> {
  if (!isImapConfigured()) {
    return [];
  }

  try {
    // Dynamic require to avoid build failure if imapflow not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ImapFlow } = require('imapflow');

    const client = new ImapFlow({
      host: process.env.IMAP_HOST!,
      port: parseInt(process.env.IMAP_PORT || '993', 10),
      secure: process.env.IMAP_SECURE !== 'false',
      auth: {
        user: process.env.IMAP_USER!,
        pass: process.env.IMAP_PASS!,
      },
      logger: false,
    });

    await client.connect();

    const mailbox = process.env.IMAP_MAILBOX || 'INBOX';
    const lock = await client.getMailboxLock(mailbox);
    const emails: ImapEmail[] = [];

    try {
      // Search for unseen messages
      const messages = client.fetch({ seen: false }, {
        envelope: true,
        source: true,
        flags: true,
      });

      for await (const msg of messages) {
        const envelope = msg.envelope;
        if (!envelope) continue;

        const fromAddr = envelope.from?.[0];
        const toAddr = envelope.to?.[0];

        // Extract text body from source
        let bodyText = '';
        if (msg.source) {
          const sourceStr = msg.source.toString('utf-8');
          // Simple extraction: look for text after blank line (headers/body separator)
          const bodyStart = sourceStr.indexOf('\r\n\r\n');
          if (bodyStart > -1) {
            bodyText = sourceStr.slice(bodyStart + 4, bodyStart + 5004); // First 5000 chars
          }
        }

        emails.push({
          from: fromAddr?.address || '',
          fromName: fromAddr?.name || undefined,
          to: toAddr?.address || '',
          subject: envelope.subject || '',
          body: bodyText,
          messageId: envelope.messageId || `imap_${Date.now()}_${emails.length}`,
          date: envelope.date || new Date(),
        });

        // Mark as seen
        try {
          await client.messageFlagsAdd(msg.seq, ['\\Seen'], { uid: false });
        } catch {
          // Non-critical: message will be fetched again on next sync
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return emails;
  } catch (error) {
    logger.error('[EmailSync] IMAP fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sync inbound emails
// ---------------------------------------------------------------------------

/**
 * Connect to IMAP, fetch unread emails, and create InboxConversation + InboxMessage
 * for each. Returns count of synced messages and errors.
 * If IMAP env vars are missing, logs warning and returns zeros.
 */
export async function syncInboundEmails(): Promise<{ synced: number; errors: number }> {
  if (!isImapConfigured()) {
    logger.warn('[EmailSync] IMAP not configured (IMAP_HOST, IMAP_USER, IMAP_PASS required)');
    return { synced: 0, errors: 0 };
  }

  let synced = 0;
  let errors = 0;

  const emails = await fetchUnreadEmails();

  // N+1 FIX: Batch-check duplicate messageIds in a single query instead of
  // per-email findFirst (was 1 query per email, now 1 query total)
  const allMessageIds = emails.filter((e) => e.from).map((e) => e.messageId);
  const existingMessages = allMessageIds.length > 0
    ? await prisma.inboxMessage.findMany({
        where: {
          OR: allMessageIds.map((mid) => ({
            metadata: { path: ['emailMessageId'], equals: mid },
          })),
        },
        select: { metadata: true },
      })
    : [];
  const existingMessageIds = new Set(
    existingMessages.map((m) => {
      const meta = m.metadata as Record<string, unknown> | null;
      return meta?.emailMessageId as string | undefined;
    }).filter(Boolean)
  );

  // N+1 FIX: Batch-match all sender emails to leads in a single query
  // instead of per-email matchEmailToLead (was 1 query per email, now 1 query total)
  const allSenderEmails = [...new Set(emails.filter((e) => e.from).map((e) => e.from.toLowerCase()))];
  const matchedLeads = allSenderEmails.length > 0
    ? await prisma.crmLead.findMany({
        where: { email: { in: allSenderEmails, mode: 'insensitive' } },
        select: { id: true, email: true },
      })
    : [];
  const emailToLeadMap = new Map(
    matchedLeads.map((l) => [l.email!.toLowerCase(), l.id])
  );

  for (const email of emails) {
    try {
      // Skip empty/invalid emails
      if (!email.from) {
        errors++;
        continue;
      }

      // Check pre-fetched duplicate set
      if (existingMessageIds.has(email.messageId)) {
        continue; // Already synced
      }

      // Use pre-fetched lead map instead of per-email DB query
      const leadId = emailToLeadMap.get(email.from.toLowerCase()) || null;

      // Find or create conversation
      let conversation = await prisma.inboxConversation.findFirst({
        where: {
          channel: 'EMAIL',
          status: { in: ['OPEN', 'PENDING'] },
          ...(leadId ? { leadId } : {}),
          subject: email.subject || undefined,
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      if (!conversation) {
        // Determine assignment from lead if possible
        let assignedToId: string | null = null;
        if (leadId) {
          const lead = await prisma.crmLead.findUnique({
            where: { id: leadId },
            select: { assignedToId: true },
          });
          assignedToId = lead?.assignedToId || null;
        }

        conversation = await prisma.inboxConversation.create({
          data: {
            channel: 'EMAIL',
            status: 'OPEN',
            subject: email.subject || `Email from ${email.fromName || email.from}`,
            leadId,
            assignedToId,
            lastMessageAt: email.date,
          },
        });
      }

      // Create inbox message
      await prisma.inboxMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          content: email.body,
          senderName: email.fromName || email.from,
          senderEmail: email.from,
          metadata: {
            emailMessageId: email.messageId,
            emailSubject: email.subject,
            syncedAt: new Date().toISOString(),
          },
        },
      });

      // Update conversation
      await prisma.inboxConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: email.date, status: 'OPEN' },
      });

      // Create CRM activity if linked to a lead (with A9-P2-002 dedup check)
      if (leadId) {
        const existingActivity = await prisma.crmActivity.findFirst({
          where: {
            leadId,
            type: 'EMAIL',
            metadata: {
              path: ['messageId'],
              equals: email.messageId,
            },
          },
          select: { id: true },
        });

        if (!existingActivity) {
          await prisma.crmActivity.create({
            data: {
              type: 'EMAIL',
              title: `Inbound email: ${email.subject || '(no subject)'}`,
              description: email.body.slice(0, 500),
              leadId,
              metadata: {
                direction: 'inbound',
                from: email.from,
                subject: email.subject,
                messageId: email.messageId,
                conversationId: conversation.id,
              },
            },
          });
        }
      }

      synced++;
    } catch (error) {
      errors++;
      logger.error('[EmailSync] Failed to process email', {
        messageId: email.messageId,
        from: email.from,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('[EmailSync] Sync complete', { synced, errors, total: emails.length });
  return { synced, errors };
}

// ---------------------------------------------------------------------------
// Log outbound email
// ---------------------------------------------------------------------------

/**
 * Record a sent email as a CrmActivity for tracking purposes.
 */
export async function logOutboundEmail(
  to: string,
  subject: string,
  body: string,
  leadId?: string,
): Promise<void> {
  // If no leadId provided, try to match by email
  const resolvedLeadId = leadId || (await matchEmailToLead(to));

  await prisma.crmActivity.create({
    data: {
      type: 'EMAIL',
      title: `Outbound email: ${subject}`,
      description: body.slice(0, 500),
      leadId: resolvedLeadId,
      metadata: {
        direction: 'outbound',
        to,
        subject,
        sentAt: new Date().toISOString(),
      },
    },
  });

  // Update lead last contacted if matched
  if (resolvedLeadId) {
    await prisma.crmLead.update({
      where: { id: resolvedLeadId },
      data: { lastContactedAt: new Date() },
    });
  }

  logger.info('[EmailSync] Outbound email logged', { to, subject, leadId: resolvedLeadId });
}

// ---------------------------------------------------------------------------
// Match email to lead
// ---------------------------------------------------------------------------

/**
 * Find a CrmLead by email address. Returns lead ID or null.
 */
export async function matchEmailToLead(email: string): Promise<string | null> {
  if (!email) return null;

  const lead = await prisma.crmLead.findFirst({
    where: {
      email: { equals: email.toLowerCase(), mode: 'insensitive' },
    },
    select: { id: true },
  });

  return lead?.id || null;
}

// ---------------------------------------------------------------------------
// Auto-create lead from unknown email (E22)
// ---------------------------------------------------------------------------

/**
 * Check if a contact (User or CrmLead) exists for the given email.
 * If not, auto-create a new CrmLead with source=EMAIL, status=NEW.
 * Optionally links to an existing InboxConversation.
 *
 * Returns the found or newly created lead ID.
 */
export async function autoCreateLeadFromEmail(
  senderEmail: string,
  senderName?: string,
  subject?: string,
): Promise<{ leadId: string; isNew: boolean }> {
  if (!senderEmail) {
    throw new Error('senderEmail is required');
  }

  const normalizedEmail = senderEmail.toLowerCase().trim();

  // 1. Check if a User already exists with this email
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  });

  if (existingUser) {
    logger.debug('[EmailSync] User already exists for email', { email: normalizedEmail, userId: existingUser.id });
    // Try to find an existing lead linked to this user or email
    const existingLead = await prisma.crmLead.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingLead) {
      return { leadId: existingLead.id, isNew: false };
    }
    // Create a lead for the known user
    const lead = await prisma.crmLead.create({
      data: {
        contactName: senderName || normalizedEmail,
        email: normalizedEmail,
        source: 'EMAIL',
        status: 'NEW',
        temperature: 'WARM',
      },
    });
    logger.info('[EmailSync] Lead auto-created for known user', { leadId: lead.id, email: normalizedEmail });
    return { leadId: lead.id, isNew: true };
  }

  // 2. Check if a CrmLead already exists with this email
  const existingLead = await prisma.crmLead.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  });

  if (existingLead) {
    return { leadId: existingLead.id, isNew: false };
  }

  // 3. Create a new CrmLead
  const lead = await prisma.crmLead.create({
    data: {
      contactName: senderName || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      source: 'EMAIL',
      status: 'NEW',
      temperature: 'COLD',
    },
  });

  // 4. Link to any open InboxConversation for this email
  const openConversation = await prisma.inboxConversation.findFirst({
    where: {
      channel: 'EMAIL',
      status: { in: ['OPEN', 'PENDING'] },
      leadId: null,
      messages: {
        some: { senderEmail: { equals: normalizedEmail, mode: 'insensitive' } },
      },
    },
    select: { id: true },
  });

  if (openConversation) {
    await prisma.inboxConversation.update({
      where: { id: openConversation.id },
      data: { leadId: lead.id },
    });
  }

  // 5. Create an activity for the auto-creation
  await prisma.crmActivity.create({
    data: {
      type: 'NOTE',
      title: `Lead auto-created from inbound email`,
      description: subject
        ? `Subject: ${subject}\nFrom: ${senderName || normalizedEmail}`
        : `Inbound email from ${senderName || normalizedEmail}`,
      leadId: lead.id,
      metadata: {
        autoCreated: true,
        source: 'email_sync',
        originalEmail: normalizedEmail,
        originalName: senderName || null,
      },
    },
  });

  logger.info('[EmailSync] Lead auto-created from unknown email', {
    leadId: lead.id,
    email: normalizedEmail,
    senderName,
    linkedConversation: openConversation?.id ?? null,
  });

  return { leadId: lead.id, isNew: true };
}

// ---------------------------------------------------------------------------
// Sync status
// ---------------------------------------------------------------------------

/**
 * Get the current email sync status.
 */
export async function getEmailSyncStatus(): Promise<{
  lastSync: Date | null;
  totalSynced: number;
  isConfigured: boolean;
}> {
  const isConfigured = isImapConfigured();

  // Count total synced inbox messages with email channel
  const totalSynced = await prisma.inboxMessage.count({
    where: {
      conversation: { channel: 'EMAIL' },
      direction: 'INBOUND',
      metadata: {
        path: ['syncedAt'],
        not: null as unknown as undefined,
      },
    },
  });

  // Find the most recent synced message
  const lastMessage = await prisma.inboxMessage.findFirst({
    where: {
      conversation: { channel: 'EMAIL' },
      direction: 'INBOUND',
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return {
    lastSync: lastMessage?.createdAt || null,
    totalSynced,
    isConfigured,
  };
}
