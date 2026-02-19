export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/webhooks/replay/[id]
 * Replay a specific webhook delivery by its ID.
 * Admin-only endpoint (EMPLOYEE or OWNER).
 *
 * Safeguards:
 *   - Verifies the delivery record exists
 *   - Verifies the target endpoint is still active
 *   - Records the replay result as a new attempt
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { replayDelivery } from '@/lib/webhooks/outgoing';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (_request, { session, params }) => {
  const deliveryId = params?.id;

  if (!deliveryId) {
    return NextResponse.json(
      { error: 'Delivery ID is required' },
      { status: 400 }
    );
  }

  // Safeguard: verify the delivery exists
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      endpoint: { select: { id: true, url: true, name: true, active: true } },
    },
  });

  if (!delivery) {
    return NextResponse.json(
      { error: `Delivery ${deliveryId} not found` },
      { status: 404 }
    );
  }

  if (!delivery.endpoint.active) {
    return NextResponse.json(
      { error: `Endpoint ${delivery.endpoint.id} is inactive. Activate it before replaying.` },
      { status: 409 }
    );
  }

  try {
    logger.info('[admin/webhooks/replay] Replaying delivery', {
      deliveryId,
      event: delivery.event,
      endpointUrl: delivery.endpoint.url,
      userId: session.user?.id,
    });

    const result = await replayDelivery(deliveryId);

    return NextResponse.json({
      success: result.success,
      deliveryId: result.deliveryId,
      status: result.status,
      durationMs: result.duration,
      endpoint: {
        id: delivery.endpoint.id,
        url: delivery.endpoint.url,
        name: delivery.endpoint.name,
      },
    });
  } catch (error) {
    logger.error('[admin/webhooks/replay] Replay failed', {
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Replay failed' },
      { status: 500 }
    );
  }
});
