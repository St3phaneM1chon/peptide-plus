export const dynamic = 'force-dynamic';

/**
 * GDPR Right to Deletion API (L10 - Art. 17)
 * POST /api/admin/crm/gdpr-delete - Delete all data for a specific contact
 *
 * Requires OWNER role. Creates audit log before deletion.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const gdprDeleteSchema = z.object({
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  reason: z.string().max(2000).default('GDPR Article 17 - Right to erasure'),
}).refine(
  (data) => data.contactEmail || data.contactPhone || data.leadId,
  { message: 'At least one identifier (contactEmail, contactPhone, or leadId) is required' }
);

// ---------------------------------------------------------------------------
// POST: GDPR Right to Deletion
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(
  async (request: NextRequest, { session }) => {
    // Enforce OWNER role
    if (session.user.role !== 'OWNER') {
      return apiError('GDPR deletion requires OWNER role', ErrorCode.FORBIDDEN, {
        status: 403,
        request,
      });
    }

    const body = await request.json();
    const parsed = gdprDeleteSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        request,
      });
    }

    const { contactEmail, contactPhone, leadId, reason } = parsed.data;

    const deleted: Record<string, number> = {
      leads: 0,
      activities: 0,
      conversations: 0,
      messages: 0,
      callLogs: 0,
      consentRecords: 0,
      campaignActivities: 0,
      prospects: 0,
      dialerEntries: 0,
    };

    // Find leads matching the contact info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadWhere: Record<string, any> = {};
    if (leadId) {
      leadWhere.id = leadId;
    } else {
      const orConditions = [];
      if (contactEmail) orConditions.push({ email: contactEmail });
      if (contactPhone) orConditions.push({ phone: contactPhone });
      if (orConditions.length > 0) {
        leadWhere.OR = orConditions;
      }
    }

    const leads = await prisma.crmLead.findMany({
      where: leadWhere,
      select: { id: true, contactName: true, email: true, phone: true },
    });

    const leadIds = leads.map((l) => l.id);

    // CRM-F7 FIX: Log only IDs and counts, NOT PII (defeats purpose of GDPR erasure)
    logger.info('[gdpr-delete] GDPR deletion initiated', {
      event: 'gdpr_deletion_initiated',
      requestedBy: session.user.id,
      reason,
      leadsFound: leadIds.length,
      leadIds, // Internal IDs only, not PII
    });

    // Wrap all deletions in a transaction for atomicity (GDPR requires complete erasure)
    await prisma.$transaction(async (tx) => {
      if (leadIds.length > 0) {
        // Phase 1: Delete child records that depend on conversations (must come first)
        const conversations = await tx.inboxConversation.findMany({
          where: { leadId: { in: leadIds } },
          select: { id: true },
        });

        if (conversations.length > 0) {
          const convIds = conversations.map((c) => c.id);
          const messagesResult = await tx.inboxMessage.deleteMany({
            where: { conversationId: { in: convIds } },
          });
          deleted.messages = messagesResult.count;

          const convsResult = await tx.inboxConversation.deleteMany({
            where: { id: { in: convIds } },
          });
          deleted.conversations = convsResult.count;
        }

        // Phase 2: Delete all lead-dependent records in parallel
        const [campaignResult, activitiesResult, tasksResult, dialerResult] = await Promise.all([
          tx.crmCampaignActivity.deleteMany({
            where: { leadId: { in: leadIds } },
          }),
          tx.crmActivity.deleteMany({
            where: { leadId: { in: leadIds } },
          }),
          tx.crmTask.deleteMany({
            where: { leadId: { in: leadIds } },
          }),
          tx.dialerListEntry.deleteMany({
            where: { crmLeadId: { in: leadIds } },
          }),
        ]);
        deleted.campaignActivities = campaignResult.count;
        deleted.activities = activitiesResult.count + tasksResult.count;
        deleted.dialerEntries = dialerResult.count;

        // CRM-F8 FIX: Phase 2.5 — Delete deals linked to these leads (was missing)
        const dealIds = (await tx.crmDeal.findMany({
          where: { leadId: { in: leadIds } },
          select: { id: true },
        })).map(d => d.id);
        if (dealIds.length > 0) {
          await tx.crmDealStageHistory.deleteMany({ where: { dealId: { in: dealIds } } }).catch(() => {});
          await tx.crmActivity.deleteMany({ where: { dealId: { in: dealIds } } }).catch(() => {});
          await tx.crmTask.deleteMany({ where: { dealId: { in: dealIds } } }).catch(() => {});
          const dealsResult = await tx.crmDeal.deleteMany({ where: { id: { in: dealIds } } });
          (deleted as Record<string, number>).deals = dealsResult.count;
        }

        // Phase 3: Delete leads themselves (after all FK children are gone)
        const leadsResult = await tx.crmLead.deleteMany({
          where: { id: { in: leadIds } },
        });
        deleted.leads = leadsResult.count;
      }

      // Delete contact-info-based records in parallel
      const contactDeletePromises: Promise<void>[] = [];

      if (contactEmail || contactPhone) {
        const consentWhere = [];
        if (contactEmail) consentWhere.push({ email: contactEmail });
        if (contactPhone) consentWhere.push({ phone: contactPhone });

        contactDeletePromises.push(
          tx.crmConsentRecord.deleteMany({
            where: { OR: consentWhere },
          }).then((r) => { deleted.consentRecords = r.count; })
        );

        const prospectWhere = [];
        if (contactEmail) prospectWhere.push({ email: contactEmail });
        if (contactPhone) prospectWhere.push({ phone: contactPhone });

        contactDeletePromises.push(
          tx.prospect.deleteMany({
            where: { OR: prospectWhere },
          }).then((r) => { deleted.prospects = r.count; })
        );
      }

      if (contactPhone) {
        contactDeletePromises.push(
          tx.callLog.deleteMany({
            where: {
              OR: [
                { callerNumber: contactPhone },
                { calledNumber: contactPhone },
              ],
            },
          }).then((r) => { deleted.callLogs = r.count; })
        );
      }

      if (contactDeletePromises.length > 0) {
        await Promise.all(contactDeletePromises);
      }
    });

    const totalDeleted = Object.values(deleted).reduce((sum, n) => sum + n, 0);

    logger.info('[gdpr-delete] GDPR deletion completed', {
      event: 'gdpr_deletion_completed',
      requestedBy: session.user.id,
      reason,
      totalDeleted,
      deleted,
    });

    return apiSuccess({ deleted, totalDeleted }, { request });
  }, { requiredPermission: 'crm.compliance.manage' });
