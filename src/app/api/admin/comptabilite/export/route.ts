export const dynamic = 'force-dynamic';

/**
 * Admin Accounting Export API
 * GET - Export journal entries as downloadable files for external accounting software
 *
 * Query parameters:
 *   format    - Export format: 'iif' (QuickBooks), 'xero-csv' (Xero), 'csv' (generic) [default: csv]
 *   startDate - Filter entries from this date (YYYY-MM-DD) [optional]
 *   endDate   - Filter entries up to this date (YYYY-MM-DD) [optional]
 *   periodId  - Filter by accounting period ID [optional]
 *   status    - Filter by entry status: DRAFT, POSTED, VOIDED [default: POSTED]
 *   type      - Filter by entry type: MANUAL, AUTO_SALE, etc. [optional]
 *
 * Returns: File download with Content-Disposition: attachment
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  exportEntries,
  resolveFormat,
  type ExportJournalEntry,
} from '@/lib/accounting/quickbooks-export';

// Maximum entries per export to prevent memory issues
const MAX_EXPORT_ENTRIES = 10_000;

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    // -----------------------------------------------------------------------
    // 1. Parse & validate query parameters
    // -----------------------------------------------------------------------
    const formatParam = searchParams.get('format') || 'csv';
    const format = resolveFormat(formatParam);
    if (!format) {
      return NextResponse.json(
        { error: `Invalid format "${formatParam}". Supported: iif, xero-csv, csv` },
        { status: 400 }
      );
    }

    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const periodId = searchParams.get('periodId');
    const statusFilter = searchParams.get('status') || 'POSTED';
    const typeFilter = searchParams.get('type');

    // Validate date options if provided
    if (startDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      return NextResponse.json(
        { error: 'Invalid startDate format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }
    if (endDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
      return NextResponse.json(
        { error: 'Invalid endDate format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['DRAFT', 'POSTED', 'VOIDED'];
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return NextResponse.json(
        { error: `Invalid status "${statusFilter}". Supported: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Build date range from periodId or explicit dates
    // -----------------------------------------------------------------------
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (periodId) {
      const period = await prisma.accountingPeriod.findUnique({
        where: { id: periodId },
        select: { startDate: true, endDate: true, name: true },
      });
      if (!period) {
        return NextResponse.json(
          { error: `Accounting period "${periodId}" not found.` },
          { status: 404 }
        );
      }
      dateFrom = period.startDate;
      dateTo = period.endDate;
    }

    // Explicit dates override period dates
    if (startDateStr) {
      dateFrom = new Date(startDateStr + 'T00:00:00.000Z');
    }
    if (endDateStr) {
      dateTo = new Date(endDateStr + 'T23:59:59.999Z');
    }

    // -----------------------------------------------------------------------
    // 3. Build Prisma where clause
    // -----------------------------------------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deletedAt: null, // Exclude soft-deleted entries
    };

    if (statusFilter) {
      where.status = statusFilter;
    }

    if (typeFilter) {
      where.type = typeFilter;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = dateFrom;
      if (dateTo) where.date.lte = dateTo;
    }

    // -----------------------------------------------------------------------
    // 4. Fetch journal entries with lines and account details
    // -----------------------------------------------------------------------
    const count = await prisma.journalEntry.count({ where });

    if (count === 0) {
      return NextResponse.json(
        { error: 'No journal entries match the specified filters.' },
        { status: 404 }
      );
    }

    if (count > MAX_EXPORT_ENTRIES) {
      return NextResponse.json(
        {
          error: `Too many entries (${count}). Maximum export is ${MAX_EXPORT_ENTRIES}. Please narrow the date range or filters.`,
        },
        { status: 400 }
      );
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // -----------------------------------------------------------------------
    // 5. Generate export file
    // -----------------------------------------------------------------------
    const exportData = entries as unknown as ExportJournalEntry[];
    const result = exportEntries(exportData, format);

    // Prepend UTF-8 BOM for CSV files to ensure Excel handles accents correctly
    const bom = result.extension === 'csv' ? '\uFEFF' : '';
    const body = bom + result.content;

    logger.info('Accounting export generated', {
      event: 'accounting_export',
      format: format,
      entriesCount: entries.length,
      dateRange: dateFrom && dateTo
        ? `${dateFrom.toISOString().slice(0, 10)} - ${dateTo.toISOString().slice(0, 10)}`
        : 'all',
      status: statusFilter,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Export-Count': String(entries.length),
        'X-Export-Format': format,
      },
    });
  } catch (error) {
    logger.error('Accounting export error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, {
  skipCsrf: true, // GET-only endpoint, no CSRF needed
  requiredPermission: 'accounting.view',
});
