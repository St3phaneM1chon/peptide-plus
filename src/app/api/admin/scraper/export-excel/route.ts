export const dynamic = 'force-dynamic';

/**
 * Google Maps Scraper — Excel Export
 * POST /api/admin/scraper/export-excel
 *
 * Accepts pre-scraped results array OR scrape params.
 * If results are provided, exports directly (instant).
 * If only query params, re-scrapes (slow, legacy support).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiError } from '@/lib/api-response';
import ExcelJS from 'exceljs';

const placeSchema = z.object({
  name: z.string(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  googleRating: z.number().nullable().optional(),
  googleReviewCount: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  openingHours: z.array(z.string()).nullable().optional(),
  googleMapsUrl: z.string().nullable().optional(),
});

const exportSchema = z.object({
  results: z.array(placeSchema).min(1, 'Results are required for export'),
});

const COLUMNS = [
  { header: 'Nom', key: 'name', width: 30 },
  { header: 'Adresse', key: 'address', width: 40 },
  { header: 'Ville', key: 'city', width: 20 },
  { header: 'Province', key: 'province', width: 10 },
  { header: 'Code Postal', key: 'postalCode', width: 12 },
  { header: 'Pays', key: 'country', width: 10 },
  { header: 'T\u00e9l\u00e9phone', key: 'phone', width: 18 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Site Web', key: 'website', width: 35 },
  { header: 'Note Google', key: 'googleRating', width: 12 },
  { header: 'Avis Google', key: 'googleReviewCount', width: 12 },
  { header: 'Cat\u00e9gorie', key: 'category', width: 25 },
  { header: 'Latitude', key: 'latitude', width: 14 },
  { header: 'Longitude', key: 'longitude', width: 14 },
  { header: 'Lien Google Maps', key: 'googleMapsUrl', width: 50 },
];

export const POST = withAdminGuard(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'VALIDATION_ERROR', { status: 400, request });
  }

  const parsed = exportSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  try {
    const results = parsed.data.results;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BioCycle Peptides - LeadEngine';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Google Maps', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = COLUMNS;

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const place of results) {
      sheet.addRow({
        name: place.name,
        address: place.address || '',
        city: place.city || '',
        province: place.province || '',
        postalCode: place.postalCode || '',
        country: place.country || '',
        phone: place.phone || '',
        email: place.email || '',
        website: place.website || '',
        googleRating: place.googleRating,
        googleReviewCount: place.googleReviewCount,
        category: place.category || '',
        latitude: place.latitude,
        longitude: place.longitude,
        googleMapsUrl: place.googleMapsUrl || '',
      });
    }

    sheet.autoFilter = {
      from: 'A1',
      to: `O${results.length + 1}`,
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().slice(0, 10);

    return new Response(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="google-maps-export-${today}.xlsx"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return apiError('Google Maps export failed', 'EXTERNAL_SERVICE_ERROR', { status: 502, details: message, request });
  }
}, { rateLimit: 10 });
