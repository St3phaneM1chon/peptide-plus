export const dynamic = 'force-dynamic';

/**
 * API Account Address - BioCycle Peptides
 * Gestion des adresses utilisateur via le modèle UserAddress
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { logger } from '@/lib/logger';

/** Sanitize a string field: strip HTML + control chars */
const clean = (v: string) => stripControlChars(stripHtml(v));

const addressSchema = z.object({
  id: z.string().max(100).optional(),
  recipientName: z.string().max(100).optional(),
  addressLine1: z.string().max(500).optional(),
  address: z.string().max(500).optional(),      // alias for addressLine1
  addressLine2: z.string().max(200).optional().default(''),
  city: z.string().max(100).optional().default(''),
  state: z.string().max(100).optional(),
  province: z.string().max(100).optional(),      // alias for state
  postalCode: z.string().max(20).optional().default(''),
  country: z.string().max(2).optional().default('CA'),
  phone: z.string().max(30).optional().default(''),
  label: z.string().max(50).optional().default('Principal'),
});

export async function PUT(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/address');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
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

    // Zod schema validation
    const body = await request.json();
    const parsed = addressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // BE-SEC-05: Enforce input length limits on all address fields
    // BE-SEC-03: Strip HTML + control chars from text fields to prevent stored XSS
    const addressData = {
      recipientName: clean(data.recipientName || session.user.name || '').slice(0, 100) || '',
      addressLine1: clean(data.addressLine1 || data.address || '').slice(0, 500) || '',
      addressLine2: clean(data.addressLine2 || '').slice(0, 200) || '',
      city: clean(data.city || '').slice(0, 100) || '',
      state: clean(data.state || data.province || '').slice(0, 100) || '',
      postalCode: clean(data.postalCode || '').slice(0, 20) || '',
      country: clean(data.country || '').slice(0, 2) || 'CA',
      phone: clean(data.phone || '').slice(0, 30) || '',
      label: clean(data.label || '').slice(0, 50) || 'Principal',
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
    logger.error('Error updating address', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('Error fetching address', { error: error instanceof Error ? error.message : String(error) });
    // SEC-29: Return 500 status on error instead of 200
    return NextResponse.json(
      { error: 'Failed to fetch address' },
      { status: 500 }
    );
  }
}
