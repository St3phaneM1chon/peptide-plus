/**
 * API Account Address - BioCycle Peptides
 * Gestion des adresses utilisateur via le modèle UserAddress
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

export async function PUT(request: Request) {
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

    const data = await request.json();

    const addressData = {
      recipientName: data.recipientName || session.user.name || '',
      addressLine1: data.addressLine1 || data.address || '',
      addressLine2: data.addressLine2 || '',
      city: data.city || '',
      state: data.state || data.province || '',
      postalCode: data.postalCode || '',
      country: data.country || 'CA',
      phone: data.phone || '',
      label: data.label || 'Principal',
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
      address = await db.userAddress.create({
        data: {
          userId: user.id,
          ...addressData,
          isDefault: true,
        },
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
    return NextResponse.json({
      address: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'CA',
      addresses: [],
    });
  }
}
