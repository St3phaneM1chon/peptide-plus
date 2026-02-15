export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Translation statuses for a product
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const translations = await prisma.productTranslation.findMany({
      where: { productId: id },
      select: {
        locale: true,
        isApproved: true,
        updatedAt: true,
      },
      orderBy: { locale: 'asc' },
    });

    return NextResponse.json({ translations });
  } catch (error) {
    console.error('Error fetching product translations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch translations' },
      { status: 500 }
    );
  }
}
