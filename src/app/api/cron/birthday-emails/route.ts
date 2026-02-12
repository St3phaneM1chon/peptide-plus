/**
 * CRON Job - Emails d'anniversaire
 * À appeler quotidiennement via Vercel Cron ou similaire
 * 
 * Configuration Vercel (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/birthday-emails",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, birthdayEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    // Vérifier la clé de sécurité pour les cron jobs
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // SECURITY: Fail-closed -- deny access if CRON_SECRET is not configured
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();

    // Trouver les utilisateurs dont c'est l'anniversaire aujourd'hui
    // et qui n'ont pas reçu d'email cette année
    const usersWithBirthday = await db.user.findMany({
      where: {
        birthDate: { not: null },
        OR: [
          { lastBirthdayEmail: null },
          { 
            lastBirthdayEmail: { 
              lt: new Date(today.getFullYear(), 0, 1) // Avant le 1er janvier de cette année
            } 
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        locale: true,
        birthDate: true,
        loyaltyPoints: true,
      },
    });

    // Filtrer pour ne garder que ceux dont c'est l'anniversaire aujourd'hui
    const birthdayUsers = usersWithBirthday.filter(user => {
      if (!user.birthDate) return false;
      const birthMonth = user.birthDate.getMonth() + 1;
      const birthDay = user.birthDate.getDate();
      return birthMonth === currentMonth && birthDay === currentDay;
    });

    console.log(`🎂 Found ${birthdayUsers.length} users with birthday today (${currentMonth}/${currentDay})`);

    const results = [];

    for (const user of birthdayUsers) {
      try {
        // Générer un code promo unique
        const discountCode = `BDAY${user.id.slice(0, 4).toUpperCase()}${today.getFullYear()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Créer le code promo dans la base
        try {
          await db.promoCode.create({
            data: {
              code: discountCode,
              description: `Birthday discount for ${user.name || user.email}`,
              type: 'PERCENTAGE',
              value: 15,
              usageLimit: 1,
              usageLimitPerUser: 1,
              isActive: true,
              endsAt: expiresAt,
            },
          });
        } catch (e) {
          console.log('PromoCode creation skipped:', e);
        }

        // Ajouter les points bonus
        const bonusPoints = 200;
        await db.$transaction([
          db.user.update({
            where: { id: user.id },
            data: { 
              loyaltyPoints: { increment: bonusPoints },
              lifetimePoints: { increment: bonusPoints },
              lastBirthdayEmail: new Date(),
            },
          }),
          db.loyaltyTransaction.create({
            data: {
              userId: user.id,
              type: 'EARN_BIRTHDAY',
              points: bonusPoints,
              description: `Happy Birthday! 🎂`,
              balanceAfter: user.loyaltyPoints + bonusPoints,
            },
          }),
        ]);

        // Générer et envoyer l'email
        const emailContent = birthdayEmail({
          customerName: user.name || 'Client',
          customerEmail: user.email,
          discountCode,
          discountValue: 15,
          discountType: 'percentage',
          bonusPoints,
          expiresAt,
          locale: (user.locale as 'fr' | 'en') || 'fr',
        });

        const result = await sendEmail({
          to: { email: user.email, name: user.name || undefined },
          subject: emailContent.subject,
          html: emailContent.html,
          tags: ['birthday', 'automated'],
        });

        results.push({
          userId: user.id,
          email: user.email,
          success: result.success,
          messageId: result.messageId,
        });

        console.log(`🎂 Birthday email sent to ${user.email}`);

      } catch (error) {
        console.error(`Failed to send birthday email to ${user.email}:`, error);
        results.push({
          userId: user.id,
          email: user.email,
          success: false,
          error: 'Failed to process birthday email',
        });
      }
    }

    return NextResponse.json({
      success: true,
      date: today.toISOString(),
      processed: birthdayUsers.length,
      results,
    });

  } catch (error) {
    console.error('Birthday cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Autoriser aussi POST pour les tests manuels
export { GET as POST };
