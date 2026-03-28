/**
 * SHARED INBOX
 * Manage shared mailboxes (e.g., support@, sales@) with round-robin assignment
 * across team members.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SharedMailbox {
  address: string;
  name: string;
  assignedTeam: string[];
}

// ---------------------------------------------------------------------------
// Get shared mailboxes
// ---------------------------------------------------------------------------

/**
 * Return the list of configured shared mailboxes.
 * Reads from SHARED_MAILBOXES env var (JSON array) or returns sensible defaults.
 *
 * Env format example:
 *   SHARED_MAILBOXES='[{"address":"support@attitudes.vip","name":"Support","assignedTeam":["userId1","userId2"]}]'
 */
export async function getSharedMailboxes(): Promise<SharedMailbox[]> {
  const envMailboxes = process.env.SHARED_MAILBOXES;

  if (envMailboxes) {
    try {
      const parsed = JSON.parse(envMailboxes);
      if (Array.isArray(parsed)) {
        return parsed.map((m: Record<string, unknown>) => ({
          address: (m.address as string) || '',
          name: (m.name as string) || (m.address as string) || '',
          assignedTeam: Array.isArray(m.assignedTeam) ? (m.assignedTeam as string[]) : [],
        }));
      }
    } catch (error) {
      logger.error('[SharedInbox] Failed to parse SHARED_MAILBOXES env var', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Default shared mailboxes based on existing employees
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: { id: true },
    take: 10,
  });

  const employeeIds = employees.map((e) => e.id);

  return [
    {
      address: 'support@attitudes.vip',
      name: 'Support',
      assignedTeam: employeeIds,
    },
    {
      address: 'sales@attitudes.vip',
      name: 'Sales',
      assignedTeam: employeeIds,
    },
    {
      address: 'info@attitudes.vip',
      name: 'General',
      assignedTeam: employeeIds,
    },
  ];
}

// ---------------------------------------------------------------------------
// Route shared email
// ---------------------------------------------------------------------------

/**
 * Create an InboxConversation for an email received on a shared mailbox.
 * Auto-assigns to a team member using round-robin (fewest open conversations).
 * Returns the conversation ID.
 */
export async function routeSharedEmail(
  mailbox: string,
  from: string,
  subject: string,
  body: string,
): Promise<string> {
  // Get the mailbox config
  const mailboxes = await getSharedMailboxes();
  const config = mailboxes.find(
    (m) => m.address.toLowerCase() === mailbox.toLowerCase(),
  );

  const teamMembers = config?.assignedTeam || [];

  // Determine assignment via round-robin
  let assignedToId: string | null = null;

  if (teamMembers.length > 0) {
    // Count open conversations per team member
    const counts = await prisma.inboxConversation.groupBy({
      by: ['assignedToId'],
      where: {
        assignedToId: { in: teamMembers },
        status: { in: ['OPEN', 'PENDING'] },
      },
      _count: { id: true },
    });

    const countMap = new Map<string, number>();
    for (const memberId of teamMembers) {
      countMap.set(memberId, 0);
    }
    for (const row of counts) {
      if (row.assignedToId) {
        countMap.set(row.assignedToId, row._count.id);
      }
    }

    // Pick member with fewest open conversations
    let minCount = Infinity;
    for (const [memberId, count] of countMap.entries()) {
      if (count < minCount) {
        minCount = count;
        assignedToId = memberId;
      }
    }
  }

  // Try to match sender to a lead
  let leadId: string | null = null;
  if (from) {
    const lead = await prisma.crmLead.findFirst({
      where: {
        email: { equals: from.toLowerCase(), mode: 'insensitive' },
      },
      select: { id: true },
    });
    leadId = lead?.id || null;
  }

  // Create conversation
  const conversation = await prisma.inboxConversation.create({
    data: {
      channel: 'EMAIL',
      status: 'OPEN',
      subject: subject || `Email from ${from}`,
      assignedToId,
      leadId,
      lastMessageAt: new Date(),
    },
  });

  // Create the initial message
  await prisma.inboxMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      content: body,
      senderName: from,
      senderEmail: from,
      metadata: {
        sharedMailbox: mailbox,
        assignedTo: assignedToId,
      },
    },
  });

  logger.info('[SharedInbox] Email routed', {
    conversationId: conversation.id,
    mailbox,
    from,
    assignedToId,
    leadId,
  });

  return conversation.id;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Get inbox stats for a shared mailbox.
 */
export async function getSharedInboxStats(
  mailbox: string,
): Promise<{ open: number; pending: number; resolved: number }> {
  // Find conversations where any message metadata references this mailbox
  const baseWhere = {
    channel: 'EMAIL' as const,
    messages: {
      some: {
        metadata: {
          path: ['sharedMailbox'],
          equals: mailbox,
        },
      },
    },
  };

  const [open, pending, resolved] = await Promise.all([
    prisma.inboxConversation.count({
      where: { ...baseWhere, status: 'OPEN' },
    }),
    prisma.inboxConversation.count({
      where: { ...baseWhere, status: 'PENDING' },
    }),
    prisma.inboxConversation.count({
      where: { ...baseWhere, status: 'RESOLVED' },
    }),
  ]);

  return { open, pending, resolved };
}
