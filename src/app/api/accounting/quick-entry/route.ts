export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  DEFAULT_TEMPLATES,
  getTemplatesByFrequency,
  generateEntryFromTemplate,
  recordTemplateUsage,
  KEYBOARD_SHORTCUTS,
} from '@/lib/accounting/quick-entry.service';

/**
 * GET /api/accounting/quick-entry
 * List available quick-entry templates and keyboard shortcuts
 * Query params:
 *   - category (string) - filter by template category
 */
export const GET = withAdminGuard(async (request) => {
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
});

/**
 * POST /api/accounting/quick-entry
 * Create a journal entry from a template
 * Body:
 *   - templateId (string) - template to use
 *   - values (Record<string, string | number | Date>) - variable values
 *   - entryNumber (string) - entry number to assign
 */
export const POST = withAdminGuard(async (request) => {
  const body = await request.json();
  const { templateId, values, entryNumber } = body;

  if (!templateId || !values || !entryNumber) {
    return NextResponse.json(
      { error: 'templateId, values et entryNumber sont requis' },
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

  const entry = generateEntryFromTemplate(template, values, entryNumber);
  recordTemplateUsage(template);

  return NextResponse.json({ success: true, entry }, { status: 201 });
});
