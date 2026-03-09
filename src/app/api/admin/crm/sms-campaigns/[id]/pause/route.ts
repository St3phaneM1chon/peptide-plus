export const dynamic = 'force-dynamic';

/**
 * CRM SMS Campaign Pause/Resume API
 * PUT /api/admin/crm/sms-campaigns/[id]/pause - Toggle pause/resume on a campaign
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// PUT: Toggle pause/resume
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { id } = params;

  const campaign = await prisma.smsCampaign.findUnique({
    where: { id },
    select: { id: true, status: true, name: true },
  });

  if (!campaign) {
    return apiError('Campaign not found', ErrorCode.RESOURCE_NOT_FOUND, { request });
  }

  // Only SENDING or PAUSED campaigns can be toggled
  if (campaign.status !== 'SENDING' && campaign.status !== 'PAUSED') {
    return apiError(
      `Cannot pause/resume campaign with status ${campaign.status}. Must be SENDING or PAUSED.`,
      ErrorCode.VALIDATION_ERROR,
      { status: 400, request }
    );
  }

  const newStatus = campaign.status === 'SENDING' ? 'PAUSED' : 'SENDING';

  const updated = await prisma.smsCampaign.update({
    where: { id },
    data: { status: newStatus },
    include: {
      template: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return apiSuccess(updated, { request });
}, { requiredPermission: 'crm.campaigns.manage' });
