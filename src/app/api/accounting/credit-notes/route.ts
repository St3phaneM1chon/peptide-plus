export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// #65 Audit: Valid status transitions for credit notes
const VALID_CREDIT_NOTE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ISSUED', 'VOID'],
  ISSUED: ['APPLIED', 'VOID'],
  APPLIED: ['VOID'], // Only void after applied, not back to DRAFT
  VOID: [], // Terminal state
};

/**
 * GET /api/accounting/credit-notes
 * List credit notes with filters
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);

    const where: Record<string, unknown> = { deletedAt: null };
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

    // Aggregate stats using DB-level aggregation instead of fetching all records
    // Filter out soft-deleted credit notes from stats as well
    const statsWhere = { deletedAt: null };
    const [totalAgg, statusGroups] = await Promise.all([
      prisma.creditNote.aggregate({
        where: statsWhere,
        _count: true,
        _sum: { total: true },
      }),
      prisma.creditNote.groupBy({
        by: ['status'],
        where: statsWhere,
        _count: true,
        _sum: { total: true },
      }),
    ]);

    const issuedGroup = statusGroups.find((g) => g.status === 'ISSUED');
    const voidGroup = statusGroups.find((g) => g.status === 'VOID');

    const stats = {
      totalCount: totalAgg._count,
      totalAmount: Number(totalAgg._sum.total ?? 0),
      issuedCount: issuedGroup?._count ?? 0,
      issuedAmount: Number(issuedGroup?._sum.total ?? 0),
      voidCount: voidGroup?._count ?? 0,
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
    logger.error('Get credit notes error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des notes de credit' },
      { status: 500 }
    );
  }
});
