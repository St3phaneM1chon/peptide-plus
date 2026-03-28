export const dynamic = 'force-dynamic';

/**
 * CRON Job — Trial Expiry Reminders & Processing
 *
 * Runs daily. For each trialing tenant:
 *   - 3 days before expiry: send reminder email
 *   - 1 day before expiry: send urgent reminder email
 *   - On expiry (0 days): send expiry email, keep tenant active but flagged
 *
 * POST /api/cron/trial-expiry?secret=CRON_SECRET
 *
 * Each reminder is sent only once, tracked via TenantEvent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/email-service';
import { tenantTrialExpiryEmail } from '@/lib/email/templates/tenant-emails';
import { KORALINE_PLANS, type KoralinePlan } from '@/lib/stripe-attitudes';

// CRON secret verification
function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = request.headers.get('x-cron-secret')
    || request.nextUrl.searchParams.get('secret')
    || '';

  if (provided.length !== secret.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(provided, 'utf-8'),
      Buffer.from(secret, 'utf-8'),
    );
  } catch {
    return false;
  }
}

// Reminder thresholds in days (before expiry)
const REMINDER_THRESHOLDS = [3, 1, 0] as const;

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    processed: 0,
    reminders_sent: 0,
    errors: 0,
    details: [] as Array<{ tenantId: string; slug: string; action: string; daysRemaining: number }>,
  };

  try {
    // Find all tenants currently on trial
    const trialingTenants = await prisma.tenant.findMany({
      where: {
        isTrialing: true,
        trialEndsAt: { not: null },
        // Exclude tenants who already upgraded (have Stripe subscription)
        stripeSubscriptionId: null,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        plan: true,
        trialEndsAt: true,
        ownerUserId: true,
      },
    });

    const now = new Date();

    for (const tenant of trialingTenants) {
      results.processed++;

      if (!tenant.trialEndsAt) continue;

      const endsAt = new Date(tenant.trialEndsAt);
      const msRemaining = endsAt.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

      // Check which reminders should be sent
      for (const threshold of REMINDER_THRESHOLDS) {
        if (daysRemaining > threshold) continue;

        const eventType = `trial_reminder_${threshold}d`;

        // Check if this reminder was already sent
        const alreadySent = await prisma.tenantEvent.findFirst({
          where: {
            tenantId: tenant.id,
            type: eventType,
          },
        });

        if (alreadySent) continue;

        // Get owner email
        let ownerEmail = '';
        let ownerName = tenant.name;
        if (tenant.ownerUserId) {
          const owner = await prisma.user.findUnique({
            where: { id: tenant.ownerUserId },
            select: { email: true, name: true },
          });
          if (owner) {
            ownerEmail = owner.email;
            ownerName = owner.name || tenant.name;
          }
        }

        if (!ownerEmail) {
          logger.warn('Trial expiry: no owner email found', { tenantId: tenant.id, slug: tenant.slug });
          continue;
        }

        // Determine plan details
        const planKey = tenant.plan as KoralinePlan;
        const planConfig = KORALINE_PLANS[planKey] || KORALINE_PLANS.essential;

        // Format the end date
        const endDateFormatted = endsAt.toLocaleDateString('fr-CA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        // Generate and send email
        try {
          const emailContent = tenantTrialExpiryEmail({
            tenantName: tenant.name,
            ownerName,
            daysRemaining: Math.max(0, daysRemaining),
            trialEndsAt: endDateFormatted,
            adminUrl: `https://${tenant.slug}.koraline.app`,
            planName: planConfig.name,
            monthlyPrice: planConfig.monthlyPrice,
          });

          await sendEmail({
            to: { email: ownerEmail, name: ownerName },
            subject: emailContent.subject,
            html: emailContent.html,
            emailType: 'transactional',
          });

          // Record that this reminder was sent
          await prisma.tenantEvent.create({
            data: {
              tenantId: tenant.id,
              type: eventType,
              actor: 'system:cron:trial-expiry',
              details: {
                daysRemaining: Math.max(0, daysRemaining),
                ownerEmail,
                sentAt: now.toISOString(),
              },
            },
          });

          results.reminders_sent++;
          results.details.push({
            tenantId: tenant.id,
            slug: tenant.slug,
            action: `reminder_${threshold}d_sent`,
            daysRemaining: Math.max(0, daysRemaining),
          });

          logger.info('Trial expiry reminder sent', {
            tenantId: tenant.id,
            slug: tenant.slug,
            daysRemaining: Math.max(0, daysRemaining),
            threshold,
            ownerEmail,
          });
        } catch (emailError) {
          results.errors++;
          logger.error('Failed to send trial expiry email', {
            tenantId: tenant.id,
            slug: tenant.slug,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
        }

        // Only send the most urgent applicable reminder per run
        break;
      }
    }

    logger.info('Trial expiry cron completed', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    logger.error('Trial expiry cron failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error', details: results },
      { status: 500 }
    );
  }
}
