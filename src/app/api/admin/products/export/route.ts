export const dynamic = 'force-dynamic';

/**
 * Admin Products Export API
 * GET - Export all products as CSV with their formats
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

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

// GET /api/admin/products/export - Export all products as CSV
export async function GET() {
  try {
    const session = await auth();
    if (
      !session?.user ||
      (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const products = await prisma.product.findMany({
      include: {
        category: {
          select: { id: true, name: true },
        },
        formats: {
          select: {
            id: true,
            name: true,
            formatType: true,
            price: true,
            comparePrice: true,
            sku: true,
            stockQuantity: true,
            lowStockThreshold: true,
            availability: true,
            dosageMg: true,
            volumeMl: true,
            unitCount: true,
            isActive: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // CSV Header
    const headers = [
      'id',
      'name',
      'slug',
      'productType',
      'categoryId',
      'categoryName',
      'description',
      'shortDescription',
      'isActive',
      'isFeatured',
      'isNew',
      'isBestseller',
      'price',
      'compareAtPrice',
      'purity',
      'molecularWeight',
      'casNumber',
      'molecularFormula',
      'sku',
      'manufacturer',
      'origin',
      'imageUrl',
      'createdAt',
      // Format fields (concatenated)
      'formats_count',
      'formats_names',
      'formats_skus',
      'formats_prices',
      'formats_stocks',
      'formats_types',
    ];

    const lines: string[] = [csvRow(headers)];

    for (const product of products) {
      const formatNames = product.formats.map((f) => f.name).join(' | ');
      const formatSkus = product.formats.map((f) => f.sku || '').join(' | ');
      const formatPrices = product.formats.map((f) => Number(f.price).toFixed(2)).join(' | ');
      const formatStocks = product.formats.map((f) => f.stockQuantity).join(' | ');
      const formatTypes = product.formats.map((f) => f.formatType).join(' | ');

      lines.push(
        csvRow([
          product.id,
          product.name,
          product.slug,
          product.productType,
          product.categoryId,
          product.category.name,
          product.description,
          product.shortDescription,
          product.isActive,
          product.isFeatured,
          product.isNew,
          product.isBestseller,
          Number(product.price).toFixed(2),
          product.compareAtPrice ? Number(product.compareAtPrice).toFixed(2) : '',
          product.purity ? Number(product.purity).toFixed(2) : '',
          product.molecularWeight ? Number(product.molecularWeight).toFixed(2) : '',
          product.casNumber,
          product.molecularFormula,
          product.sku,
          product.manufacturer,
          product.origin,
          product.imageUrl,
          product.createdAt.toISOString(),
          product.formats.length,
          formatNames,
          formatSkus,
          formatPrices,
          formatStocks,
          formatTypes,
        ])
      );
    }

    const csv = lines.join('\n');
    const timestamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="products-export-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Admin products export GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
