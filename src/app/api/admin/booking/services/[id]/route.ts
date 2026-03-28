export const dynamic = 'force-dynamic';

/**
 * Admin Booking Service by ID
 * GET    - Get service details
 * PUT    - Update service
 * DELETE - Delete service
 */

import { NextRequest, NextResponse } from 'next/server';
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

const updateServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullish(),
  duration: z.number().int().min(5).max(480).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().optional(),
  color: z.string().nullish(),
  isActive: z.boolean().optional(),
  maxAdvanceDays: z.number().int().min(1).max(365).optional(),
  bufferBefore: z.number().int().min(0).max(120).optional(),
  bufferAfter: z.number().int().min(0).max(120).optional(),
  sortOrder: z.number().int().optional(),
  slots: z.array(z.object({
    id: z.string().optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isActive: z.boolean().default(true),
  })).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/booking/services/[id]
export const GET = withAdminGuard(async (_request: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const service = await prisma.bookingService.findUnique({
      where: { id },
      include: {
        slots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        _count: { select: { bookings: true } },
      },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ service });
  } catch (error) {
    logger.error('[Admin Booking Service GET]', { error });
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 });
  }
});

// PUT /api/admin/booking/services/[id]
export const PUT = withAdminGuard(async (request: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const data = updateServiceSchema.parse(body);
    const { slots, ...serviceData } = data;

    // If name changes, update slug
    const updateData: Record<string, unknown> = { ...serviceData };
    if (serviceData.name) {
      updateData.slug = slugify(serviceData.name);
      // Check slug uniqueness
      const existing = await prisma.bookingService.findFirst({
        where: { slug: updateData.slug as string, NOT: { id } },
      });
      if (existing) {
        updateData.slug = `${updateData.slug}-${Date.now().toString(36)}`;
      }
    }

    // Update service and slots in a transaction
    const service = await prisma.$transaction(async (tx) => {
      // Update slots: delete all and recreate
      if (slots !== undefined) {
        await tx.bookingSlot.deleteMany({ where: { serviceId: id } });
        if (slots.length > 0) {
          await tx.bookingSlot.createMany({
            data: slots.map(s => ({
              serviceId: id,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              isActive: s.isActive,
            })),
          });
        }
      }

      return tx.bookingService.update({
        where: { id },
        data: updateData,
        include: {
          slots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
          _count: { select: { bookings: true } },
        },
      });
    });

    // Audit log
    const session = (ctx as Record<string, unknown>)?.session as { user?: { id?: string } } | undefined;
    if (session?.user?.id) {
      await logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_BOOKING_SERVICE',
        targetType: 'BookingService',
        targetId: service.id,
        newValue: updateData,
        ipAddress: getClientIpFromRequest(request),
      }).catch(() => {});
    }

    return NextResponse.json({ service });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    logger.error('[Admin Booking Service PUT]', { error });
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
});

// DELETE /api/admin/booking/services/[id]
export const DELETE = withAdminGuard(async (_request: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;

    // Check for existing bookings
    const bookingCount = await prisma.booking.count({ where: { serviceId: id } });
    if (bookingCount > 0) {
      // Soft delete: deactivate instead
      const service = await prisma.bookingService.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ service, deactivated: true, message: 'Service deactivated (has existing bookings)' });
    }

    await prisma.bookingService.delete({ where: { id } });

    // Audit log
    const session = (ctx as Record<string, unknown>)?.session as { user?: { id?: string } } | undefined;
    if (session?.user?.id) {
      await logAdminAction({
        adminUserId: session.user.id,
        action: 'DELETE_BOOKING_SERVICE',
        targetType: 'BookingService',
        targetId: id,
        ipAddress: getClientIpFromRequest(_request),
      }).catch(() => {});
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error('[Admin Booking Service DELETE]', { error });
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
});
