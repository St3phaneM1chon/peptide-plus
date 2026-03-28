export const dynamic = 'force-dynamic';

/**
 * Admin Booking Services API
 * GET  - List all booking services
 * POST - Create a new booking service
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const createServiceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().nullish(),
  duration: z.number().int().min(5).max(480),
  price: z.number().min(0).default(0),
  currency: z.string().default('CAD'),
  color: z.string().nullish(),
  isActive: z.boolean().default(true),
  maxAdvanceDays: z.number().int().min(1).max(365).default(30),
  bufferBefore: z.number().int().min(0).max(120).default(0),
  bufferAfter: z.number().int().min(0).max(120).default(0),
  sortOrder: z.number().int().default(0),
  slots: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isActive: z.boolean().default(true),
  })).optional(),
});

// GET /api/admin/booking/services
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const services = await prisma.bookingService.findMany({
      where,
      include: {
        slots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        _count: { select: { bookings: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ services });
  } catch (error) {
    logger.error('[Admin Booking Services GET]', { error });
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
});

// POST /api/admin/booking/services
export const POST = withAdminGuard(async (request, ctx) => {
  try {
    const body = await request.json();
    const data = createServiceSchema.parse(body);
    const { slots, ...serviceData } = data;

    // Generate slug
    let slug = slugify(serviceData.name);
    // Check uniqueness within tenant (tenant auto-injected by prisma middleware)
    const existing = await prisma.bookingService.findFirst({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const service = await prisma.bookingService.create({
      data: {
        ...serviceData,
        price: serviceData.price,
        slug,
        slots: slots && slots.length > 0
          ? { create: slots }
          : undefined,
      },
      include: {
        slots: true,
      },
    });

    // Audit log
    const session = ctx?.session;
    if (session?.user?.id) {
      await logAdminAction({
        adminUserId: session.user.id,
        action: 'CREATE_BOOKING_SERVICE',
        targetType: 'BookingService',
        targetId: service.id,
        newValue: { name: service.name, duration: service.duration, price: service.price },
        ipAddress: getClientIpFromRequest(request),
      }).catch(() => {});
    }

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    logger.error('[Admin Booking Services POST]', { error });
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
});
