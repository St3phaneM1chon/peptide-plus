export const dynamic = 'force-dynamic';

/**
 * Admin Inventory Export API
 * GET - Export inventory (product formats with stock info) as CSV
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines
function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values.map(csvEscape).join(',');
}

// GET /api/admin/inventory/export - Export inventory as CSV
export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    // FIX: BUG-068 - Include all formats (not just active+tracked) with flags for full audit
    const formats = await prisma.productFormat.findMany({
      where: {
        trackInventory: true, // Keep trackInventory filter (non-tracked items have no stock to report)
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { product: { name: 'asc' } },
        { sortOrder: 'asc' },
      ],
    });

    // CSV Header
    const headers = [
      'productId',
      'productName',
      'productSlug',
      'productSku',
      'formatId',
      'formatName',
      'formatType',
      'sku',
      'price',
      'costPrice',
      'stockQuantity',
      'lowStockThreshold',
      'availability',
      'inStock',
      'isActive',
      'productActive',
    ];

    const lines: string[] = [csvRow(headers)];

    for (const format of formats) {
      lines.push(
        csvRow([
          format.product.id,
          format.product.name,
          format.product.slug,
          format.product.sku,
          format.id,
          format.name,
          format.formatType,
          format.sku,
          Number(format.price).toFixed(2),
          format.costPrice ? Number(format.costPrice).toFixed(2) : '',
          format.stockQuantity,
          format.lowStockThreshold,
          format.availability,
          format.inStock,
          format.isActive,
          format.product.isActive,
        ])
      );
    }

    const csv = lines.join('\n');
    const timestamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventory-export-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    logger.error('Admin inventory export GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
