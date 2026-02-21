export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  parseDesjardinsCSV,
  parseTDCSV,
  detectCSVFormat,
  categorizeTransaction,
} from '@/lib/accounting';

/**
 * POST /api/accounting/bank-import/parse
 * Parse a CSV bank statement and return categorized transactions
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const requestedFormat = formData.get('format') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Validate file type - only CSV/text files allowed for bank imports
    const ALLOWED_BANK_IMPORT_TYPES = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
    if (file.type && !ALLOWED_BANK_IMPORT_TYPES.includes(file.type)) {
      // Also allow files with .csv extension regardless of MIME (some browsers send generic types)
      if (!file.name.toLowerCase().endsWith('.csv')) {
        return NextResponse.json(
          { error: 'Type de fichier invalide. Seuls les fichiers CSV sont acceptés.' },
          { status: 400 }
        );
      }
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 });
    }

    const csvContent = await file.text();
    const detectedFormat = requestedFormat || detectCSVFormat(csvContent);

    let transactions;

    switch (detectedFormat) {
      case 'desjardins':
        transactions = parseDesjardinsCSV(csvContent);
        break;
      case 'td':
        transactions = parseTDCSV(csvContent);
        break;
      case 'rbc':
      case 'generic':
      default:
        // Generic: try to parse as standard CSV (Date,Description,Amount)
        transactions = parseGenericCSV(csvContent);
        break;
    }

    // Map to frontend format
    const mapped = transactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      suggestedAccount: tx.rawData?.suggestedAccountCode,
      confidence: tx.rawData?.categoryConfidence || 0.5,
    }));

    return NextResponse.json({
      success: true,
      format: detectedFormat,
      transactions: mapped,
      count: mapped.length,
    });
  } catch (error) {
    console.error('Bank import parse error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse du fichier CSV' },
      { status: 500 }
    );
  }
});

/**
 * Generic CSV parser for unknown bank formats
 */
function parseGenericCSV(csvContent: string) {
  const lines = csvContent.split('\n').filter((l) => l.trim());
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;

    const dateStr = cols[0];
    const description = cols[1];
    const amountStr = cols[2];

    const amount = Math.abs(parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0);
    if (amount === 0) continue;

    const type = amountStr.startsWith('-') || parseFloat(amountStr) < 0 ? 'DEBIT' : 'CREDIT';
    const { accountCode, description: category, confidence } = categorizeTransaction(description, []);

    transactions.push({
      id: `csv-generic-${Date.now()}-${i}`,
      bankAccountId: 'generic',
      date: new Date(dateStr),
      description,
      amount,
      type,
      category,
      reconciliationStatus: 'PENDING' as const,
      importedAt: new Date(),
      rawData: {
        suggestedAccountCode: accountCode,
        categoryConfidence: confidence,
        importSource: 'CSV-Generic',
        lineNumber: i,
      },
    });
  }

  return transactions;
}
