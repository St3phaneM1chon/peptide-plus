export const dynamic = 'force-dynamic';

/**
 * Admin Products Export API
 * GET - Export all products as CSV or JSON with their formats (item 73)
 *
 * Query params:
 *   format=csv (default) | json
 *
 * JSON export includes full product data with formats, suitable for
 * re-import via POST /api/admin/products/import.
 */

import { NextRequest, NextResponse } from 'next/server';
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

// GET /api/admin/products/export?format=csv|json - Export all products (item 73)
export const GET = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const exportFormat = searchParams.get('format') || 'csv';

    // BUG-054 FIX: Get total count first so we can report truncation accurately
    const totalCount = await prisma.product.count();

    // P-06 fix: Limit to 5000 records max to prevent OOM on large catalogs.
    // Select only fields used in CSV and JSON export generation.
    const products = await prisma.product.findMany({
      take: 5000,
      select: {
        id: true,
        name: true,
        slug: true,
        productType: true,
        categoryId: true,
        description: true,
        shortDescription: true,
        isActive: true,
        isFeatured: true,
        isNew: true,
        isBestseller: true,
        price: true,
        compareAtPrice: true,
        purity: true,
        molecularWeight: true,
        casNumber: true,
        molecularFormula: true,
        sku: true,
        manufacturer: true,
        origin: true,
        imageUrl: true,
        createdAt: true,
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

    // BUG-054 FIX: Detect and warn if export is truncated at 5000 records
    const isTruncated = totalCount > 5000;
    if (isTruncated) {
      logger.warn('Product export truncated', {
        exportedCount: products.length,
        totalCount,
        truncatedCount: totalCount - products.length,
      });
    }

    // Item 73: JSON export support
    if (exportFormat === 'json') {
      const jsonProducts = products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        productType: product.productType,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        description: product.description,
        shortDescription: product.shortDescription,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        isNew: product.isNew,
        isBestseller: product.isBestseller,
        price: Number(product.price),
        compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
        purity: product.purity ? Number(product.purity) : null,
        molecularWeight: product.molecularWeight ? Number(product.molecularWeight) : null,
        casNumber: product.casNumber,
        molecularFormula: product.molecularFormula,
        sku: product.sku,
        manufacturer: product.manufacturer,
        origin: product.origin,
        imageUrl: product.imageUrl,
        createdAt: product.createdAt.toISOString(),
        formats: product.formats.map((f) => ({
          id: f.id,
          name: f.name,
          formatType: f.formatType,
          price: Number(f.price),
          comparePrice: f.comparePrice ? Number(f.comparePrice) : null,
          sku: f.sku,
          stockQuantity: f.stockQuantity,
          lowStockThreshold: f.lowStockThreshold,
          availability: f.availability,
          dosageMg: f.dosageMg,
          volumeMl: f.volumeMl,
          unitCount: f.unitCount,
          isActive: f.isActive,
          sortOrder: f.sortOrder,
        })),
      }));

      const timestamp = new Date().toISOString().slice(0, 10);
      // BUG-054 FIX: Include total count and truncation info in JSON export
      const jsonString = JSON.stringify({
        products: jsonProducts,
        exportedAt: new Date().toISOString(),
        count: jsonProducts.length,
        totalCount,
        ...(isTruncated
          ? { truncated: true, warning: `Export limited to 5000 of ${totalCount} products. Use filters or the API with pagination to access all records.` }
          : {}),
      }, null, 2);

      return new NextResponse(jsonString, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="products-export-${timestamp}.json"`,
        },
      });
    }

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

    // BUG-054 FIX: Add footer row indicating export count and truncation status
    if (isTruncated) {
      lines.push(csvRow([`# EXPORT TRUNCATED: ${products.length} of ${totalCount} total products exported. Use filters or the API with pagination to access all records.`]));
    } else {
      lines.push(csvRow([`# Total exported: ${products.length} products`]));
    }

    const csv = lines.join('\n');
    const timestamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="products-export-${timestamp}.csv"`,
        // BUG-054 FIX: Add custom headers so the admin client can detect truncation
        'X-Export-Count': String(products.length),
        'X-Export-Total': String(totalCount),
        ...(isTruncated ? { 'X-Export-Truncated': 'true' } : {}),
      },
    });
  } catch (error) {
    logger.error('Admin products export GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
