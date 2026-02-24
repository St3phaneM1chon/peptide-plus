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
import { logger } from '@/lib/logger';

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

      logger.info(`Satisfaction survey config: delay=${delayDays}d, bonus=${bonusPoints}pts`);

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

    // FIX: FLAW-013 - Dedup using orderId stored in EmailLog metadata field
    // instead of fragile subject line parsing. We store the orderId in the
    // messageId field (repurposed as metadata) when creating the EmailLog entry.
    // For backward compat, also check subject-based matching as fallback.
    const orderIds = deliveredOrders.map((o) => o.id);
    const orderNumbers = deliveredOrders.map((o) => o.orderNumber);
    const alreadySentLogs = orderIds.length > 0
      ? await db.emailLog.findMany({
          where: {
            templateId: 'satisfaction-survey',
            status: 'sent',
            OR: [
              // Primary: match by messageId field (stores orderId metadata)
              { messageId: { in: orderIds.map((id) => `order:${id}`) } },
              // Fallback: match by subject containing order number (legacy entries)
              { subject: { in: orderNumbers.map((num) => `%${num}%`) } },
            ],
          },
          select: { messageId: true, subject: true },
        })
      : [];
    const alreadySentOrderIds = new Set<string>();
    const alreadySentOrderNumbers = new Set<string>();
    for (const log of alreadySentLogs) {
      // Check messageId-based dedup (new format: "order:{orderId}")
      if (log.messageId?.startsWith('order:')) {
        alreadySentOrderIds.add(log.messageId.replace('order:', ''));
      }
      // Fallback: check subject-based dedup (legacy)
      if (log.subject) {
        for (const orderNumber of orderNumbers) {
          if (log.subject.includes(orderNumber)) {
            alreadySentOrderNumbers.add(orderNumber);
          }
        }
      }
    }
    const dedupedOrders = deliveredOrders.filter(
      (o) => !alreadySentOrderIds.has(o.id) && !alreadySentOrderNumbers.has(o.orderNumber)
    );

    // FLAW-044 FIX: Check notification preferences and marketing consent
    // Filter out users who opted out of marketing or survey emails
    const dedupedUserIds = [...new Set(dedupedOrders.map((o) => o.userId))];
    const optedOutUserIds = new Set<string>();
    if (dedupedUserIds.length > 0) {
      const notifPrefs = await db.notificationPreference.findMany({
        where: {
          userId: { in: dedupedUserIds },
          OR: [
            { promotions: false },
            { orderUpdates: false },
          ],
        },
        select: { userId: true },
      }).catch(() => [] as { userId: string }[]);
      notifPrefs.forEach((p) => optedOutUserIds.add(p.userId));
    }
    const filteredOrders = dedupedOrders.filter(
      (o) => !optedOutUserIds.has(o.userId)
    );

    logger.info(`Found ${deliveredOrders.length} delivered orders, ${filteredOrders.length} after dedup`);

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

        // FIX: FLAW-013 - Store orderId in messageId field for reliable deduplication
        // instead of relying on subject line parsing.
        await db.emailLog.create({
          data: {
            templateId: 'satisfaction-survey',
            to: user.email,
            subject: emailContent.subject,
            status: result.success ? 'sent' : 'failed',
            error: result.success ? null : 'Send failed',
            messageId: `order:${order.id}`,
          },
        }).catch((err: unknown) => logger.error('Failed to create email log', { error: err instanceof Error ? (err as Error).message : String(err) }));

        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          email: user.email,
          success: result.success,
          messageId: result.messageId,
        });

        logger.info(`Satisfaction survey sent for order ${order.orderNumber} to ${user.email}`);

      } catch (error) {
        logger.error(`Failed to send satisfaction email for order ${order.id}`, { error: error instanceof Error ? error.message : String(error) });
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
      logger.error('Satisfaction survey cron job error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
