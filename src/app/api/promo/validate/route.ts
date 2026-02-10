/**
 * API Validation Code Promo - BioCycle Peptides
 * Valide les codes promotionnels depuis la base de données
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { code, subtotal } = await request.json();

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
