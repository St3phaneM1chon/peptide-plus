export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/credit-notes
 * List credit notes with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { creditNoteNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [creditNotes, total] = await Promise.all([
      prisma.creditNote.findMany({
        where,
        include: {
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.creditNote.count({ where }),
    ]);

    // Aggregate stats
    const allNotes = await prisma.creditNote.findMany({
      select: { status: true, total: true },
    });

    const stats = {
      totalCount: allNotes.length,
      totalAmount: allNotes.reduce((sum, cn) => sum + Number(cn.total), 0),
      issuedCount: allNotes.filter((cn) => cn.status === 'ISSUED').length,
      issuedAmount: allNotes
        .filter((cn) => cn.status === 'ISSUED')
        .reduce((sum, cn) => sum + Number(cn.total), 0),
      voidCount: allNotes.filter((cn) => cn.status === 'VOID').length,
    };

    const mapped = creditNotes.map((cn) => ({
      ...cn,
      subtotal: Number(cn.subtotal),
      taxTps: Number(cn.taxTps),
      taxTvq: Number(cn.taxTvq),
      taxTvh: Number(cn.taxTvh),
      total: Number(cn.total),
    }));

    return NextResponse.json({
      creditNotes: mapped,
      stats,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get credit notes error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des notes de credit' },
      { status: 500 }
    );
  }
}
