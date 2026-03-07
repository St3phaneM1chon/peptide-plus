export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Google Maps Playwright Scrape into Prospect List
 * POST /api/admin/crm/lists/[id]/scrape
 *
 * Scrapes Google Maps via headless browser (no API key needed).
 * Supports infinite scroll, full detail extraction, and website email crawl.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { scrapePlacesToProspects } from '@/lib/crm/google-maps-scraper';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

const scrapeSchema = z.object({
  query: z.string().min(1).max(500).trim(),
  location: z.string().max(200).trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  zoom: z.number().int().min(3).max(21).optional(),
  maxResults: z.number().min(1).max(500).optional(),
  crawlWebsites: z.boolean().optional(),
  scrollTimeout: z.number().int().min(5000).max(120000).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }>; session: { user: { id: string } } }) => {
  const { id: listId } = await context.params;
  const body = await request.json();
  const parsed = scrapeSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  // Update list source
  if (list.source === 'MANUAL') {
    await prisma.prospectList.update({ where: { id: listId }, data: { source: 'GOOGLE_MAPS' } });
  }

  const result = await scrapePlacesToProspects(listId, {
    query: parsed.data.query,
    location: parsed.data.location,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    zoom: parsed.data.zoom,
    maxResults: parsed.data.maxResults,
    crawlWebsites: parsed.data.crawlWebsites,
    scrollTimeout: parsed.data.scrollTimeout,
  });

  // Audit trail
  logAdminAction({
    adminUserId: context.session.user.id,
    action: 'SCRAPE_PROSPECTS',
    targetType: 'ProspectList',
    targetId: listId,
    newValue: {
      query: parsed.data.query,
      location: parsed.data.location,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      added: result.added,
      duplicates: result.duplicates,
      emailsFound: result.emailsFound,
    },
    ipAddress: getClientIpFromRequest(request),
  });

  return apiSuccess(result, { request });
});
