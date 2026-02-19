export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import {
  getRecurringTemplates,
  createRecurringTemplate,
  processDueRecurringEntries,
  previewRecurringSchedule,
} from '@/lib/accounting';

/**
 * GET /api/accounting/recurring
 * List recurring entry templates and optionally process due entries
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
    const action = searchParams.get('action');

    // Process due entries if requested
    if (action === 'process') {
      const result = await processDueRecurringEntries();
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

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
}

/**
 * POST /api/accounting/recurring
 * Create a new recurring entry template
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

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
}
