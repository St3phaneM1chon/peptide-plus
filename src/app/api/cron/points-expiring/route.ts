/**
 * CRON Job - Rappel de points qui expirent
 * Envoie un email 30 jours avant l'expiration des points
 * 
 * Configuration Vercel (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/points-expiring",
 *     "schedule": "0 11 * * 1"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, pointsExpiringEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    // Vérifier la clé de sécurité
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Date dans 30 jours
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const thirtyOneDaysFromNow = new Date();
    thirtyOneDaysFromNow.setDate(thirtyOneDaysFromNow.getDate() + 31);

    // Trouver les transactions qui expirent dans environ 30 jours
    const expiringTransactions = await db.loyaltyTransaction.findMany({
      where: {
        type: 'EARN_PURCHASE', // Seuls les points d'achat expirent
        points: { gt: 0 },
        expiresAt: {
          gte: thirtyDaysFromNow,
          lt: thirtyOneDaysFromNow,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            locale: true,
            loyaltyPoints: true,
          },
        },
      },
    });

    // Grouper par utilisateur
    const userPoints: Record<string, {
      user: typeof expiringTransactions[0]['user'];
      expiringPoints: number;
      expiryDate: Date;
    }> = {};

    for (const tx of expiringTransactions) {
      if (!userPoints[tx.userId]) {
        userPoints[tx.userId] = {
          user: tx.user,
          expiringPoints: 0,
          expiryDate: tx.expiresAt || thirtyDaysFromNow,
        };
      }
      userPoints[tx.userId].expiringPoints += tx.points;
    }

    console.log(`⏰ Found ${Object.keys(userPoints).length} users with points expiring in ~30 days`);

    const results = [];

    for (const [userId, data] of Object.entries(userPoints)) {
      try {
        const emailContent = pointsExpiringEmail({
          customerName: data.user.name || 'Client',
          customerEmail: data.user.email,
          expiringPoints: data.expiringPoints,
          currentPoints: data.user.loyaltyPoints,
          expiryDate: data.expiryDate,
          locale: (data.user.locale as 'fr' | 'en') || 'fr',
        });

        const result = await sendEmail({
          to: { email: data.user.email, name: data.user.name || undefined },
          subject: emailContent.subject,
          html: emailContent.html,
          tags: ['points-expiring', 'automated'],
        });

        results.push({
          userId,
          email: data.user.email,
          expiringPoints: data.expiringPoints,
          success: result.success,
          messageId: result.messageId,
        });

        console.log(`⏰ Points expiring email sent to ${data.user.email} (${data.expiringPoints} points)`);

      } catch (error) {
        console.error(`Failed to send points expiring email to ${data.user.email}:`, error);
        results.push({
          userId,
          email: data.user.email,
          success: false,
          error: 'Failed to process points expiring email',
        });
      }
    }

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
      processed: Object.keys(userPoints).length,
      results,
    });

  } catch (error) {
    console.error('Points expiring cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export { GET as POST };
