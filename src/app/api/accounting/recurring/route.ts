export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  getRecurringTemplates,
  createRecurringTemplate,
  processDueRecurringEntries,
  previewRecurringSchedule,
} from '@/lib/accounting';

/**
 * GET /api/accounting/recurring
 * List recurring entry templates.
 *
 * NOTE: The previous `?action=process` mutation-via-GET has been moved
 * to PUT /api/accounting/recurring for correctness (GET should be idempotent).
 */
export const GET = withAdminGuard(async () => {
  try {
    // List templates
    const templates = await getRecurringTemplates();

    return NextResponse.json({
      templates: templates.map((t) => ({
        ...t,
        nextSchedule: previewRecurringSchedule(t, 6).map((d) => d.toISOString().split('T')[0]),
      })),
    });
  } catch (error) {
    console.error('Get recurring entries error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des écritures récurrentes' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/recurring
 * Create a new recurring entry template
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const {
      name,
      description,
      frequency,
      dayOfMonth,
      dayOfWeek,
      monthOfYear,
      lines,
      startDate,
      endDate,
      autoPost,
      notifyOnCreate,
    } = body;

    if (!name || !frequency || !lines || lines.length < 2) {
      return NextResponse.json(
        { error: 'name, frequency et au moins 2 lignes sont requis' },
        { status: 400 }
      );
    }

    // Validate balance
    const totalDebits = lines.reduce(
      (sum: number, l: { debitAmount?: number }) => sum + (Number(l.debitAmount) || 0),
      0
    );
    const totalCredits = lines.reduce(
      (sum: number, l: { creditAmount?: number }) => sum + (Number(l.creditAmount) || 0),
      0
    );

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        { error: "Le modèle n'est pas équilibré" },
        { status: 400 }
      );
    }

    const template = await createRecurringTemplate({
      name,
      description: description || '',
      frequency,
      dayOfMonth,
      dayOfWeek,
      monthOfYear,
      lines,
      startDate: new Date(startDate || Date.now()),
      endDate: endDate ? new Date(endDate) : undefined,
      nextRunDate: new Date(startDate || Date.now()),
      isActive: true,
      autoPost: autoPost ?? false,
      notifyOnCreate: notifyOnCreate ?? true,
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    console.error('Create recurring template error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du modèle récurrent' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/recurring
 * Process due recurring entries (previously was GET ?action=process).
 * Moved to PUT because it's a mutation operation.
 */
export const PUT = withAdminGuard(async () => {
  try {
    const result = await processDueRecurringEntries();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Process recurring entries error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement des écritures récurrentes' },
      { status: 500 }
    );
  }
});
