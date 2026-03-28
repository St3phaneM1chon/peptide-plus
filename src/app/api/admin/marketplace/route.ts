export const dynamic = 'force-dynamic';

/**
 * Admin Marketplace API
 * GET /api/admin/marketplace — List apps with search, category filter, pagination
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiPaginated, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// GET: List / Search / Filter app listings
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const search = searchParams.get('search')?.trim();
    const category = searchParams.get('category')?.trim();
    const pricing = searchParams.get('pricing')?.trim();
    const featured = searchParams.get('featured');
    const sortBy = searchParams.get('sort') || 'installCount'; // installCount, rating, name, createdAt
    const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { tagline: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { developerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (pricing) {
      where.pricing = pricing;
    }

    if (featured === 'true') {
      where.isFeatured = true;
    }

    // Validate sort field
    const validSortFields = ['installCount', 'rating', 'name', 'createdAt', 'monthlyPrice', 'reviewCount'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'installCount';

    const [apps, total] = await Promise.all([
      prisma.appListing.findMany({
        where,
        orderBy: { [orderByField]: sortDir },
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          category: true,
          icon: true,
          developerName: true,
          pricing: true,
          monthlyPrice: true,
          rating: true,
          reviewCount: true,
          installCount: true,
          isVerified: true,
          isFeatured: true,
          permissions: true,
          createdAt: true,
        },
      }),
      prisma.appListing.count({ where }),
    ]);

    // Get installed app IDs for this tenant
    const tenantId = request.headers.get('x-tenant-id') || '';
    let installedAppIds: string[] = [];
    if (tenantId) {
      const installs = await prisma.appInstall.findMany({
        where: { tenantId, status: 'active' },
        select: { appId: true },
      });
      installedAppIds = installs.map((i) => i.appId);
    }

    // Get distinct categories for filter UI
    const categories = await prisma.appListing.findMany({
      where: { isActive: true },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    const enrichedApps = apps.map((app) => ({
      ...app,
      monthlyPrice: app.monthlyPrice ? Number(app.monthlyPrice) : null,
      rating: Number(app.rating),
      isInstalled: installedAppIds.includes(app.id),
      _extra: {
        categories: categories.map((c) => c.category),
        installedCount: installedAppIds.length,
      },
    }));

    return apiPaginated(enrichedApps, page, limit, total);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch marketplace apps';
    return apiError(message, 'INTERNAL_ERROR');
  }
}, { skipCsrf: true });
