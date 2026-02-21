export const dynamic = 'force-dynamic';

/**
 * Admin Inventory CSV Import API
 *
 * POST /api/admin/inventory/import
 * Accepts a CSV file (FormData with key "file") containing inventory data.
 *
 * Expected CSV columns (header row required):
 *   sku       - ProductFormat SKU (required, used as lookup key)
 *   quantity  - New stock quantity (required, integer >= 0)
 *   cost      - Optional unit cost (decimal)
 *
 * Behaviour:
 *   - Looks up each SKU in ProductFormat
 *   - If found, updates stockQuantity and optionally costPrice
 *   - Creates an InventoryTransaction record for the adjustment
 *   - Returns summary: imported count, skipped rows, errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

// ---------------------------------------------------------------------------
// CSV Parser (simple, handles quoted fields)
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): Record<string, string>[] {
  // Remove BOM if present
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return []; // need header + at least 1 data row

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// POST /api/admin/inventory/import
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No CSV file provided. Upload a file with key "file".' },
        { status: 400 },
      );
    }

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { error: 'File must be a .csv file' },
        { status: 400 },
      );
    }

    // Limit file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum 2MB.' },
        { status: 400 },
      );
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV is empty or has no data rows. Expected headers: sku, quantity, cost' },
        { status: 400 },
      );
    }

    // Validate headers
    const firstRow = rows[0];
    if (!('sku' in firstRow)) {
      return NextResponse.json(
        { error: 'CSV must have a "sku" column header' },
        { status: 400 },
      );
    }
    if (!('quantity' in firstRow)) {
      return NextResponse.json(
        { error: 'CSV must have a "quantity" column header' },
        { status: 400 },
      );
    }

    // Process rows
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because: 1-indexed + header row
      const sku = row.sku?.trim();
      const quantityStr = row.quantity?.trim();
      const costStr = row.cost?.trim();

      if (!sku) {
        skipped++;
        continue;
      }

      const quantity = parseInt(quantityStr, 10);
      if (isNaN(quantity) || quantity < 0) {
        errors.push(`Row ${rowNum}: Invalid quantity "${quantityStr}" for SKU "${sku}"`);
        skipped++;
        continue;
      }

      // Look up ProductFormat by SKU
      const format = await prisma.productFormat.findUnique({
        where: { sku },
        select: {
          id: true,
          productId: true,
          stockQuantity: true,
        },
      });

      if (!format) {
        errors.push(`Row ${rowNum}: SKU "${sku}" not found`);
        skipped++;
        continue;
      }

      const oldQuantity = format.stockQuantity;
      const adjustment = quantity - oldQuantity;

      // Get current WAC
      const lastTx = await prisma.inventoryTransaction.findFirst({
        where: {
          productId: format.productId,
          formatId: format.id,
        },
        orderBy: { createdAt: 'desc' },
        select: { runningWAC: true },
      });
      const wac = lastTx ? Number(lastTx.runningWAC) : 0;

      const cost = costStr ? parseFloat(costStr) : undefined;
      const unitCost = cost !== undefined && !isNaN(cost) ? cost : wac;

      // Update stock
      await prisma.productFormat.update({
        where: { id: format.id },
        data: {
          stockQuantity: quantity,
          availability: quantity === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK',
          ...(cost !== undefined && !isNaN(cost) ? { costPrice: cost } : {}),
        },
      });

      // Create transaction record (only if there's an actual change)
      if (adjustment !== 0) {
        await prisma.inventoryTransaction.create({
          data: {
            productId: format.productId,
            formatId: format.id,
            type: 'ADJUSTMENT',
            quantity: adjustment,
            unitCost: unitCost,
            runningWAC: unitCost,
            reason: 'CSV Import',
            createdBy: session.user.id,
          },
        });
      }

      imported++;
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: 'IMPORT_INVENTORY',
      targetType: 'Inventory',
      targetId: 'csv-import',
      newValue: { imported, skipped, total: rows.length, errorCount: errors.length },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: rows.length,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined, // Cap at 20 error messages
    });
  } catch (error) {
    console.error('Admin inventory import POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error during import' },
      { status: 500 },
    );
  }
});
