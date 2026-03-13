export const dynamic = 'force-dynamic';

/**
 * Add scraped places to CRM as Prospects
 * POST /api/admin/scraper/add-to-crm
 *
 * Creates a ProspectList (or uses existing) and saves scraped places as Prospects.
 * Runs dedup + lead scoring automatically.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

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

const addToCrmSchema = z.object({
  places: z.array(placeSchema).min(1).max(500),
  listName: z.string().max(200).optional(),
  prospectListId: z.string().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'VALIDATION_ERROR', { status: 400, request });
  }

  const parsed = addToCrmSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return apiError('User not authenticated', 'UNAUTHORIZED', { status: 401, request });
  }

  try {
    const { places, listName, prospectListId } = parsed.data;

    // Get or create prospect list
    let listId = prospectListId;
    if (!listId) {
      const list = await prisma.prospectList.create({
        data: {
          name: listName || `Scrape Import ${new Date().toLocaleDateString('fr-CA')}`,
          source: 'GOOGLE_MAPS',
          status: 'ACTIVE',
          createdById: userId,
          sourceQuery: places[0]?.category || 'Google Maps',
        },
      });
      listId = list.id;
    }

    // Bulk create prospects with dedup by name+address+phone
    const existingProspects = await prisma.prospect.findMany({
      where: { listId },
      select: { contactName: true, address: true, phone: true, id: true },
    });

    const existingKeys = new Set(
      existingProspects.map(p => dedupKey(p.contactName, p.address, p.phone))
    );

    let added = 0;
    let dupes = 0;
    const createdIds: string[] = [];

    for (const place of places) {
      const key = dedupKey(place.name, place.address ?? null, place.phone ?? null);
      if (existingKeys.has(key)) {
        dupes++;
        continue;
      }
      existingKeys.add(key);

      const prospect = await prisma.prospect.create({
        data: {
          listId,
          contactName: place.name,
          companyName: place.name,
          email: place.email ?? null,
          phone: place.phone ?? null,
          website: place.website ?? null,
          address: place.address ?? null,
          city: place.city ?? null,
          province: place.province ?? null,
          postalCode: place.postalCode ?? null,
          country: place.country ?? null,
          googleRating: place.googleRating ?? null,
          googleReviewCount: place.googleReviewCount ?? null,
          googleCategory: place.category ?? null,
          latitude: place.latitude ?? null,
          longitude: place.longitude ?? null,
          openingHours: place.openingHours ? { days: place.openingHours } : undefined,
          enrichmentSource: place.email ? 'website_crawl' : null,
          enrichedAt: place.email ? new Date() : null,
          status: 'NEW',
        },
      });
      createdIds.push(prospect.id);
      added++;
    }

    // Update list counters
    await prisma.prospectList.update({
      where: { id: listId },
      data: {
        totalCount: { increment: added },
      },
    });

    // Auto-dedup intra-list then score (non-blocking, fire-and-forget)
    if (added > 0) {
      (async () => {
        try {
          const { autoDeduplicateList } = await import('@/lib/crm/prospect-dedup');
          await autoDeduplicateList(listId);
        } catch (e) {
          console.error('Auto-dedup failed:', e);
        }
        try {
          const { scoreProspectList } = await import('@/lib/crm/lead-scoring');
          await scoreProspectList(listId);
        } catch (e) {
          console.error('Lead scoring failed:', e);
        }
      })();
    }

    return apiSuccess({
      listId,
      added,
      duplicates: dupes,
      total: places.length,
      prospectIds: createdIds,
    }, { status: 201, request });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'CRM import failed';
    return apiError('Failed to add to CRM', 'INTERNAL_ERROR', { status: 500, details: message, request });
  }
}, { rateLimit: 10 });

function dedupKey(name: string, address: string | null, phone: string | null): string {
  const n = name.toLowerCase().trim();
  const a = (address || '').toLowerCase().trim().slice(0, 50);
  const p = (phone || '').replace(/\D/g, '').slice(-10);
  return `${n}|${a}|${p}`;
}
