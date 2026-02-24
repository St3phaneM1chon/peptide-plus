export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

// --- Zod Schemas ---

const bundleItemSchema = z.object({
  productId: z.string().min(1).max(100),
  formatId: z.string().max(100).optional().nullable(),
  quantity: z.number().int().min(1).max(9999).default(1),
});

const createBundleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z.string().min(1, 'Slug is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  image: z.string().url().max(2000).optional().nullable(),
  discount: z.number().min(0).max(100).optional().default(0),
  isActive: z.boolean().optional().default(true),
  items: z.array(bundleItemSchema).optional(),
});

// GET all bundles (including inactive for admin)
export const GET = withAdminGuard(async (request, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    const [bundles, total] = await Promise.all([
      prisma.bundle.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          discount: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              formatId: true,
              quantity: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  price: true,
                  imageUrl: true,
                  formats: {
                    select: { id: true, name: true, price: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bundle.count(),
    ]);

    // Calculate prices for each bundle
    const bundlesWithPrices = bundles.map((bundle) => {
      let originalTotal = 0;

      const items = bundle.items.map((item) => {
        let itemPrice = Number(item.product.price);

        if (item.formatId) {
          const format = item.product.formats.find((f) => f.id === item.formatId);
          if (format) {
            itemPrice = Number(format.price);
          }
        }

        const itemTotal = itemPrice * item.quantity;
        originalTotal += itemTotal;

        return {
          ...item,
          itemPrice,
          itemTotal,
        };
      });

      const discountPercent = Number(bundle.discount);
      const bundlePrice = originalTotal * (1 - discountPercent / 100);
      const savings = originalTotal - bundlePrice;

      return {
        ...bundle,
        discount: discountPercent,
        items,
        itemCount: items.length,
        originalPrice: Math.round(originalTotal * 100) / 100,
        bundlePrice: Math.round(bundlePrice * 100) / 100,
        savings: Math.round(savings * 100) / 100,
      };
    });

    return NextResponse.json({
      bundles: bundlesWithPrices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching bundles', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch bundles' },
      { status: 500 }
    );
  }
});

// POST create new bundle
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/bundles');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Parse and validate body with Zod
    const body = await request.json();
    const parsed = createBundleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Check if slug already exists
    const existingBundle = await prisma.bundle.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });

    if (existingBundle) {
      return NextResponse.json(
        { error: 'Bundle with this slug already exists' },
        { status: 400 }
      );
    }

    // Create bundle with items
    const bundle = await prisma.bundle.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        image: data.image || null,
        discount: data.discount || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
        items: {
          create: data.items?.map((item) => ({
            productId: item.productId,
            formatId: item.formatId || null,
            quantity: item.quantity || 1,
          })) || [],
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                formats: true,
              },
            },
          },
        },
      },
    });

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_BUNDLE',
      targetType: 'Bundle',
      targetId: bundle.id,
      newValue: { name: bundle.name, slug: bundle.slug, discount: Number(bundle.discount), isActive: bundle.isActive },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ data: bundle }, { status: 201 });
  } catch (error) {
    logger.error('Error creating bundle', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create bundle' },
      { status: 500 }
    );
  }
});
