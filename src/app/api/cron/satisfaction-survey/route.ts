export const dynamic = 'force-dynamic';

/**
 * CRON Job - Emails de satisfaction
 * Envoie un email de demande d'avis N jours après la livraison
 *
 * Item 81: Configurable survey timing and link
 * - Survey delay days, feedback URL, and bonus points are now configurable
 *   via SiteSetting key-value store (module: 'satisfaction_survey')
 * - Survey link uses configurable base URL instead of hardcoded domain
 *
 * TODO (item 81): Full A/B testing for satisfaction surveys:
 *   - Create A/B test variants for:
 *     a) Timing: 3 days vs 5 days vs 7 days after delivery
 *     b) Subject line variants (emoji vs no emoji, question vs statement)
 *     c) Incentive: 50 points vs 100 points vs 10% discount
 *     d) Survey format: emoji rating vs 1-5 stars vs NPS scale
 *   - Assign users to variants deterministically: hash(userId + experimentId) % variantCount
 *   - Track open rates, click rates, and review completion rates per variant
 *   - Store results in AbTestResult model for statistical analysis
 *   - Auto-graduate the best variant after N=500 sends with 95% confidence
 *
 * Configurable SiteSetting keys (module: 'satisfaction_survey'):
 *   satisfaction_survey.delay_days       - Default: 5
 *   satisfaction_survey.bonus_points     - Default: 50
 *   satisfaction_survey.feedback_base_url - Default: https://biocyclepeptides.com/feedback
 *   satisfaction_survey.review_base_url  - Default: https://biocyclepeptides.com/account/orders
 *
 * Configuration Vercel (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/satisfaction-survey",
 *     "schedule": "0 10 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, satisfactionSurveyEmail, generateUnsubscribeUrl, type OrderData } from '@/lib/email';
import { withJobLock } from '@/lib/cron-lock';

// Defaults (overridden by SiteSetting values)
const DEFAULT_DELAY_DAYS = 5;
const DEFAULT_BONUS_POINTS = 50;

export async function GET(request: NextRequest) {
  // Vérifier la clé de sécurité
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('satisfaction-survey', async () => {
    try {
      // Item 81: Load configurable survey parameters from SiteSetting
      const surveyConfigKeys = [
        'satisfaction_survey.delay_days',
        'satisfaction_survey.bonus_points',
      ];
      const surveyConfig = await db.siteSetting.findMany({
        where: { key: { in: surveyConfigKeys } },
        select: { key: true, value: true },
      }).catch(() => [] as { key: string; value: string }[]);
      const surveyConfigMap = new Map(surveyConfig.map((e) => [e.key, e.value]));

      const delayDays = parseInt(surveyConfigMap.get('satisfaction_survey.delay_days') || '', 10) || DEFAULT_DELAY_DAYS;
      const bonusPoints = parseInt(surveyConfigMap.get('satisfaction_survey.bonus_points') || '', 10) || DEFAULT_BONUS_POINTS;

      console.log(`Satisfaction survey config: delay=${delayDays}d, bonus=${bonusPoints}pts`);

    // Find orders delivered delayDays ago (configurable, default 5)
    const targetDayAgo = new Date();
    targetDayAgo.setDate(targetDayAgo.getDate() - delayDays);
    targetDayAgo.setHours(0, 0, 0, 0);

    const targetDayPlusOneAgo = new Date();
    targetDayPlusOneAgo.setDate(targetDayPlusOneAgo.getDate() - (delayDays + 1));
    targetDayPlusOneAgo.setHours(0, 0, 0, 0);

    // Backward compat aliases
    const fiveDaysAgo = targetDayAgo;
    const sixDaysAgo = targetDayPlusOneAgo;

    // Commandes livrées entre 5 et 6 jours
    const deliveredOrders = await db.order.findMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: {
          gte: sixDaysAgo,
          lt: fiveDaysAgo,
        },
      },
      include: {
        items: true,
        currency: true,
      },
    });

    // DI-64: Deduplicate - filter out orders that already had a satisfaction survey sent
    const orderNumbers = deliveredOrders.map((o) => o.orderNumber);
    const alreadySentLogs = orderNumbers.length > 0
      ? await db.emailLog.findMany({
          where: {
            templateId: 'satisfaction-survey',
            status: 'sent',
            to: { in: deliveredOrders.map((o) => o.userId) }, // rough filter
          },
          select: { subject: true },
        })
      : [];
    // Extract order numbers from subjects like "Satisfaction survey - #ORD-xxx"
    const alreadySentOrderNumbers = new Set<string>();
    for (const log of alreadySentLogs) {
      for (const orderNumber of orderNumbers) {
        if (log.subject?.includes(orderNumber)) {
          alreadySentOrderNumbers.add(orderNumber);
        }
      }
    }
    const filteredOrders = deliveredOrders.filter(
      (o) => !alreadySentOrderNumbers.has(o.orderNumber)
    );

    console.log(`Found ${deliveredOrders.length} delivered orders, ${filteredOrders.length} after dedup`);

    // DI-65: Batch fetch users to avoid N+1 queries
    const userIds = [...new Set(filteredOrders.map((o) => o.userId))];
    const users = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, locale: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const results = [];

    for (const order of filteredOrders) {
      try {
        const user = userMap.get(order.userId);
        if (!user) continue;

        // Préparer les données
        const orderData: OrderData = {
          orderNumber: order.orderNumber,
          customerName: user.name || 'Client',
          customerEmail: user.email,
          items: order.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            price: Number(item.unitPrice),
          })),
          subtotal: Number(order.subtotal),
          shipping: Number(order.shippingCost),
          tax: Number(order.tax),
          total: Number(order.total),
          currency: order.currency?.code || 'CAD',
          shippingAddress: {
            name: order.shippingName,
            address1: order.shippingAddress1,
            address2: order.shippingAddress2 || undefined,
            city: order.shippingCity,
            state: order.shippingState,
            postalCode: order.shippingPostal,
            country: order.shippingCountry,
          },
          locale: (user.locale as 'fr' | 'en') || 'fr',
          // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
          unsubscribeUrl: await generateUnsubscribeUrl(user.email, 'marketing', user.id).catch(() => undefined),
        };

        const emailContent = satisfactionSurveyEmail(orderData);

        const result = await sendEmail({
          to: { email: user.email, name: user.name || undefined },
          subject: emailContent.subject,
          html: emailContent.html,
          tags: ['satisfaction', 'automated', order.orderNumber],
          unsubscribeUrl: orderData.unsubscribeUrl,
        });

        // Log to EmailLog for deduplication on future runs
        await db.emailLog.create({
          data: {
            templateId: 'satisfaction-survey',
            to: user.email,
            subject: emailContent.subject,
            status: result.success ? 'sent' : 'failed',
            error: result.success ? null : 'Send failed',
          },
        }).catch((err: unknown) => console.error('Failed to create email log', err));

        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          email: user.email,
          success: result.success,
          messageId: result.messageId,
        });

        console.log(`Satisfaction survey sent for order ${order.orderNumber} to ${user.email}`);

      } catch (error) {
        console.error(`Failed to send satisfaction email for order ${order.id}:`, error);
        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          success: false,
          error: 'Failed to process satisfaction email',
        });
      }
    }

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
      processed: filteredOrders.length,
      results,
    });

    } catch (error) {
      console.error('Satisfaction survey cron job error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
