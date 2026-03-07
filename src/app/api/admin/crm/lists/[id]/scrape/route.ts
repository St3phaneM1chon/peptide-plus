export const dynamic = 'force-dynamic';

/**
 * Google Maps Scrape into Prospect List
 * POST /api/admin/crm/lists/[id]/scrape
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { scrapePlacesToProspects } from '@/lib/crm/google-maps-scraper';

const scrapeSchema = z.object({
  query: z.string().min(1).max(500).trim(),
  location: z.string().max(200).trim().optional(),
  radius: z.number().min(100).max(50000).optional(),
  maxResults: z.number().min(1).max(60).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
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
    radius: parsed.data.radius,
    maxResults: parsed.data.maxResults,
  });

  return apiSuccess(result, { request });
});
