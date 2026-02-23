export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import {
  DEFAULT_TEMPLATES,
  getTemplatesByFrequency,
  generateEntryFromTemplate,
  recordTemplateUsage,
  KEYBOARD_SHORTCUTS,
} from '@/lib/accounting/quick-entry.service';
import { logger } from '@/lib/logger';

/**
 * GET /api/accounting/quick-entry
 * List available quick-entry templates and keyboard shortcuts
 * Query params:
 *   - category (string) - filter by template category
 */
export const GET = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let templates = getTemplatesByFrequency(DEFAULT_TEMPLATES);
    if (category) {
      templates = templates.filter((t) => t.category === category);
    }

    return NextResponse.json({
      templates,
      shortcuts: KEYBOARD_SHORTCUTS,
      categories: ['SALES', 'PURCHASES', 'PAYROLL', 'TAXES', 'ADJUSTMENTS', 'OTHER'],
    });
  } catch (error) {
    logger.error('Erreur récupération templates quick-entry', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des templates de saisie rapide' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/quick-entry
 * Create a journal entry from a template
 * Body:
 *   - templateId (string) - template to use
 *   - values (Record<string, string | number | Date>) - variable values
 *   - entryNumber (string) - entry number to assign
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { templateId, values } = body;

    if (!templateId || !values) {
      return NextResponse.json(
        { error: 'templateId et values sont requis' },
        { status: 400 }
      );
    }

    const template = DEFAULT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json(
        { error: `Template non trouvé: ${templateId}` },
        { status: 404 }
      );
    }

    // Validate required variables
    for (const variable of template.variables) {
      if (variable.required && (values[variable.name] === undefined || values[variable.name] === '')) {
        return NextResponse.json(
          { error: `Variable requise manquante: ${variable.label}` },
          { status: 400 }
        );
      }
    }

    // Generate entry from template (in-memory structure with accountCode lines)
    const entry = generateEntryFromTemplate(template, values, 'TEMP');

    // Persist entry to database
    const accountCodes = entry.lines.map((l: { accountCode: string }) => l.accountCode);
    const accounts = await prisma.chartOfAccount.findMany({
      where: { code: { in: accountCodes } },
      select: { id: true, code: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

    // Validate all account codes exist
    for (const line of entry.lines) {
      if (!accountMap.has(line.accountCode)) {
        return NextResponse.json(
          { error: `Compte comptable ${line.accountCode} introuvable` },
          { status: 400 }
        );
      }
    }

    // Generate entry number in transaction (same pattern as entries/route.ts)
    const year = new Date(entry.date).getFullYear();
    const prefix = `JV-${year}-`;

    const savedEntry = await prisma.$transaction(async (tx) => {
      const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
        SELECT MAX("entryNumber") as max_num
        FROM "JournalEntry"
        WHERE "entryNumber" LIKE ${prefix + '%'}
        FOR UPDATE
      `;

      let nextNum = 1;
      if (maxRow?.max_num) {
        const parsed = parseInt(maxRow.max_num.split('-').pop() || '0');
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      const dbEntryNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

      return tx.journalEntry.create({
        data: {
          entryNumber: dbEntryNumber,
          date: new Date(entry.date || Date.now()),
          description: entry.description || `Saisie rapide: ${template.name}`,
          type: 'MANUAL',
          status: 'DRAFT',
          reference: `QE-${templateId}`,
          createdBy: session.user.id || 'quick-entry',
          lines: {
            create: entry.lines.map((l: { accountCode: string; debit?: number; credit?: number; description?: string }) => ({
              accountId: accountMap.get(l.accountCode)!,
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
              description: l.description || null,
            })),
          },
        },
        include: {
          lines: { include: { account: { select: { code: true, name: true } } } },
        },
      });
    });

    recordTemplateUsage(template);

    return NextResponse.json({ success: true, entry: savedEntry }, { status: 201 });
  } catch (error) {
    logger.error('Erreur création saisie rapide', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la saisie rapide' },
      { status: 500 }
    );
  }
});
