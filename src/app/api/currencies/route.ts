/**
 * API Currencies - BioCycle Peptides
 * Retourne les devises actives avec leurs taux de change depuis la DB
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      select: {
        code: true,
        name: true,
        symbol: true,
        exchangeRate: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { code: 'asc' },
      ],
    });

    return NextResponse.json({
      currencies: currencies.map((c) => ({
        ...c,
        exchangeRate: Number(c.exchangeRate),
      })),
    });
  } catch (error) {
    console.error('Currencies API error:', error);
    return NextResponse.json({ currencies: [] }, { status: 500 });
  }
}
