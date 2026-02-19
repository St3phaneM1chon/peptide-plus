export const dynamic = 'force-dynamic';

/**
 * API Account Address - BioCycle Peptides
 * Gestion des adresses utilisateur via le modèle UserAddress
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';

export async function PUT(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = await request.json();

    // BE-SEC-05: Enforce input length limits on all address fields
    // BE-SEC-03: Strip HTML from text fields to prevent stored XSS
    const stripTags = (v: unknown) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '') : '';
    const addressData = {
      recipientName: stripTags(data.recipientName || session.user.name).slice(0, 100) || '',
      addressLine1: stripTags(data.addressLine1 || data.address).slice(0, 500) || '',
      addressLine2: stripTags(data.addressLine2).slice(0, 200) || '',
      city: stripTags(data.city).slice(0, 100) || '',
      state: stripTags(data.state || data.province).slice(0, 100) || '',
      postalCode: stripTags(data.postalCode).slice(0, 20) || '',
      country: stripTags(data.country).slice(0, 2) || 'CA',
      phone: stripTags(data.phone).slice(0, 30) || '',
      label: stripTags(data.label).slice(0, 50) || 'Principal',
    };

    let address;

    // SECURITY: If updating an existing address, verify ownership first
    if (data.id) {
      const existing = await db.userAddress.findFirst({
        where: { id: data.id, userId: user.id },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Adresse introuvable' }, { status: 404 });
      }
      address = await db.userAddress.update({
        where: { id: data.id },
        data: addressData,
      });
    } else {
      // Create new address
      // DI-60: When creating with isDefault=true, unset other defaults in a transaction
      address = await db.$transaction(async (tx) => {
        await tx.userAddress.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
        return tx.userAddress.create({
          data: {
            userId: user.id,
            ...addressData,
            isDefault: true,
          },
        });
      });
    }

    return NextResponse.json({
      success: true,
      address,
    });
  } catch (error) {
    console.error('Error updating address:', error);
    return NextResponse.json(
      { error: 'Failed to update address' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Récupérer toutes les adresses de l'utilisateur
    const addresses = await db.userAddress.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    // Retourner l'adresse par défaut comme champs plats + la liste complète
    const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];

    return NextResponse.json({
      address: defaultAddr?.addressLine1 || '',
      addressLine2: defaultAddr?.addressLine2 || '',
      city: defaultAddr?.city || '',
      province: defaultAddr?.state || '',
      postalCode: defaultAddr?.postalCode || '',
      country: defaultAddr?.country || 'CA',
      phone: defaultAddr?.phone || '',
      addresses,
    });
  } catch (error) {
    console.error('Error fetching address:', error);
    // SEC-29: Return 500 status on error instead of 200
    return NextResponse.json(
      { error: 'Failed to fetch address' },
      { status: 500 }
    );
  }
}
