export const dynamic = 'force-dynamic';

/**
 * API pour envoyer des emails marketing
 * POST /api/emails/send-marketing-email
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import {
  sendEmail,
  birthdayEmail,
  welcomeEmail,
  abandonedCartEmail,
  backInStockEmail,
  pointsExpiringEmail,
  generateUnsubscribeUrl,
} from '@/lib/email';

const marketingEmailSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  emailType: z.enum(['birthday', 'welcome', 'abandoned-cart', 'back-in-stock', 'points-expiring'], {
    errorMap: () => ({ message: 'Invalid emailType' }),
  }),
  data: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/emails/send-marketing-email');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Vérifier l'authentification
    const session = await auth();
    const apiKey = request.headers.get('x-api-key');

    const isAdmin = session?.user?.role === 'OWNER' || session?.user?.role === 'EMPLOYEE';
    const isValidApiKey = apiKey === process.env.INTERNAL_API_KEY;

    if (!isAdmin && !isValidApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = marketingEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { userId, emailType, data } = parsed.data;

    // Récupérer l'utilisateur
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        name: true, 
        email: true, 
        locale: true,
        loyaltyPoints: true,
        referralCode: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let emailContent: { subject: string; html: string };

    // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
    const unsubscribeUrl = await generateUnsubscribeUrl(user.email, 'marketing', user.id).catch(() => undefined);

    switch (emailType) {
      case 'birthday': {
        // Générer un code promo pour l'anniversaire
        const discountCode = `BDAY${user.id.slice(0, 4).toUpperCase()}${new Date().getFullYear()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // Valide 30 jours

        emailContent = birthdayEmail({
          customerName: user.name || 'Client',
          customerEmail: user.email,
          discountCode,
          discountValue: 15, // 15% de rabais
          discountType: 'percentage',
          bonusPoints: 200, // 200 points bonus
          expiresAt,
          locale: (user.locale as 'fr' | 'en') || 'fr',
          unsubscribeUrl,
        });

        // Ajouter les points bonus au compte
        try {
          await db.$transaction([
            db.user.update({
              where: { id: user.id },
              data: { loyaltyPoints: { increment: 200 } },
            }),
            db.loyaltyTransaction.create({
              data: {
                userId: user.id,
                type: 'EARN_BIRTHDAY',
                points: 200,
                description: 'Birthday bonus points',
                balanceAfter: user.loyaltyPoints + 200,
              },
            }),
          ]);
        } catch (e) {
          logger.info('Failed to add birthday points', { error: e instanceof Error ? e.message : String(e) });
        }
        break;
      }

      case 'welcome': {
        // Générer un code de parrainage si nécessaire
        let referralCode = user.referralCode;
        if (!referralCode) {
          referralCode = `${user.name?.split(' ')[0]?.toUpperCase().slice(0, 3) || 'BC'}${crypto.randomUUID().replace(/-/g, '').substring(0, 4).toUpperCase()}`;
          await db.user.update({
            where: { id: user.id },
            data: { referralCode },
          });
        }

        emailContent = welcomeEmail({
          customerName: user.name || 'Client',
          customerEmail: user.email,
          welcomePoints: 500,
          referralCode,
          locale: (user.locale as 'fr' | 'en') || 'fr',
          unsubscribeUrl,
        });
        break;
      }

      case 'abandoned-cart': {
        const items = (data?.items as Array<{ name: string; price: number; quantity: number; imageUrl?: string }>) || [];
        const cartTotal = (data?.cartTotal as number) || 0;

        emailContent = abandonedCartEmail({
          customerName: user.name || 'Client',
          customerEmail: user.email,
          items,
          cartTotal,
          discountCode: 'COMEBACK10',
          discountValue: 10,
          locale: (user.locale as 'fr' | 'en') || 'fr',
          unsubscribeUrl,
        });
        break;
      }

      case 'back-in-stock': {
        const productName = (data?.productName as string) || 'Produit';
        const productPrice = (data?.productPrice as number) || 0;
        const productUrl = (data?.productUrl as string) || 'https://biocyclepeptides.com/shop';

        emailContent = backInStockEmail({
          customerName: user.name || 'Client',
          customerEmail: user.email,
          productName,
          productPrice,
          productUrl,
          productImageUrl: data?.productImageUrl as string,
          locale: (user.locale as 'fr' | 'en') || 'fr',
          unsubscribeUrl,
        });
        break;
      }

      case 'points-expiring': {
        const expiringPoints = (data?.expiringPoints as number) || 0;
        const expiryDate = data?.expiryDate 
          ? new Date(data.expiryDate as string)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        emailContent = pointsExpiringEmail({
          customerName: user.name || 'Client',
          customerEmail: user.email,
          expiringPoints,
          currentPoints: user.loyaltyPoints,
          expiryDate,
          locale: (user.locale as 'fr' | 'en') || 'fr',
          unsubscribeUrl,
        });
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid emailType' }, { status: 400 });
    }

    // Envoyer l'email
    const result = await sendEmail({
      to: { email: user.email, name: user.name || undefined },
      subject: emailContent.subject,
      html: emailContent.html,
      tags: ['marketing', emailType],
      unsubscribeUrl,
    });

    if (!result.success) {
      logger.error('Failed to send marketing email', { error: result.error || 'Unknown error' });
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logger.info(`Marketing email sent: ${emailType} to ${user.email}`);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      emailType,
      recipient: user.email,
    });

  } catch (error) {
    logger.error('Send marketing email error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
