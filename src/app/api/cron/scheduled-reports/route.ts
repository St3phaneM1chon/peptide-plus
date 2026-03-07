export const dynamic = 'force-dynamic';

/**
 * Cron: Process scheduled reports
 * Finds reports due to be sent and generates/emails them.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const reports = await prisma.crmScheduledReport.findMany({
      where: {
        isActive: true,
        nextSendAt: { lte: now },
      },
    });

    // Compute next run times for all reports upfront
    const updateOperations: Array<ReturnType<typeof prisma.crmScheduledReport.update>> = [];
    for (const report of reports) {
      const schedule = report.schedule as string; // 'daily' | 'weekly' | 'monthly'

      const nextRun = new Date(now);
      if (schedule === 'daily') nextRun.setDate(nextRun.getDate() + 1);
      else if (schedule === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
      else if (schedule === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setHours(8, 0, 0, 0); // Default 8 AM

      updateOperations.push(
        prisma.crmScheduledReport.update({
          where: { id: report.id },
          data: { lastSentAt: now, nextSendAt: nextRun },
        })
      );

      // TODO: Generate report data and send email to recipients
      // For now, just log it
      logger.info('Scheduled report processed', {
        reportId: report.id,
        name: report.name,
        recipients: report.recipients,
        nextRun: nextRun.toISOString(),
      });
    }

    // Batch all updates in a single transaction instead of N sequential updates
    let processed = 0;
    if (updateOperations.length > 0) {
      try {
        await prisma.$transaction(updateOperations);
        processed = updateOperations.length;
      } catch (err) {
        logger.error('Failed to batch-update scheduled reports', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ success: true, processed, total: reports.length });
  } catch (error) {
    logger.error('Cron scheduled-reports error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
