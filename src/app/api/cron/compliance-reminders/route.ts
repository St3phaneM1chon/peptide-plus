export const dynamic = 'force-dynamic';

/**
 * CRON: Compliance Deadline Reminders
 * Runs daily — sends reminders at 7 days, 3 days, and 0 days before deadline.
 * Trigger: Railway cron or external scheduler (e.g., cron-job.org)
 * Auth: CRON_SECRET header
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { buildComplianceReminderEmail } from '@/lib/email/templates/lms-emails';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Verify cron secret — reject if CRON_SECRET is unset OR header doesn't match
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const reminders = [
    { daysOut: 7, label: '7-day' },
    { daysOut: 3, label: '3-day' },
    { daysOut: 0, label: 'today' },
  ];

  let sent = 0;
  let errors = 0;

  for (const { daysOut, label } of reminders) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysOut);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    // Find CePeriods ending on this date with incomplete UFC
    // NOTE: Intentionally no tenantId filter — this cron processes ALL tenants' periods in one sweep.
    const periods = await prisma.cePeriod.findMany({
      where: {
        endDate: { gte: startOfDay, lt: endOfDay },
        status: { in: ['ACTIVE', 'GRACE_PERIOD'] },
      },
      include: {
        license: {
          include: {
            regulatoryBody: { select: { name: true, requiredUfc: true } },
          },
        },
      },
    });

    for (const period of periods) {
      if (Number(period.earnedUfc) >= Number(period.requiredUfc)) continue; // Already met

      // V2 P0 FIX: Deduplication — check if reminder already sent today for this period + type
      const dedupKey = `compliance_reminder_${label}`;
      const alreadySent = await prisma.lmsNotification.findFirst({
        where: {
          tenantId: period.tenantId,
          userId: period.userId,
          type: dedupKey,
          createdAt: { gte: startOfDay },
        },
        select: { id: true },
      });
      if (alreadySent) continue; // Already sent this reminder today

      // Get user email
      const user = await prisma.user.findUnique({
        where: { id: period.userId },
        select: { email: true, name: true },
      });
      if (!user?.email) continue;

      // V2 P2 FIX: Count compliance courses NOT YET completed (was counting by deadline date)
      const remainingEnrollments = await prisma.enrollment.count({
        where: {
          tenantId: period.tenantId,
          userId: period.userId,
          status: 'ACTIVE',
          complianceStatus: { in: ['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE'] },
          course: { isCompliance: true },
        },
      });

      try {
        const email = buildComplianceReminderEmail({
          studentName: user.name ?? 'Etudiant',
          deadlineDate: startOfDay.toLocaleDateString('fr-CA'),
          daysRemaining: daysOut,
          coursesRemaining: remainingEnrollments,
          ufcEarned: Number(period.earnedUfc),
          ufcRequired: Number(period.requiredUfc),
          locale: 'fr',
        });

        await sendEmail({ to: { email: user.email, name: user.name ?? undefined }, subject: email.subject, html: email.html, text: email.text });

        // V2 P0 FIX: Record sent reminder for deduplication
        await prisma.lmsNotification.create({
          data: {
            tenantId: period.tenantId,
            userId: period.userId,
            type: dedupKey,
            title: `Rappel conformite (${label})`,
            message: `Echeance UFC: ${startOfDay.toLocaleDateString('fr-CA')}`,
          },
        }).catch(() => { /* dedup record failure should not block email flow */ });

        sent++;
        logger.info(`[compliance-reminder] Sent ${label} reminder to ${user.email}`);
      } catch (err) {
        errors++;
        logger.error(`[compliance-reminder] Failed to send to ${user.email}`, { error: err });
      }
    }
  }

  return NextResponse.json({ sent, errors, timestamp: now.toISOString() });
}
