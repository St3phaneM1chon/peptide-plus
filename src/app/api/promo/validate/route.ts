export const dynamic = 'force-dynamic';

// FIXED: F-065 - errorCode field added alongside French text for client-side i18n (PROMO_INVALID, PROMO_EXPIRED, etc.)
// FIXED: F-092 - auth() called once and reused for both usageLimitPerUser and firstOrderOnly checks (see line ~128)
// FIXED: F-093 - products.map(p => p.categoryId) already filters nulls via .filter((cid): cid is string => cid !== null) at line 216

/**
 * API Validation Code Promo - BioCycle Peptides
 * Valide les codes promotionnels depuis la base de données
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const promoValidateSchema = z.object({
  code: z.string().min(1, 'Code promo requis').max(100),
  subtotal: z.number().min(0),
  cartItems: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1),
  })).optional(),
});

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

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = promoValidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ valid: false, error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { code, subtotal, cartItems } = parsed.data;

    const upperCode = code.toUpperCase().trim();

    // Rechercher le code promo dans la base de données
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: upperCode },
    });

    // FIX: F-033 - Return semantic HTTP status codes (404 not found, 410 expired, 400 limit reached)
    // FLAW-024 FIX: Return i18n error codes alongside French text so frontend can translate
    if (!promoCode) {
      return NextResponse.json({
        valid: false,
        errorCode: 'PROMO_INVALID',
        error: 'Code promo invalide',
      }, { status: 404 });
    }

    // FIX: FLAW-071 - Differentiate between non-existent and deactivated promo codes
    if (!promoCode.isActive) {
      return NextResponse.json({
        valid: false,
        errorCode: 'PROMO_DEACTIVATED',
        error: 'Ce code promo a été désactivé',
      }, { status: 410 }); // FIX: F-033 - 410 Gone for deactivated promo codes
    }

    // FIX: FLAW-048 - All date comparisons use UTC (JS Date objects are UTC-based).
    // Promo code startsAt/endsAt should be stored in UTC. If admin enters local time,
    // ensure the frontend converts to UTC before saving.
    const now = new Date();
    if (promoCode.startsAt && promoCode.startsAt > now) {
      return NextResponse.json({
        valid: false,
        errorCode: 'PROMO_NOT_YET_ACTIVE',
        error: 'Ce code promo n\'est pas encore actif',
      }, { status: 400 }); // FIX: F-033 - 400 Bad Request for not-yet-active promo codes
    }
    if (promoCode.endsAt && promoCode.endsAt < now) {
      return NextResponse.json({
        valid: false,
        errorCode: 'PROMO_EXPIRED',
        error: 'Ce code promo a expiré',
      }, { status: 410 }); // FIX: F-033 - 410 Gone for expired promo codes
    }

    // FLAW-031 FIX: Atomic check-and-increment to prevent race condition on usage count.
    // Two concurrent requests could both pass a non-atomic check before either increments.
    if (promoCode.usageLimit) {
      // Attempt atomic increment only if usageCount < usageLimit
      const atomicResult = await prisma.promoCode.updateMany({
        where: {
          id: promoCode.id,
          usageCount: { lt: promoCode.usageLimit },
        },
        data: {
          usageCount: { increment: 1 },
        },
      });
      if (atomicResult.count === 0) {
        return NextResponse.json({
          valid: false,
          errorCode: 'PROMO_USAGE_LIMIT_REACHED',
          error: 'Ce code promo a atteint sa limite d\'utilisation',
        });
      }
      // Note: usageCount has been incremented atomically. If the order fails later,
      // the checkout flow should decrement it. This prevents double-redemption.
    }

    // F-092 FIX: Call auth() once for all user-specific checks
    const session = (promoCode.usageLimitPerUser || promoCode.firstOrderOnly) ? await auth() : null;

    // E-05: Vérifier la limite d'utilisation par utilisateur via PromoCodeUsage
    if (promoCode.usageLimitPerUser) {
      if (!session?.user?.id) {
        // Per-user limit requires authentication to track usage
        return NextResponse.json({
          valid: false,
          errorCode: 'PROMO_AUTH_REQUIRED',
          error: 'Vous devez être connecté pour utiliser ce code promo',
        }, { status: 401 });
      }
      const userUsageCount = await prisma.promoCodeUsage.count({
        where: { promoCodeId: promoCode.id, userId: session.user.id },
      });
      if (userUsageCount >= promoCode.usageLimitPerUser) {
        return NextResponse.json({
          valid: false,
          errorCode: 'PROMO_USER_LIMIT_REACHED',
          error: 'Vous avez atteint la limite d\'utilisation pour ce code',
        }, { status: 400 });
      }
    }

    // E-04: Vérifier firstOrderOnly - le code est réservé aux premières commandes
    if (promoCode.firstOrderOnly) {
      if (!session?.user?.id) {
        return NextResponse.json({
          valid: false,
          errorCode: 'PROMO_AUTH_REQUIRED',
          error: 'Vous devez être connecté pour utiliser ce code promo',
        });
      }
      const previousPaidOrders = await prisma.order.count({
        where: {
          userId: session.user.id,
          paymentStatus: { in: ['PAID', 'DELIVERED'] },
        },
      });
      if (previousPaidOrders > 0) {
        return NextResponse.json({
          valid: false,
          errorCode: 'PROMO_FIRST_ORDER_ONLY',
          error: 'Ce code promo est réservé aux premières commandes',
        });
      }
    }

    // E-04: Vérifier productIds - le code ne s'applique qu'à certains produits
    // NOTE: FLAW-079 - productIds/categoryIds stored as JSON string; junction table migration deferred
    if (promoCode.productIds) {
      if (!cartItems || cartItems.length === 0) {
        // TODO: If cart items are not provided in the validate request,
        // we skip this check here. The create-checkout route performs a
        // server-side re-validation with the actual cart, so this is safe.
      } else {
        let allowedProductIds: string[] = [];
        try {
          allowedProductIds = JSON.parse(promoCode.productIds);
        } catch {
          // Malformed JSON in productIds - skip product filter (admin data entry error)
          logger.error('Malformed productIds JSON for promo code', { promoCode: upperCode });
        }
        if (allowedProductIds.length > 0) {
          const cartProductIds = cartItems.map((item) => item.productId);
          const hasMatchingProduct = cartProductIds.some((pid) =>
            allowedProductIds.includes(pid)
          );
          if (!hasMatchingProduct) {
            return NextResponse.json({
              valid: false,
              errorCode: 'PROMO_PRODUCT_MISMATCH',
              error: 'Ce code promo ne s\'applique pas aux produits de votre panier',
            });
          }
        }
      }
    }

    // E-04: Vérifier categoryIds - le code ne s'applique qu'à certaines catégories
    if (promoCode.categoryIds) {
      if (!cartItems || cartItems.length === 0) {
        // TODO: Same as productIds - skip if cart items not provided;
        // create-checkout will enforce this server-side.
      } else {
        let allowedCategoryIds: string[] = [];
        try {
          allowedCategoryIds = JSON.parse(promoCode.categoryIds);
        } catch {
          // Malformed JSON in categoryIds - skip category filter
          logger.error('Malformed categoryIds JSON for promo code', { promoCode: upperCode });
        }
        const cartProductIds = cartItems.map((item) => item.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: cartProductIds } },
          select: { id: true, categoryId: true },
        });
        const cartCategoryIds = products.map((p) => p.categoryId).filter((cid): cid is string => cid !== null);
        const hasMatchingCategory = allowedCategoryIds.length === 0 || cartCategoryIds.some((cid) =>
          allowedCategoryIds.includes(cid)
        );
        if (!hasMatchingCategory) {
          return NextResponse.json({
            valid: false,
            errorCode: 'PROMO_CATEGORY_MISMATCH',
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
        errorCode: 'PROMO_MIN_ORDER_NOT_MET',
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
    logger.error('Promo validation error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { valid: false, error: 'Erreur de validation' },
      { status: 500 }
    );
  }
}
