export const dynamic = 'force-dynamic';

/**
 * H1: CustomerMetrics Calculation Cron Job
 * Calculates RFM scores, CLV, and churn risk for all customers.
 * Run via cron (e.g., daily at 3 AM).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const provided = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

export async function GET(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all customers with their order history
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true,
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: {
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const now = new Date();

    // Compute metrics for all customers, then batch upsert in a single transaction
    const upsertOperations: Array<ReturnType<typeof prisma.customerMetrics.upsert>> = [];

    for (const customer of customers) {
      const orders = customer.orders;
      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, o) => sum + Number(o.total), 0);
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

      const firstOrder = orders.length > 0 ? orders[orders.length - 1].createdAt : null;
      const lastOrder = orders.length > 0 ? orders[0].createdAt : null;
      const lastOrderDays = lastOrder
        ? Math.floor((now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Calculate order frequency (orders per month)
      const monthsSinceFirst = firstOrder
        ? Math.max(1, (now.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 1;
      const orderFrequency = totalOrders / monthsSinceFirst;

      // RFM Scoring (1-5 scale)
      const recencyScore = lastOrderDays <= 30 ? 5 : lastOrderDays <= 60 ? 4 : lastOrderDays <= 90 ? 3 : lastOrderDays <= 180 ? 2 : 1;
      const frequencyScore = orderFrequency >= 2 ? 5 : orderFrequency >= 1 ? 4 : orderFrequency >= 0.5 ? 3 : orderFrequency >= 0.25 ? 2 : 1;
      const monetaryScore = totalSpent >= 1000 ? 5 : totalSpent >= 500 ? 4 : totalSpent >= 200 ? 3 : totalSpent >= 50 ? 2 : 1;

      // RFM Segment
      const rfmAvg = (recencyScore + frequencyScore + monetaryScore) / 3;
      let rfmSegment = 'NEW_CUSTOMERS';
      if (totalOrders === 0) rfmSegment = 'NEW_CUSTOMERS';
      else if (rfmAvg >= 4.5) rfmSegment = 'CHAMPIONS';
      else if (rfmAvg >= 4) rfmSegment = 'LOYAL';
      else if (rfmAvg >= 3.5) rfmSegment = 'POTENTIAL_LOYAL';
      else if (recencyScore >= 4 && frequencyScore <= 2) rfmSegment = 'PROMISING';
      else if (rfmAvg >= 2.5 && recencyScore <= 2) rfmSegment = 'NEED_ATTENTION';
      else if (recencyScore <= 2 && frequencyScore <= 2) rfmSegment = 'ABOUT_TO_SLEEP';
      else if (recencyScore === 1 && monetaryScore >= 4) rfmSegment = 'CANT_LOSE';
      else if (recencyScore === 1 && frequencyScore >= 3) rfmSegment = 'AT_RISK';
      else if (recencyScore === 1) rfmSegment = lastOrderDays > 365 ? 'LOST' : 'HIBERNATING';

      // Simple CLV prediction (avgOrderValue * projected orders over 12 months)
      const predictedCLV = avgOrderValue * orderFrequency * 12;

      // Churn score (0-1, higher = more likely to churn)
      const churnScore = Math.min(1, Math.max(0,
        (lastOrderDays > 90 ? 0.4 : 0) +
        (orderFrequency < 0.25 ? 0.3 : 0) +
        (totalOrders <= 1 ? 0.2 : 0) +
        (lastOrderDays > 180 ? 0.1 : 0)
      ));

      const metricsData = {
        totalOrders,
        totalSpent,
        avgOrderValue,
        orderFrequency,
        lastOrderDays,
        firstOrderAt: firstOrder,
        lastOrderAt: lastOrder,
        recencyScore,
        frequencyScore,
        monetaryScore,
        rfmSegment,
        predictedCLV,
        churnScore,
        calculatedAt: now,
      };

      upsertOperations.push(
        prisma.customerMetrics.upsert({
          where: { userId: customer.id },
          create: { userId: customer.id, ...metricsData },
          update: metricsData,
        })
      );
    }

    // Execute all upserts in a single transaction instead of N sequential queries
    const BATCH_SIZE = 50;
    let processed = 0;
    for (let i = 0; i < upsertOperations.length; i += BATCH_SIZE) {
      const batch = upsertOperations.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(batch);
      processed += batch.length;
    }

    logger.info('[CustomerMetrics] Cron completed', { processed });
    return NextResponse.json({ processed, calculatedAt: now.toISOString() });
  } catch (error) {
    logger.error('[CustomerMetrics] Cron error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Metrics calculation failed' }, { status: 500 });
  }
}
