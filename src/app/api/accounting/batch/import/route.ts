export const dynamic = 'force-dynamic';

import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  parseCSV,
  csvToExpenseItems,
  csvToJournalEntryItems,
  executeBatchJob,
  MAX_BATCH_SIZE,
  type BatchType,
} from '@/lib/accounting/batch-operations.service';

// ---------------------------------------------------------------------------
// POST /api/accounting/batch/import - Upload CSV for batch import
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const contentType = request.headers.get('content-type') || '';

    let csvContent: string;
    let importType: string;

    if (contentType.includes('multipart/form-data')) {
      // Multipart form data upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      importType = (formData.get('type') as string) || '';

      if (!file) {
        return apiError('Fichier CSV requis', 'VALIDATION_ERROR', { status: 400 });
      }

      // Validate file type
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.csv')) {
        return apiError('Le fichier doit être au format CSV', 'VALIDATION_ERROR', { status: 400 });
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return apiError('Le fichier ne doit pas dépasser 5 Mo', 'VALIDATION_ERROR', { status: 400 });
      }

      csvContent = await file.text();
    } else if (contentType.includes('application/json')) {
      // JSON body with CSV content as string
      const body = await request.json();
      csvContent = body.csvContent || '';
      importType = body.type || '';
    } else {
      return apiError('Content-Type doit être multipart/form-data ou application/json', 'VALIDATION_ERROR', { status: 400 });
    }

    if (!csvContent.trim()) {
      return apiError('Le contenu CSV est vide', 'VALIDATION_ERROR', { status: 400 });
    }

    if (!importType) {
      return apiError('Le type d\'import est requis (expenses, journal_entries, invoices)', 'VALIDATION_ERROR', { status: 400 });
    }

    // Parse CSV
    let records: Record<string, string>[];
    try {
      records = parseCSV(csvContent);
    } catch (parseError) {
      return apiError(
        `Erreur de parsing CSV: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        'VALIDATION_ERROR',
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return apiError('Le fichier CSV ne contient aucune donnée', 'VALIDATION_ERROR', { status: 400 });
    }

    if (records.length > MAX_BATCH_SIZE) {
      return apiError(
        `Maximum ${MAX_BATCH_SIZE} lignes par import (trouvé: ${records.length})`,
        'VALIDATION_ERROR',
        { status: 400 }
      );
    }

    // Transform CSV records to batch items based on import type
    let items: unknown[];
    let batchType: BatchType;

    switch (importType) {
      case 'expenses':
        items = csvToExpenseItems(records);
        batchType = 'BATCH_EXPENSES';
        break;
      case 'journal_entries':
        items = csvToJournalEntryItems(records);
        batchType = 'BATCH_JOURNAL_ENTRIES';
        break;
      case 'invoices':
        // Invoice import maps directly from CSV records
        items = records.map((row) => ({
          invoiceId: row['invoiceId'] || row['Invoice ID'] || row['ID Facture'] || '',
          newStatus: row['newStatus'] || row['Status'] || row['Statut'] || '',
        }));
        batchType = 'BATCH_STATUS_UPDATE';
        break;
      default:
        return apiError(
          `Type d'import non supporté: ${importType}. Utilisez: expenses, journal_entries, invoices`,
          'VALIDATION_ERROR',
          { status: 400 }
        );
    }

    logger.info('CSV import parsed', {
      importType,
      recordCount: records.length,
      itemCount: items.length,
      user: session.user?.email,
    });

    // Return preview if requested
    const preview = new URL(request.url).searchParams.get('preview') === 'true';
    if (preview) {
      return apiSuccess({
        importType,
        batchType,
        recordCount: records.length,
        itemCount: items.length,
        preview: items.slice(0, 10), // First 10 items for preview
        headers: records.length > 0 ? Object.keys(records[0]) : [],
      });
    }

    // Execute batch job
    const summary = await executeBatchJob(batchType, items, session.user?.email || null);

    return apiSuccess(summary, { status: 201 });
  } catch (error) {
    logger.error('Error importing CSV batch', { error: error instanceof Error ? error.message : String(error) });
    return apiError(
      error instanceof Error ? error.message : 'Erreur lors de l\'import CSV',
      'INTERNAL_ERROR',
      { status: 500 }
    );
  }
}, { skipCsrf: true }); // Skip CSRF for multipart/form-data file upload
