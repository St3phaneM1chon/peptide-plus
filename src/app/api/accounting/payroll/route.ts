export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types - Payroll stub (no Prisma model yet)
// ---------------------------------------------------------------------------

interface PayrollEntry {
  id: string;
  employeeName: string;
  employeeEmail: string | null;
  period: string;
  periodType: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  year: number;
  month: number;
  grossPay: number;
  federalTax: number;
  provincialTax: number;
  cpp: number;       // Canada Pension Plan
  ei: number;        // Employment Insurance
  qpip: number;      // Quebec Parental Insurance Plan
  rqap: number;      // Regime quebecois d'assurance parentale
  otherDeductions: number;
  netPay: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  paidAt: string | null;
  createdAt: string;
}

interface PayrollSummary {
  totalGross: number;
  totalNet: number;
  totalFederalTax: number;
  totalProvincialTax: number;
  totalCpp: number;
  totalEi: number;
  totalQpip: number;
  employeeCount: number;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createPayrollSchema = z.object({
  employeeName: z.string().min(1, 'employeeName is required').max(200),
  employeeEmail: z.string().email().nullable().optional(),
  period: z.string().min(1, 'period is required'),
  periodType: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  grossPay: z.number().min(0, 'grossPay must be >= 0'),
  federalTax: z.number().min(0).default(0),
  provincialTax: z.number().min(0).default(0),
  cpp: z.number().min(0).default(0),
  ei: z.number().min(0).default(0),
  qpip: z.number().min(0).default(0),
  rqap: z.number().min(0).default(0),
  otherDeductions: z.number().min(0).default(0),
  netPay: z.number().min(0, 'netPay must be >= 0'),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/payroll
// ---------------------------------------------------------------------------

/**
 * List payroll entries with optional filters.
 *
 * STUB: No Prisma model exists yet for payroll. This route returns
 * empty data with the correct response shape so the frontend can
 * integrate immediately. Once a Payroll model is added to the schema,
 * replace the stub data with real Prisma queries.
 *
 * Query params:
 *   - year: filter by year (e.g. 2026)
 *   - month: filter by month (1-12)
 *   - status: filter by status (DRAFT, APPROVED, PAID)
 *   - page / limit: pagination
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);

    // Log the filter params for debugging during stub phase
    logger.debug('Payroll GET (stub)', {
      year,
      month,
      status,
      page,
      limit,
    });

    // ------------------------------------------------------------------
    // STUB: Return empty results with correct shape.
    // Replace this block with Prisma queries once the model exists:
    //
    //   const where: Prisma.PayrollWhereInput = {};
    //   if (year) where.year = parseInt(year);
    //   if (month) where.month = parseInt(month);
    //   if (status) where.status = status;
    //
    //   const [entries, total] = await Promise.all([
    //     prisma.payroll.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    //     prisma.payroll.count({ where }),
    //   ]);
    // ------------------------------------------------------------------

    const entries: PayrollEntry[] = [];
    const total = 0;

    const summary: PayrollSummary = {
      totalGross: 0,
      totalNet: 0,
      totalFederalTax: 0,
      totalProvincialTax: 0,
      totalCpp: 0,
      totalEi: 0,
      totalQpip: 0,
      employeeCount: 0,
    };

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      summary,
    });
  } catch (error) {
    logger.error('Error fetching payroll entries', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des donnees de paie' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/payroll
// ---------------------------------------------------------------------------

/**
 * Create a new payroll entry.
 *
 * STUB: Validates the input with Zod but does not persist to the database.
 * Returns a mock response with the validated data so the frontend can
 * integrate immediately. Replace with Prisma create once the model exists.
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/payroll');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPayrollSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate that deductions + net = gross
    const totalDeductions =
      data.federalTax +
      data.provincialTax +
      data.cpp +
      data.ei +
      data.qpip +
      data.rqap +
      data.otherDeductions;

    if (Math.abs(data.grossPay - totalDeductions - data.netPay) > 0.01) {
      return NextResponse.json(
        {
          error: `Le salaire net (${data.netPay}) + deductions (${totalDeductions.toFixed(2)}) ne correspond pas au brut (${data.grossPay})`,
        },
        { status: 400 }
      );
    }

    logger.info('Payroll entry created (stub)', {
      employeeName: data.employeeName,
      period: data.period,
      grossPay: data.grossPay,
      submittedBy: session.user?.email,
    });

    // ------------------------------------------------------------------
    // STUB: Return mock created entry. Replace with Prisma create:
    //
    //   const entry = await prisma.payroll.create({
    //     data: { ...data, createdBy: session.user?.email },
    //   });
    // ------------------------------------------------------------------

    const stubEntry: PayrollEntry = {
      id: `stub-${Date.now()}`,
      employeeName: data.employeeName,
      employeeEmail: data.employeeEmail || null,
      period: data.period,
      periodType: data.periodType,
      year: data.year,
      month: data.month,
      grossPay: data.grossPay,
      federalTax: data.federalTax,
      provincialTax: data.provincialTax,
      cpp: data.cpp,
      ei: data.ei,
      qpip: data.qpip,
      rqap: data.rqap,
      otherDeductions: data.otherDeductions,
      netPay: data.netPay,
      status: 'DRAFT',
      paidAt: null,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(
      { success: true, entry: stubEntry },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating payroll entry', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la creation de l\'entree de paie' },
      { status: 500 }
    );
  }
});
