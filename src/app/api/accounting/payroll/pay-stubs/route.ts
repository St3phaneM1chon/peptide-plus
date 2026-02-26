export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET /api/accounting/payroll/pay-stubs
// List pay stubs with pagination and filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);
    const employeeId = searchParams.get('employeeId');
    const year = searchParams.get('year');

    const where: Record<string, unknown> = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }
    if (year) {
      const yearNum = parseInt(year);
      where.periodStart = { gte: new Date(yearNum, 0, 1) };
      where.periodEnd = { lte: new Date(yearNum + 1, 0, 1) };
    }

    const [stubs, total] = await Promise.all([
      prisma.payStub.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { payDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payStub.count({ where }),
    ]);

    const mapped = stubs.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      employee: s.employee,
      periodStart: s.periodStart.toISOString().split('T')[0],
      periodEnd: s.periodEnd.toISOString().split('T')[0],
      payDate: s.payDate.toISOString().split('T')[0],
      grossPay: Number(s.grossPay),
      totalDeductions: Number(s.totalDeductions),
      netPay: Number(s.netPay),
      ytdGross: Number(s.ytdGross),
      ytdDeductions: Number(s.ytdDeductions),
      ytdNet: Number(s.ytdNet),
      deductionDetails: s.deductionDetails,
      pdfUrl: s.pdfUrl,
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json({
      payStubs: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching pay stubs', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des bulletins de paie' },
      { status: 500 }
    );
  }
});
