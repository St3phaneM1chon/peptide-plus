export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaymentMethodsForCountry } from '@/lib/payment-methods';

/**
 * GET /api/payment-methods?country=CA
 * Get available payment methods for a specific country
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || 'CA';

    // Get payment methods from database (if configured)
    const configuredMethods = await prisma.paymentMethodConfig.findMany({
      where: {
        countryCode: country,
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    const cacheHeaders = { 'Cache-Control': 'public, s-maxage=300' };

    // If we have configured methods in the database, use those
    if (configuredMethods.length > 0) {
      return NextResponse.json({
        country,
        methods: configuredMethods.map((m) => ({
          methodType: m.methodType,
          provider: m.provider,
          sortOrder: m.sortOrder,
          minAmount: m.minAmount ? Number(m.minAmount) : null,
          maxAmount: m.maxAmount ? Number(m.maxAmount) : null,
        })),
      }, { headers: cacheHeaders });
    }

    // Otherwise, fall back to defaults from lib/payment-methods.ts
    const defaultMethods = getPaymentMethodsForCountry(country);

    return NextResponse.json({
      country,
      methods: defaultMethods,
      usingDefaults: true,
    }, { headers: cacheHeaders });
  } catch (error) {
    console.error('Get payment methods error:', error);
    return NextResponse.json(
      { error: 'Error fetching payment methods' },
      { status: 500 }
    );
  }
}
