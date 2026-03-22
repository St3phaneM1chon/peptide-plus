export const dynamic = 'force-dynamic';

/**
 * Admin Inventory Export API
 * GET - Export inventory (product options with stock info) as CSV
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines
function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // CSV formula injection protection
  if (/^[=+\-@\t\r]/.test(str)) { str = `'${str}`; }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values.map(csvEscape).join(',');
}

// GET /api/admin/inventory/export - Export inventory as CSV
export const GET = withAdminGuard(async (request, _ctx) => {
  try {
    // FIX: BUG-068 - Support includeInactive query param to include inactive options
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // A7-P2-003: Add take limit to prevent OOM on large inventory exports
    const options = await prisma.productOption.findMany({
      where: {
        trackInventory: true, // Keep trackInventory filter (non-tracked items have no stock to report)
        ...(includeInactive ? {} : { isActive: true }),
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
      take: 10000, // Safety limit for export operations
    });

    // CSV Header
    const headers = [
      'productId',
      'productName',
      'productSlug',
      'productSku',
      'optionId',
      'optionName',
      'optionType',
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

    for (const format of options) {
      lines.push(
        csvRow([
          format.product.id,
          format.product.name,
          format.product.slug,
          format.product.sku,
          format.id,
          format.name,
          format.optionType,
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

    // UTF-8 BOM for Excel compatibility with French accents
    const csv = '\uFEFF' + lines.join('\n');
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
