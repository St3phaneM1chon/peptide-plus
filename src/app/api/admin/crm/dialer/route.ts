export const dynamic = 'force-dynamic';

/**
 * Power Dialer Session API
 *
 * GET  /api/admin/crm/dialer           - Get current session state for the authenticated agent
 * POST /api/admin/crm/dialer           - Start a dialer session
 *
 * POST body (option A — existing campaign):
 *   { mode: 'campaign', campaignId: string }
 *
 * POST body (option B — ad-hoc from CRM leads):
 *   {
 *     mode: 'adhoc',
 *     campaignName?: string,       // defaults to "Session YYYY-MM-DD"
 *     callerIdNumber: string,       // E.164 DID
 *     leadIds?: string[],           // optional subset of leads; omit for all filtered leads
 *     filters?: { temperature?: string, status?: string } // applied when leadIds is absent
 *   }
 *
 * GET response data:
 *   {
 *     session: { campaignId, agentUserId, state, ... } | null,
 *     campaign: { id, name, callerIdNumber, scriptTitle, scriptBody, totalContacts, totalCalled, totalConnected } | null,
 *     currentEntry: { id, phoneNumber, firstName, lastName, email } | null,
 *   }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import {
  startDialerSession,
  getSessionState,
} from '@/lib/voip/power-dialer';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const startCampaignSchema = z.object({
  mode: z.literal('campaign'),
  campaignId: z.string().min(1, 'campaignId is required'),
});

const startAdhocSchema = z.object({
  mode: z.literal('adhoc'),
  campaignName: z.string().max(200).optional(),
  callerIdNumber: z.string().min(1, 'callerIdNumber is required'),
  leadIds: z.array(z.string()).max(500).optional(),
  filters: z
    .object({
      temperature: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

const startSessionSchema = z.discriminatedUnion('mode', [
  startCampaignSchema,
  startAdhocSchema,
]);

// ---------------------------------------------------------------------------
// GET — Get current session state for the authenticated agent
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(
  async (_request: NextRequest, { session }) => {
    const agentUserId = session.user.id as string;

    const dialerSession = getSessionState(agentUserId);

    if (!dialerSession) {
      return apiSuccess({ session: null, campaign: null, currentEntry: null });
    }

    // Fetch campaign details for the UI (script, caller ID, stats, etc.)
    const campaign = await prisma.dialerCampaign.findUnique({
      where: { id: dialerSession.campaignId },
      select: {
        id: true,
        name: true,
        callerIdNumber: true,
        scriptTitle: true,
        scriptBody: true,
        totalContacts: true,
        totalCalled: true,
        totalConnected: true,
      },
    });

    // Fetch current list entry if any
    let currentEntry = null;
    if (dialerSession.currentEntryId) {
      currentEntry = await prisma.dialerListEntry.findUnique({
        where: { id: dialerSession.currentEntryId },
        select: {
          id: true,
          phoneNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          customFields: true,
          callAttempts: true,
          lastCalledAt: true,
        },
      });
    }

    return apiSuccess({
      session: {
        campaignId: dialerSession.campaignId,
        agentUserId: dialerSession.agentUserId,
        state: dialerSession.state,
        currentEntryId: dialerSession.currentEntryId ?? null,
        currentCallControlId: dialerSession.currentCallControlId ?? null,
        startedAt: dialerSession.startedAt,
        callCount: dialerSession.callCount,
        connectCount: dialerSession.connectCount,
      },
      campaign,
      currentEntry,
    });
  },
  { requiredPermission: 'crm.leads.view', skipCsrf: true }
);

// ---------------------------------------------------------------------------
// POST — Start a dialer session (campaign or ad-hoc)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(
  async (request: NextRequest, { session }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON body', 'INVALID_BODY', { status: 400 });
    }

    const parsed = startSessionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'Invalid request body',
        'VALIDATION_ERROR',
        { status: 400 }
      );
    }

    const agentUserId = session.user.id as string;

    // -----------------------------------------------------------------------
    // Mode A: Existing campaign
    // -----------------------------------------------------------------------
    if (parsed.data.mode === 'campaign') {
      const { campaignId } = parsed.data;

      const campaign = await prisma.dialerCampaign.findUnique({
        where: { id: campaignId },
        select: { id: true, name: true, status: true },
      });

      if (!campaign) {
        return apiError('Campaign not found', 'NOT_FOUND', { status: 404 });
      }

      const result = await startDialerSession(campaignId, agentUserId);

      if (result.status === 'error') {
        return apiError(result.message, 'DIALER_ERROR', { status: 422 });
      }

      return apiSuccess(
        { message: result.message, campaignId, agentUserId },
        { status: 201 }
      );
    }

    // -----------------------------------------------------------------------
    // Mode B: Ad-hoc campaign created from CRM leads
    // -----------------------------------------------------------------------
    const { campaignName, callerIdNumber, leadIds, filters } = parsed.data;

    // Find a company to associate the campaign with.
    // For a single-tenant setup, use the first active company.
    const company = await prisma.company.findFirst({
      where: { isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!company) {
      return apiError(
        'No active company found. Please create a Company record first.',
        'NO_COMPANY',
        { status: 422 }
      );
    }

    // Build lead filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadWhere: Record<string, any> = {
      dncStatus: 'CALLABLE',
      phone: { not: null },
    };

    if (filters?.temperature) leadWhere.temperature = filters.temperature;
    if (filters?.status) leadWhere.status = filters.status;
    if (leadIds && leadIds.length > 0) {
      leadWhere.id = { in: leadIds };
    }

    const leads = await prisma.crmLead.findMany({
      where: leadWhere,
      select: { id: true, contactName: true, phone: true, email: true },
      orderBy: { score: 'desc' },
      take: 500,
    });

    if (leads.length === 0) {
      return apiError(
        'No callable leads found with the current filters.',
        'NO_LEADS',
        { status: 422 }
      );
    }

    const name =
      campaignName ||
      `Session ${new Date().toISOString().slice(0, 10)}`;

    // Create the ad-hoc campaign + list entries in a transaction
    const campaign = await prisma.$transaction(async (tx) => {
      const c = await tx.dialerCampaign.create({
        data: {
          companyId: company.id,
          name,
          status: 'ACTIVE',
          callerIdNumber,
          maxConcurrent: 1,
          useAmd: true,
          timezone: 'America/Montreal',
          activeDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
          totalContacts: leads.length,
        },
      });

      // Bulk-insert list entries
      await tx.dialerListEntry.createMany({
        data: leads.map((lead) => {
          const nameParts = lead.contactName.trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          return {
            campaignId: c.id,
            phoneNumber: lead.phone as string,
            firstName,
            lastName,
            email: lead.email ?? undefined,
          };
        }),
      });

      return c;
    });

    const result = await startDialerSession(campaign.id, agentUserId);

    if (result.status === 'error') {
      return apiError(result.message, 'DIALER_ERROR', { status: 422 });
    }

    return apiSuccess(
      {
        message: result.message,
        campaignId: campaign.id,
        campaignName: campaign.name,
        leadCount: leads.length,
        agentUserId,
      },
      { status: 201 }
    );
  }, { requiredPermission: 'crm.leads.edit' });
