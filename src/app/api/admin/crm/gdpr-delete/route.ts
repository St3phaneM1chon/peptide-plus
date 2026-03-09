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
        details: parsed.error.flatten(),
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

    // Create audit log entry before deletion
    logger.info('[gdpr-delete] GDPR deletion initiated', {
      event: 'gdpr_deletion_initiated',
      requestedBy: session.user.id,
      reason,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      leadId: leadId || null,
      leadsFound: leadIds.length,
      leadData: leads.map((l) => ({
        id: l.id,
        name: l.contactName,
        email: l.email,
        phone: l.phone,
      })),
    });

    if (leadIds.length > 0) {
      // Delete campaign activities
      const campaignResult = await prisma.crmCampaignActivity.deleteMany({
        where: { leadId: { in: leadIds } },
      });
      deleted.campaignActivities = campaignResult.count;

      // Delete activities
      const activitiesResult = await prisma.crmActivity.deleteMany({
        where: { leadId: { in: leadIds } },
      });
      deleted.activities = activitiesResult.count;

      // Delete tasks
      const tasksResult = await prisma.crmTask.deleteMany({
        where: { leadId: { in: leadIds } },
      });
      deleted.activities += tasksResult.count;

      // Delete inbox conversations and messages
      const conversations = await prisma.inboxConversation.findMany({
        where: { leadId: { in: leadIds } },
        select: { id: true },
      });

      if (conversations.length > 0) {
        const convIds = conversations.map((c) => c.id);
        const messagesResult = await prisma.inboxMessage.deleteMany({
          where: { conversationId: { in: convIds } },
        });
        deleted.messages = messagesResult.count;

        const convsResult = await prisma.inboxConversation.deleteMany({
          where: { id: { in: convIds } },
        });
        deleted.conversations = convsResult.count;
      }

      // Delete leads themselves
      const leadsResult = await prisma.crmLead.deleteMany({
        where: { id: { in: leadIds } },
      });
      deleted.leads = leadsResult.count;
    }

    // Delete consent records by email/phone
    if (contactEmail || contactPhone) {
      const consentWhere = [];
      if (contactEmail) consentWhere.push({ email: contactEmail });
      if (contactPhone) consentWhere.push({ phone: contactPhone });

      const consentResult = await prisma.crmConsentRecord.deleteMany({
        where: { OR: consentWhere },
      });
      deleted.consentRecords = consentResult.count;
    }

    // Delete call logs by phone number
    if (contactPhone) {
      const callResult = await prisma.callLog.deleteMany({
        where: {
          OR: [
            { callerNumber: contactPhone },
            { calledNumber: contactPhone },
          ],
        },
      });
      deleted.callLogs = callResult.count;
    }

    // Delete Prospect records (GDPR Art. 17 — personal data in scraper results)
    if (contactEmail || contactPhone) {
      const prospectWhere = [];
      if (contactEmail) prospectWhere.push({ email: contactEmail });
      if (contactPhone) prospectWhere.push({ phone: contactPhone });

      const prospectResult = await prisma.prospect.deleteMany({
        where: { OR: prospectWhere },
      });
      deleted.prospects = prospectResult.count;
    }

    // Delete DialerListEntry records linked to deleted leads
    if (leadIds.length > 0) {
      const dialerResult = await prisma.dialerListEntry.deleteMany({
        where: { leadId: { in: leadIds } },
      });
      deleted.dialerEntries = dialerResult.count;
    }

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
