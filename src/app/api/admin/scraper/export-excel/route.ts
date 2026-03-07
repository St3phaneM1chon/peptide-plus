export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Google Maps Playwright Scraper — Excel Export
 * POST /api/admin/scraper/export-excel
 *
 * Scrapes Google Maps and returns an .xlsx file.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiError } from '@/lib/api-response';
import { scrapeGoogleMaps } from '@/lib/scraper/google-maps-playwright';
import ExcelJS from 'exceljs';

const exportSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500).trim(),
  location: z.string().max(200).trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  zoom: z.number().int().min(3).max(21).optional(),
  maxResults: z.number().int().min(1).max(500).optional().default(100),
  crawlWebsites: z.boolean().optional().default(true),
  scrollTimeout: z.number().int().min(5000).max(120000).optional().default(30000),
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
    const results = await scrapeGoogleMaps({
      query: parsed.data.query,
      location: parsed.data.location,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      zoom: parsed.data.zoom,
      maxResults: parsed.data.maxResults,
      crawlWebsites: parsed.data.crawlWebsites,
      scrollTimeout: parsed.data.scrollTimeout,
    });

    // Build Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BioCycle Peptides - LeadEngine';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Google Maps', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = COLUMNS;

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
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

    // Auto-filter
    sheet.autoFilter = {
      from: 'A1',
      to: `O${results.length + 1}`,
    };

    // Generate buffer
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
}, { rateLimit: 3 });
