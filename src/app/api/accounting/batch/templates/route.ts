export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { apiError } from '@/lib/api-response';
import { getCSVTemplate } from '@/lib/accounting/batch-operations.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/batch/templates?type=expenses|journal_entries|invoices
// Download CSV templates for each batch type
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get('type');

    if (!templateType) {
      return apiError(
        'Le paramètre type est requis (expenses, journal_entries, invoices)',
        'VALIDATION_ERROR',
        { status: 400 }
      );
    }

    const validTypes = ['expenses', 'journal_entries', 'invoices'];
    if (!validTypes.includes(templateType)) {
      return apiError(
        `Type de template non supporté: ${templateType}. Utilisez: ${validTypes.join(', ')}`,
        'VALIDATION_ERROR',
        { status: 400 }
      );
    }

    const template = getCSVTemplate(templateType);

    return new NextResponse(template.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${template.filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logger.error('Error generating CSV template', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la génération du template', 'INTERNAL_ERROR', { status: 500 });
  }
});
