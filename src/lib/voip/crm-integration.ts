/**
 * CRM Integration — Screen Pop, Click-to-Call, Call History
 *
 * Features:
 * - Screen pop: match inbound caller to client record
 * - Click-to-call: initiate call from client profile
 * - Call history per client
 * - Contact notes and tags
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as telnyx from '@/lib/telnyx';
import { getTelnyxConnectionId, getDefaultCallerId } from '@/lib/telnyx';

/**
 * Screen Pop: Find client by phone number on inbound call.
 * Returns client data for display in the agent interface.
 */
export async function screenPop(callerNumber: string): Promise<{
  found: boolean;
  client?: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    locale: string;
    loyaltyTier: string;
    loyaltyPoints: number;
    recentCalls: Array<{
      id: string;
      direction: string;
      status: string;
      startedAt: Date;
      duration: number | null;
    }>;
    recentOrders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      total: number;
      createdAt: Date;
    }>;
    tags: string[];
    notes: Array<{
      id: string;
      content: string;
      createdAt: Date;
    }>;
    deals: Array<{
      id: string;
      title: string;
      value: number;
      stageName: string;
    }>;
    openTickets: Array<{
      id: string;
      subject: string | null;
      channel: string;
      createdAt: Date;
    }>;
  };
}> {
  const normalized = normalizeForSearch(callerNumber);

  // Search by phone number (try multiple options)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: callerNumber },
        { phone: normalized },
        { phone: callerNumber.replace(/^\+1/, '') },
        { phone: callerNumber.replace(/^\+/, '') },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      locale: true,
      loyaltyTier: true,
      loyaltyPoints: true,
      tags: true,
      // Recent orders (last 3)
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
      // Customer notes (last 3)
      customerNotes: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    // Also check CRM leads by phone number
    const lead = await prisma.crmLead.findFirst({
      where: {
        phone: {
          not: null,
          in: [
            callerNumber,
            normalized,
            callerNumber.replace(/^\+1/, ''),
            callerNumber.replace(/^\+/, ''),
          ],
        },
      },
      select: {
        id: true,
        contactName: true,
        email: true,
        phone: true,
        companyName: true,
        score: true,
        temperature: true,
      },
    });

    if (lead) {
      // Return lead info as screen pop (no order history for leads)
      return {
        found: true,
        client: {
          id: lead.id,
          name: lead.contactName,
          email: lead.email,
          phone: lead.phone,
          locale: 'fr',
          loyaltyTier: 'NONE',
          loyaltyPoints: 0,
          recentCalls: [],
          recentOrders: [],
          tags: [],
          notes: [{
            id: 'lead-info',
            content: lead.companyName
              ? `Lead — ${lead.companyName} (Score: ${lead.score}, Temp: ${lead.temperature})`
              : `Lead (Score: ${lead.score}, Temp: ${lead.temperature})`,
            createdAt: new Date(),
          }],
          deals: [],
          openTickets: [],
        },
      };
    }

    return { found: false };
  }

  // Fetch recent calls, active CRM deals, and open tickets in parallel
  const [recentCalls, deals, openTickets] = await Promise.all([
    // Recent calls
    prisma.callLog.findMany({
      where: {
        OR: [
          { callerNumber: { contains: normalized } },
          { calledNumber: { contains: normalized } },
          { clientId: user.id },
        ],
      },
      select: {
        id: true,
        direction: true,
        status: true,
        startedAt: true,
        duration: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    // Active CRM deals (from default pipeline)
    prisma.crmDeal.findMany({
      where: {
        contactId: user.id,
        pipeline: { isDefault: true },
      },
      select: {
        id: true,
        title: true,
        value: true,
        stage: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    // Open support tickets
    prisma.inboxConversation.findMany({
      where: {
        contactId: user.id,
        status: 'OPEN',
      },
      select: {
        id: true,
        subject: true,
        channel: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  return {
    found: true,
    client: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      locale: user.locale,
      loyaltyTier: user.loyaltyTier,
      loyaltyPoints: user.loyaltyPoints,
      recentCalls: recentCalls.map(c => ({
        ...c,
        direction: c.direction as string,
        status: c.status as string,
      })),
      recentOrders: user.orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status as string,
        total: Number(o.total),
        createdAt: o.createdAt,
      })),
      tags: user.tags,
      notes: user.customerNotes.map(n => ({
        id: n.id,
        content: n.content,
        createdAt: n.createdAt,
      })),
      deals: deals.map(d => ({
        id: d.id,
        title: d.title,
        value: Number(d.value),
        stageName: d.stage.name,
      })),
      openTickets: openTickets.map(t => ({
        id: t.id,
        subject: t.subject,
        channel: t.channel as string,
        createdAt: t.createdAt,
      })),
    },
  };
}

/**
 * Click-to-Call: Initiate an outbound call to a client.
 */
export async function clickToCall(options: {
  clientId?: string;
  phoneNumber: string;
  agentUserId: string;
  callerIdNumber?: string;
}): Promise<{ callControlId?: string; error?: string }> {
  const connectionId = getTelnyxConnectionId();
  const from = options.callerIdNumber || getDefaultCallerId();
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voip/webhooks/telnyx`;

  try {
    const result = await telnyx.dialCall({
      to: options.phoneNumber,
      from,
      connectionId,
      webhookUrl,
      clientState: JSON.stringify({
        clickToCall: true,
        clientId: options.clientId,
        agentUserId: options.agentUserId,
      }),
      timeout: 30,
    });

    const callControlId = (result as { data?: { call_control_id?: string } })
      ?.data?.call_control_id;

    logger.info('[CRM] Click-to-call initiated', {
      phone: options.phoneNumber,
      clientId: options.clientId,
      callControlId,
    });

    return { callControlId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[CRM] Click-to-call failed', { error: message });
    return { error: message };
  }
}

/**
 * Get full call history for a client.
 */
export async function getClientCallHistory(
  clientId: string,
  options?: { page?: number; limit?: number }
): Promise<{
  calls: Array<{
    id: string;
    direction: string;
    status: string;
    callerNumber: string;
    calledNumber: string;
    startedAt: Date;
    duration: number | null;
    agentNotes: string | null;
    disposition: string | null;
    hasRecording: boolean;
    hasTranscription: boolean;
  }>;
  total: number;
}> {
  const page = options?.page || 1;
  const limit = options?.limit || 20;

  const user = await prisma.user.findUnique({
    where: { id: clientId },
    select: { phone: true },
  });

  const where = {
    OR: [
      { clientId },
      ...(user?.phone ? [
        { callerNumber: user.phone },
        { calledNumber: user.phone },
      ] : []),
    ],
  };

  const [calls, total] = await Promise.all([
    prisma.callLog.findMany({
      where,
      include: {
        recording: { select: { id: true } },
        transcription: { select: { id: true } },
      },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.callLog.count({ where }),
  ]);

  return {
    calls: calls.map(c => ({
      id: c.id,
      direction: c.direction as string,
      status: c.status as string,
      callerNumber: c.callerNumber,
      calledNumber: c.calledNumber,
      startedAt: c.startedAt,
      duration: c.duration,
      agentNotes: c.agentNotes,
      disposition: c.disposition,
      hasRecording: !!c.recording,
      hasTranscription: !!c.transcription,
    })),
    total,
  };
}

/**
 * Link a call to a client record.
 */
export async function linkCallToClient(
  callLogId: string,
  clientId: string
): Promise<void> {
  await prisma.callLog.update({
    where: { id: callLogId },
    data: { clientId },
  });
}

/**
 * Add notes to a call log.
 */
export async function addCallNotes(
  callLogId: string,
  notes: string,
  disposition?: string,
  tags?: string[]
): Promise<void> {
  await prisma.callLog.update({
    where: { id: callLogId },
    data: {
      agentNotes: notes,
      ...(disposition ? { disposition } : {}),
      ...(tags ? { tags } : {}),
    },
  });
}

/**
 * Create a CRM Activity record after a call ends.
 * Links the call to the client's timeline for Client 360 view.
 */
export async function createPostCallActivity(callLog: {
  id: string;
  clientId?: string | null;
  agentId?: string | null;
  direction: string;
  duration?: number | null;
  status: string;
  callerNumber: string;
  calledNumber: string;
  agentNotes?: string | null;
  disposition?: string | null;
  tags?: string[];
}): Promise<void> {
  // Skip if no client linked
  if (!callLog.clientId) return;

  // Find agent's userId from SipExtension
  let performedById: string | null = null;
  if (callLog.agentId) {
    const ext = await prisma.sipExtension.findUnique({
      where: { id: callLog.agentId },
      select: { userId: true },
    });
    performedById = ext?.userId || null;
  }

  // Find active deal for this client (most recent in default pipeline)
  const activeDeal = await prisma.crmDeal.findFirst({
    where: {
      contactId: callLog.clientId,
      pipeline: { isDefault: true },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  // Find CRM lead matching the caller/called phone number
  const phoneToSearch = callLog.direction === 'INBOUND'
    ? normalizeForSearch(callLog.callerNumber)
    : normalizeForSearch(callLog.calledNumber);

  const matchedLead = phoneToSearch
    ? await prisma.crmLead.findFirst({
        where: {
          phone: { contains: phoneToSearch },
        },
        select: { id: true },
      })
    : null;

  // Build description
  const dirLabel = callLog.direction === 'INBOUND' ? 'Appel entrant' : 'Appel sortant';
  const durationMin = callLog.duration ? Math.ceil(callLog.duration / 60) : 0;
  const statusLabel = callLog.status === 'COMPLETED' ? 'complété' :
    callLog.status === 'MISSED' ? 'manqué' :
    callLog.status === 'VOICEMAIL' ? 'messagerie vocale' : callLog.status.toLowerCase();

  let description = `${dirLabel} (${statusLabel}`;
  if (durationMin > 0) description += `, ${durationMin} min`;
  description += ')';
  if (callLog.disposition) description += ` — ${callLog.disposition}`;
  if (callLog.agentNotes) description += `\n${callLog.agentNotes}`;

  // Build title
  const title = `${dirLabel} — ${callLog.direction === 'INBOUND' ? callLog.callerNumber : callLog.calledNumber}`;

  try {
    await prisma.crmActivity.create({
      data: {
        type: 'CALL',
        title,
        contactId: callLog.clientId,
        performedById,
        dealId: activeDeal?.id || null,
        leadId: matchedLead?.id || null,
        description,
        metadata: {
          callLogId: callLog.id,
          direction: callLog.direction,
          duration: callLog.duration,
          status: callLog.status,
          disposition: callLog.disposition,
          tags: callLog.tags || [],
          callerNumber: callLog.callerNumber,
          calledNumber: callLog.calledNumber,
        },
      },
    });

    logger.info('[CRM] Post-call activity created', {
      callLogId: callLog.id,
      clientId: callLog.clientId,
      type: 'CALL',
    });
  } catch (error) {
    // Non-blocking — don't fail the call flow for CRM
    logger.error('[CRM] Failed to create post-call activity', {
      error: error instanceof Error ? error.message : String(error),
      callLogId: callLog.id,
    });
  }
}

// ── Helpers ──────────────────

function normalizeForSearch(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}
