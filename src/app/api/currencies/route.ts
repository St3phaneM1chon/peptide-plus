export const dynamic = 'force-dynamic';

/**
 * API Currencies - BioCycle Peptides
 * Retourne les devises actives avec leurs taux de change depuis la DB
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cacheGetOrSet, CacheKeys, CacheTags, CacheTTL } from '@/lib/cache';

export async function GET() {
  try {
    const currencies = await cacheGetOrSet(
      CacheKeys.config.currencies(),
      async () => {
        const rows = await prisma.currency.findMany({
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            symbol: true,
            exchangeRate: true,
            isDefault: true,
          },
          orderBy: [
            { isDefault: 'desc' },
            { code: 'asc' },
          ],
        });
        return rows.map((c) => ({
          ...c,
          exchangeRate: Number(c.exchangeRate),
        }));
      },
      { ttl: CacheTTL.CONFIG, tags: [CacheTags.CONFIG] },
    );

    return NextResponse.json({ currencies });
  } catch (error) {
    console.error('Currencies API error:', error);
    return NextResponse.json({ currencies: [] }, { status: 500 });
  }
}
