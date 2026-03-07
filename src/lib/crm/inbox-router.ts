/**
 * INBOX AUTO-ROUTING
 * Find or create conversations, auto-assign agents, append messages.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type Channel = 'EMAIL' | 'SMS' | 'PHONE' | 'CHAT' | 'WHATSAPP';

// ---------------------------------------------------------------------------
// Find or create conversation
// ---------------------------------------------------------------------------

/**
 * Look for an existing open/pending InboxConversation matching the channel
 * and contact identifier. If none exists, create a new one.
 *
 * The `contactIdentifier` is matched against User.email, User.phone (via
 * name fallback), or CrmLead.email / CrmLead.phone to link the conversation
 * to a known contact or lead.
 */
export async function findOrCreateConversation(
  channel: Channel,
  contactIdentifier: string,
  subject?: string,
): Promise<{ conversationId: string; isNew: boolean }> {
  // Try to find an existing open/pending conversation for this channel + contact
  const existingByContact = await prisma.inboxConversation.findFirst({
    where: {
      channel,
      status: { in: ['OPEN', 'PENDING'] },
      OR: [
        { contact: { email: contactIdentifier } },
        { lead: { email: contactIdentifier } },
        { lead: { phone: contactIdentifier } },
      ],
    },
    select: { id: true },
  });

  if (existingByContact) {
    return { conversationId: existingByContact.id, isNew: false };
  }

  // Resolve contact: try User first, then CrmLead
  let contactId: string | undefined;
  let leadId: string | undefined;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: contactIdentifier }],
    },
    select: { id: true },
  });

  if (user) {
    contactId = user.id;
  } else {
    const lead = await prisma.crmLead.findFirst({
      where: {
        OR: [{ email: contactIdentifier }, { phone: contactIdentifier }],
      },
      select: { id: true },
    });
    if (lead) {
      leadId = lead.id;
    }
  }

  // Create new conversation
  const conversation = await prisma.inboxConversation.create({
    data: {
      channel,
      status: 'OPEN',
      subject: subject ?? null,
      contactId: contactId ?? null,
      leadId: leadId ?? null,
    },
  });

  logger.info('New inbox conversation created', {
    conversationId: conversation.id,
    channel,
    contactIdentifier,
    contactId,
    leadId,
  });

  return { conversationId: conversation.id, isNew: true };
}

// ---------------------------------------------------------------------------
// Auto-assign conversation
// ---------------------------------------------------------------------------

/**
 * Auto-assign a conversation to an agent.
 *
 * Priority:
 * 1. If the conversation is linked to a lead that already has an assignee,
 *    assign to that agent.
 * 2. Otherwise, round-robin among all EMPLOYEE users.
 *
 * Returns the assigned agent ID, or null if no agents available.
 */
export async function autoAssignConversation(
  conversationId: string,
): Promise<string | null> {
  const conversation = await prisma.inboxConversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      lead: { select: { assignedToId: true } },
    },
  });

  // If lead already has an assignee, use them
  if (conversation.lead?.assignedToId) {
    await prisma.inboxConversation.update({
      where: { id: conversationId },
      data: { assignedToId: conversation.lead.assignedToId },
    });

    logger.info('Conversation assigned to lead agent', {
      conversationId,
      agentId: conversation.lead.assignedToId,
    });

    return conversation.lead.assignedToId;
  }

  // Round-robin among EMPLOYEE users
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: { id: true },
    take: 1000,
  });

  if (employees.length === 0) {
    logger.warn('autoAssignConversation: no EMPLOYEE users found', { conversationId });
    return null;
  }

  // Count active conversations per employee
  const counts = await prisma.inboxConversation.groupBy({
    by: ['assignedToId'],
    where: {
      assignedToId: { in: employees.map((e) => e.id) },
      status: { in: ['OPEN', 'PENDING'] },
    },
    _count: { id: true },
  });

  const countMap = new Map<string, number>();
  for (const emp of employees) {
    countMap.set(emp.id, 0);
  }
  for (const row of counts) {
    if (row.assignedToId) {
      countMap.set(row.assignedToId, row._count.id);
    }
  }

  // Pick agent with fewest active conversations
  let chosenId = employees[0].id;
  let minCount = Infinity;
  for (const [agentId, count] of countMap.entries()) {
    if (count < minCount) {
      minCount = count;
      chosenId = agentId;
    }
  }

  await prisma.inboxConversation.update({
    where: { id: conversationId },
    data: { assignedToId: chosenId },
  });

  logger.info('Conversation auto-assigned via round-robin', {
    conversationId,
    agentId: chosenId,
    agentLoad: minCount,
  });

  return chosenId;
}

// ---------------------------------------------------------------------------
// Add message to conversation
// ---------------------------------------------------------------------------

/**
 * Append a message to an existing conversation and update its lastMessageAt
 * timestamp.  Returns the new message ID.
 */
export async function addMessageToConversation(
  conversationId: string,
  direction: 'INBOUND' | 'OUTBOUND',
  content: string,
  metadata?: Record<string, unknown>,
): Promise<string> {
  const message = await prisma.inboxMessage.create({
    data: {
      conversationId,
      direction,
      content,
      metadata: (metadata ?? undefined) as undefined | Record<string, string | number | boolean>,
    },
  });

  await prisma.inboxConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  logger.debug('Message added to conversation', {
    conversationId,
    messageId: message.id,
    direction,
  });

  return message.id;
}
