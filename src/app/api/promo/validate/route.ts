export const dynamic = 'force-dynamic';

/**
 * API Validation Code Promo - BioCycle Peptides
 * Valide les codes promotionnels depuis la base de données
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // BE-SEC-02: Rate limit promo validation - 10 per IP per hour (prevents brute-force enumeration)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/promo/validate');
    if (!rl.success) {
      const res = NextResponse.json(
        { valid: false, error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const { code, subtotal, cartItems } = await request.json() as {
      code: string;
      subtotal: number;
      cartItems?: Array<{ productId: string; quantity: number }>;
    };

    if (!code) {
      return NextResponse.json(
        { valid: false, error: 'Code promo requis' },
        { status: 400 }
      );
    }

    const upperCode = code.toUpperCase().trim();

    // Rechercher le code promo dans la base de données
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: upperCode },
    });

    if (!promoCode || !promoCode.isActive) {
      return NextResponse.json({
        valid: false,
        error: 'Code promo invalide',
      });
    }

    // Vérifier l'expiration
    const now = new Date();
    if (promoCode.startsAt && promoCode.startsAt > now) {
      return NextResponse.json({
        valid: false,
        error: 'Ce code promo n\'est pas encore actif',
      });
    }
    if (promoCode.endsAt && promoCode.endsAt < now) {
      return NextResponse.json({
        valid: false,
        error: 'Ce code promo a expiré',
      });
    }

    // Vérifier la limite d'utilisation globale
    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
      return NextResponse.json({
        valid: false,
        error: 'Ce code promo a atteint sa limite d\'utilisation',
      });
    }

    // PAY-013: Vérifier la limite d'utilisation par utilisateur
    if (promoCode.usageLimitPerUser) {
      const session = await auth();
      if (session?.user?.id) {
        const userUsageCount = await prisma.order.count({
          where: { userId: session.user.id, promoCode: upperCode, status: { not: 'CANCELLED' } },
        });
        if (userUsageCount >= promoCode.usageLimitPerUser) {
          return NextResponse.json({
            valid: false,
            error: 'Vous avez atteint la limite d\'utilisation pour ce code',
          }, { status: 400 });
        }
      }
    }

    // E-04: Vérifier firstOrderOnly - le code est réservé aux premières commandes
    if (promoCode.firstOrderOnly) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({
          valid: false,
          error: 'Vous devez être connecté pour utiliser ce code promo',
        });
      }
      const previousPaidOrders = await prisma.order.count({
        where: { userId: session.user.id, paymentStatus: 'PAID' },
      });
      if (previousPaidOrders > 0) {
        return NextResponse.json({
          valid: false,
          error: 'Ce code promo est réservé aux premières commandes',
        });
      }
    }

    // E-04: Vérifier productIds - le code ne s'applique qu'à certains produits
    if (promoCode.productIds) {
      if (!cartItems || cartItems.length === 0) {
        // TODO: If cart items are not provided in the validate request,
        // we skip this check here. The create-checkout route performs a
        // server-side re-validation with the actual cart, so this is safe.
      } else {
        const allowedProductIds: string[] = JSON.parse(promoCode.productIds);
        const cartProductIds = cartItems.map((item) => item.productId);
        const hasMatchingProduct = cartProductIds.some((pid) =>
          allowedProductIds.includes(pid)
        );
        if (!hasMatchingProduct) {
          return NextResponse.json({
            valid: false,
            error: 'Ce code promo ne s\'applique pas aux produits de votre panier',
          });
        }
      }
    }

    // E-04: Vérifier categoryIds - le code ne s'applique qu'à certaines catégories
    if (promoCode.categoryIds) {
      if (!cartItems || cartItems.length === 0) {
        // TODO: Same as productIds - skip if cart items not provided;
        // create-checkout will enforce this server-side.
      } else {
        const allowedCategoryIds: string[] = JSON.parse(promoCode.categoryIds);
        const cartProductIds = cartItems.map((item) => item.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: cartProductIds } },
          select: { id: true, categoryId: true },
        });
        const cartCategoryIds = products.map((p) => p.categoryId);
        const hasMatchingCategory = cartCategoryIds.some((cid) =>
          allowedCategoryIds.includes(cid)
        );
        if (!hasMatchingCategory) {
          return NextResponse.json({
            valid: false,
            error: 'Ce code promo ne s\'applique pas aux catégories de votre panier',
          });
        }
      }
    }

    // Vérifier le montant minimum
    const minOrder = promoCode.minOrderAmount ? Number(promoCode.minOrderAmount) : 0;
    if (minOrder > 0 && subtotal < minOrder) {
      return NextResponse.json({
        valid: false,
        error: `Commande minimum de $${minOrder} requise pour ce code`,
        minOrder,
      });
    }

    // Calculer la réduction
    const value = Number(promoCode.value);
    let discount = 0;
    if (promoCode.type === 'PERCENTAGE') {
      discount = (subtotal * value) / 100;
      // Appliquer le plafond de réduction si défini
      if (promoCode.maxDiscount) {
        discount = Math.min(discount, Number(promoCode.maxDiscount));
      }
    } else {
      discount = value;
    }

    // Ne pas dépasser le sous-total
    discount = Math.min(discount, subtotal);

    return NextResponse.json({
      valid: true,
      code: upperCode,
      type: promoCode.type === 'PERCENTAGE' ? 'percentage' : 'fixed',
      value,
      discount: Math.round(discount * 100) / 100,
      description: promoCode.description || '',
    });

  } catch (error) {
    console.error('Promo validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Erreur de validation' },
      { status: 500 }
    );
  }
}
