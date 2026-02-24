export const dynamic = 'force-dynamic';

/**
 * Admin Products Import API
 * POST - Import products from a CSV or JSON file (multipart/form-data) (item 73)
 * Upserts: updates existing products if slug matches, creates new ones otherwise
 *
 * Accepts:
 *   - CSV files (.csv): Standard CSV with headers matching product fields
 *   - JSON files (.json): Array of product objects or { products: [...] } wrapper
 *     JSON format matches the output of GET /api/admin/products/export?format=json
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// CSV parsing with proper quote handling
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ',') {
        fields.push(current.trim());
        current = '';
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // Push the last field
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string): Record<string, string>[] {
  // Normalize line endings and split
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Filter empty lines
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < 2) return []; // Need header + at least 1 data row

  const headers = parseCSVLine(nonEmpty[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseCSVLine(nonEmpty[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function parseBool(val: string): boolean {
  const lower = val.toLowerCase().trim();
  return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'oui';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const VALID_PRODUCT_TYPES = ['PEPTIDE', 'SUPPLEMENT', 'ACCESSORY', 'BUNDLE', 'CAPSULE', 'LAB_SUPPLY'];

interface ImportError {
  row: number;
  message: string;
}

// POST /api/admin/products/import - Import products from CSV
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    // Fix 4: Request body size limit (5MB for CSV imports)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5_000_000) {
      return NextResponse.json(
        { error: 'Request body too large. Maximum file size: 5MB' },
        { status: 413 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded. Send a CSV file in a "file" form field.' },
        { status: 400 }
      );
    }

    // Item 73: Support both CSV and JSON file formats
    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';
    const isJSON = file.name.endsWith('.json') || file.type === 'application/json';

    if (!isCSV && !isJSON) {
      return NextResponse.json(
        { error: 'Only CSV and JSON files are accepted.' },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();

    // Parse rows from either CSV or JSON
    let rows: Record<string, string>[];

    if (isJSON) {
      // Item 73: JSON import support
      try {
        const parsed = JSON.parse(text);
        // Support both { products: [...] } and direct array format
        const productsArray = Array.isArray(parsed) ? parsed : parsed.products;
        if (!Array.isArray(productsArray)) {
          return NextResponse.json(
            { error: 'JSON file must contain an array of products or a { products: [...] } object.' },
            { status: 400 }
          );
        }
        // Convert JSON objects to string records (same shape as CSV rows)
        rows = productsArray.map((p: Record<string, unknown>) => {
          const row: Record<string, string> = {};
          for (const [key, value] of Object.entries(p)) {
            if (key === 'formats' || key === 'createdAt' || key === 'id') continue; // Skip non-importable fields
            row[key] = value !== null && value !== undefined ? String(value) : '';
          }
          return row;
        });
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON file. Could not parse.' },
          { status: 400 }
        );
      }
    } else {
      rows = parseCSV(text);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or has no data rows.' },
        { status: 400 }
      );
    }

    // Check required columns
    const requiredColumns = ['name'];
    const firstRow = rows[0];
    const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missingColumns.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch all categories for lookup
    const allCategories = await prisma.category.findMany({
      select: { id: true, name: true, slug: true },
    });
    const categoryById = new Map(allCategories.map((c) => [c.id, c]));
    const categoryByName = new Map(allCategories.map((c) => [c.name.toLowerCase(), c]));

    // Default category (first one if exists)
    const defaultCategory = allCategories[0];

    let created = 0;
    let updated = 0;
    const errors: ImportError[] = [];

    // N+1 FIX: Batch-fetch all existing products by slug upfront
    const allSlugs = rows
      .map((row) => {
        const name = row.name?.trim();
        if (!name) return null;
        return row.slug?.trim() || slugify(name);
      })
      .filter(Boolean) as string[];
    const existingProducts = await prisma.product.findMany({
      where: { slug: { in: allSlugs } },
      select: { id: true, slug: true },
    });
    const existingProductMap = new Map(existingProducts.map((p) => [p.slug, p.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header, data starts at row 2

      try {
        // Validate required fields
        const name = row.name?.trim();
        if (!name) {
          errors.push({ row: rowNum, message: 'Missing product name' });
          continue;
        }

        // Determine slug
        const slug = row.slug?.trim() || slugify(name);
        if (!slug) {
          errors.push({ row: rowNum, message: 'Could not generate slug from name' });
          continue;
        }

        // Resolve category
        let categoryId: string | null = null;

        if (row.categoryId?.trim()) {
          const cat = categoryById.get(row.categoryId.trim());
          if (cat) {
            categoryId = cat.id;
          } else {
            errors.push({ row: rowNum, message: `Category ID "${row.categoryId}" not found` });
            continue;
          }
        } else if (row.categoryName?.trim()) {
          const cat = categoryByName.get(row.categoryName.trim().toLowerCase());
          if (cat) {
            categoryId = cat.id;
          } else {
            errors.push({ row: rowNum, message: `Category name "${row.categoryName}" not found` });
            continue;
          }
        } else {
          // Use default category
          if (defaultCategory) {
            categoryId = defaultCategory.id;
          } else {
            errors.push({ row: rowNum, message: 'No category specified and no default category exists' });
            continue;
          }
        }

        // Parse product type
        const productTypeRaw = row.productType?.trim().toUpperCase() || 'PEPTIDE';
        const productType = VALID_PRODUCT_TYPES.includes(productTypeRaw) ? productTypeRaw : 'PEPTIDE';

        // Parse price
        const priceStr = row.price?.trim();
        const price = priceStr ? parseFloat(priceStr) : 0;
        if (isNaN(price) || price < 0) {
          errors.push({ row: rowNum, message: `Invalid price: "${priceStr}"` });
          continue;
        }

        // Parse optional numeric fields
        const compareAtPrice = row.compareAtPrice?.trim()
          ? parseFloat(row.compareAtPrice)
          : null;
        const purity = row.purity?.trim() ? parseFloat(row.purity) : null;
        const molecularWeight = row.molecularWeight?.trim()
          ? parseFloat(row.molecularWeight)
          : null;

        // Parse boolean fields
        const isActive = row.isActive !== undefined ? parseBool(row.isActive) : true;
        const isFeatured = row.isFeatured !== undefined ? parseBool(row.isFeatured) : false;
        const isNew = row.isNew !== undefined ? parseBool(row.isNew) : false;
        const isBestseller = row.isBestseller !== undefined ? parseBool(row.isBestseller) : false;

        // Build data object
        const data = {
          name,
          productType: productType as 'PEPTIDE' | 'SUPPLEMENT' | 'ACCESSORY' | 'BUNDLE' | 'CAPSULE' | 'LAB_SUPPLY',
          categoryId,
          description: row.description?.trim() || null,
          shortDescription: row.shortDescription?.trim() || null,
          price,
          compareAtPrice,
          purity,
          molecularWeight,
          casNumber: row.casNumber?.trim() || null,
          molecularFormula: row.molecularFormula?.trim() || null,
          sku: row.sku?.trim() || null,
          manufacturer: row.manufacturer?.trim() || null,
          origin: row.origin?.trim() || null,
          imageUrl: row.imageUrl?.trim() || null,
          isActive,
          isFeatured,
          isNew,
          isBestseller,
        };

        // N+1 FIX: Use pre-fetched map instead of individual DB query per row
        const existingId = existingProductMap.get(slug);

        if (existingId) {
          // Update existing product
          await prisma.product.update({
            where: { slug },
            data,
          });
          updated++;
        } else {
          // Create new product
          await prisma.product.create({
            data: {
              ...data,
              slug,
            },
          });
          // Track newly created products in the map to handle duplicate slugs within the same import
          existingProductMap.set(slug, 'new');
          created++;
        }
      } catch (err) {
        console.error('[ProductImport] Failed to import product at row:', rowNum, err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ row: rowNum, message });
      }
    }

    // Audit log for product import (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'IMPORT_PRODUCTS',
      targetType: 'Product',
      targetId: `import_${rows.length}`,
      newValue: { totalRows: rows.length, created, updated, errorCount: errors.length },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: rows.length,
        created,
        updated,
        errors,
      },
    });
  } catch (error) {
    logger.error('Admin products import POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
