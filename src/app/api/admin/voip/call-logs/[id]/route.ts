export const dynamic = 'force-dynamic';

/**
 * Call Log Detail API
 * GET /api/admin/voip/call-logs/[id]
 *
 * Returns single call with full details + cross-module bridges:
 *   - Bridge #8:  Telephony → CRM (deals of the caller/client)
 *   - Bridge #13: Telephony → Commerce (recent orders of the client)
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { getModuleFlags } from '@/lib/module-flags';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const call = await prisma.callLog.findUnique({
      where: { id },
      include: {
        phoneNumber: { select: { number: true, displayName: true } },
        agent: {
          select: {
            extension: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        client: { select: { id: true, name: true, email: true, phone: true } },
        recording: { select: { id: true, isUploaded: true, durationSec: true, blobUrl: true } },
        survey: true,
        transcription: { select: { id: true, fullText: true, sentiment: true, summary: true } },
      },
    });

    if (!call) {
      return apiError('Call not found', ErrorCode.NOT_FOUND, { request });
    }

    // ── Cross-module bridges ──
    const flags = call.clientId
      ? await getModuleFlags(['crm', 'ecommerce'])
      : { crm: false, ecommerce: false };

    // Bridge #8: Telephony → CRM (deals of the client)
    let crmDeals: Array<{
      id: string; title: string; stageName: string; stageColor: string | null; value: number;
    }> | null = null;

    if (call.clientId && flags.crm) {
      const deals = await prisma.crmDeal.findMany({
        where: { contactId: call.clientId },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          value: true,
          stage: { select: { name: true, color: true } },
        },
      });
      crmDeals = deals.map((d) => ({
        id: d.id,
        title: d.title,
        stageName: d.stage.name,
        stageColor: d.stage.color,
        value: Number(d.value),
      }));
    }

    // Bridge #13: Telephony → Commerce (recent orders of the client)
    let recentOrders: Array<{
      id: string; orderNumber: string; status: string; total: number; createdAt: Date;
    }> | null = null;

    if (call.clientId && flags.ecommerce) {
      const orders = await prisma.order.findMany({
        where: { userId: call.clientId },
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
      });
      recentOrders = orders.map((o) => ({ ...o, total: Number(o.total) }));
    }

    return apiSuccess({ ...call, crmDeals, recentOrders }, { request });
  } catch (error) {
    logger.error('[voip/call-logs/[id]] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch call detail', ErrorCode.INTERNAL_ERROR, { request });
  }
});
