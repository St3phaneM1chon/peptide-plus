export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
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

const updateBundleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  image: z.string().url().max(2000).optional().nullable(),
  discount: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  items: z.array(bundleItemSchema).optional(),
});

// GET single bundle by ID
export const GET = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const bundle = await prisma.bundle.findUnique({
      where: { id },
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

    if (!bundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: bundle });
  } catch (error) {
    logger.error('Error fetching bundle', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch bundle' },
      { status: 500 }
    );
  }
});

// PATCH update bundle
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;

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
    const parsed = updateBundleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Check if bundle exists
    const existingBundle = await prisma.bundle.findUnique({
      where: { id },
    });

    if (!existingBundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }

    // If slug is being changed, check if it's unique
    if (data.slug && data.slug !== existingBundle.slug) {
      const slugExists = await prisma.bundle.findUnique({
        where: { slug: data.slug },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'Bundle with this slug already exists' },
          { status: 400 }
        );
      }
    }

    // Update bundle
    const updateData: {
      name?: string;
      slug?: string;
      description?: string | null;
      image?: string | null;
      discount?: number;
      isActive?: boolean;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.discount !== undefined) updateData.discount = data.discount;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const bundle = await prisma.bundle.update({
      where: { id },
      data: updateData,
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

    // If items are provided, update them
    if (data.items) {
      // Delete existing items
      await prisma.bundleItem.deleteMany({
        where: { bundleId: id },
      });

      // Create new items
      await prisma.bundleItem.createMany({
        data: data.items.map((item) => ({
          bundleId: id,
          productId: item.productId,
          formatId: item.formatId || null,
          quantity: item.quantity || 1,
        })),
      });
    }

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_BUNDLE',
      targetType: 'Bundle',
      targetId: id,
      previousValue: { name: existingBundle.name, slug: existingBundle.slug },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ data: bundle });
  } catch (error) {
    logger.error('Error updating bundle', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to update bundle' },
      { status: 500 }
    );
  }
});

// DELETE bundle
export const DELETE = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;

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

    const bundle = await prisma.bundle.findUnique({
      where: { id },
    });

    if (!bundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }

    await prisma.bundle.delete({
      where: { id },
    });

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_BUNDLE',
      targetType: 'Bundle',
      targetId: id,
      previousValue: { name: bundle.name, slug: bundle.slug },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting bundle', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete bundle' },
      { status: 500 }
    );
  }
});
