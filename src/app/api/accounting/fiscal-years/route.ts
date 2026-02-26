export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { requireAdmin } from '@/lib/accounting/auth-middleware';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createFiscalYearSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

const updateFiscalYearSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['close', 'reopen']).optional(),
  name: z.string().optional(),
  reason: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/fiscal-years - List all fiscal years
// ---------------------------------------------------------------------------
export const GET = withAdminGuard(async (_request) => {
  try {
    const fiscalYears = await prisma.fiscalYear.findMany({
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({
      fiscalYears: fiscalYears.map((fy) => ({
        ...fy,
        startDate: fy.startDate.toISOString().split('T')[0],
        endDate: fy.endDate.toISOString().split('T')[0],
      })),
    });
  } catch (error) {
    logger.error('Get fiscal years error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des exercices fiscaux' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/fiscal-years - Create a new fiscal year
// ---------------------------------------------------------------------------
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    // A014: Require ADMIN accounting role for fiscal year management
    const authError = await requireAdmin(session);
    if (authError) return authError;

    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/fiscal-years');
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
    const parsed = createFiscalYearSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name, startDate, endDate } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return NextResponse.json(
        { error: 'La date de fin doit être postérieure à la date de début' },
        { status: 400 }
      );
    }

    // Check for overlapping fiscal years
    const overlap = await prisma.fiscalYear.findFirst({
      where: {
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });

    if (overlap) {
      return NextResponse.json(
        { error: `Chevauchement avec l'exercice fiscal "${overlap.name}" (${overlap.startDate.toISOString().split('T')[0]} — ${overlap.endDate.toISOString().split('T')[0]})` },
        { status: 409 }
      );
    }

    const fiscalYear = await prisma.fiscalYear.create({
      data: { name, startDate: start, endDate: end },
    });

    return NextResponse.json({ success: true, fiscalYear }, { status: 201 });
  } catch (error) {
    logger.error('Create fiscal year error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'exercice fiscal' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/fiscal-years - Close or update a fiscal year
// ---------------------------------------------------------------------------
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    // A014: Require ADMIN accounting role for fiscal year close/reopen
    const authError = await requireAdmin(session);
    if (authError) return authError;

    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/fiscal-years');
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
    const parsed = updateFiscalYearSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id, action, name, reason } = parsed.data;

    const existing = await prisma.fiscalYear.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Exercice fiscal non trouvé' },
        { status: 404 }
      );
    }

    if (action === 'close') {
      if (session.user.role !== 'OWNER') {
        return NextResponse.json(
          { error: 'Seul le propriétaire peut clore un exercice fiscal' },
          { status: 403 }
        );
      }

      if (existing.isClosed) {
        return NextResponse.json(
          { error: 'Cet exercice fiscal est déjà clos' },
          { status: 400 }
        );
      }

      // #43 Verify all periods within the fiscal year are LOCKED before allowing close
      const periodsInRange = await prisma.accountingPeriod.findMany({
        where: {
          startDate: { gte: existing.startDate },
          endDate: { lte: existing.endDate },
        },
        select: { code: true, status: true },
      });
      const unlockedPeriods = periodsInRange.filter((p) => p.status !== 'LOCKED');
      if (unlockedPeriods.length > 0) {
        return NextResponse.json(
          { error: `Impossible de clore l'exercice fiscal: ${unlockedPeriods.length} période(s) non verrouillée(s): ${unlockedPeriods.map((p) => p.code).join(', ')}` },
          { status: 400 }
        );
      }

      const updated = await prisma.fiscalYear.update({
        where: { id },
        data: {
          isClosed: true,
          closedAt: new Date(),
          closedBy: session.user?.id || session.user?.email || 'unknown',
        },
      });

      return NextResponse.json({ success: true, fiscalYear: updated });
    }

    if (action === 'reopen') {
      if (session.user.role !== 'OWNER') {
        return NextResponse.json(
          { error: 'Seul le propriétaire peut réouvrir un exercice fiscal' },
          { status: 403 }
        );
      }

      if (!existing.isClosed) {
        return NextResponse.json(
          { error: 'Cet exercice fiscal n\'est pas clos' },
          { status: 400 }
        );
      }

      // #73 Compliance: Require reason parameter for reopen
      if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
        return NextResponse.json(
          { error: 'Un motif détaillé (au moins 10 caractères) est requis pour réouvrir un exercice fiscal' },
          { status: 400 }
        );
      }

      const updated = await prisma.fiscalYear.update({
        where: { id },
        data: {
          isClosed: false,
          closedAt: null,
          closedBy: null,
        },
      });

      // #73 Compliance: Audit log for fiscal year reopen
      logger.info('AUDIT: Fiscal year reopened', {
        fiscalYearId: id,
        fiscalYearName: existing.name,
        reopenedBy: session.user?.id || session.user?.email || 'unknown',
        reason: reason.trim(),
        previouslyClosedBy: existing.closedBy,
        previouslyClosedAt: existing.closedAt?.toISOString(),
        reopenedAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, fiscalYear: updated });
    }

    // Default: update name
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;

    const updated = await prisma.fiscalYear.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, fiscalYear: updated });
  } catch (error) {
    logger.error('Update fiscal year error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'exercice fiscal' },
      { status: 500 }
    );
  }
});
