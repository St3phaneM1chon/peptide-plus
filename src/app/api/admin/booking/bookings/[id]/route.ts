export const dynamic = 'force-dynamic';

/**
 * Admin Booking by ID
 * GET    - Get booking details
 * PUT    - Update booking (status, reschedule, notes)
 * DELETE - Cancel/delete booking
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const updateBookingSchema = z.object({
  customerName: z.string().min(1).max(200).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().nullish(),
  startTime: z.string().datetime().optional(),
  status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  notes: z.string().nullish(),
  paymentStatus: z.enum(['pending', 'paid', 'refunded']).nullish(),
  paymentAmount: z.number().min(0).nullish(),
  reminderSent: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/booking/bookings/[id]
export const GET = withAdminGuard(async (_request: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        service: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ booking });
  } catch (error) {
    logger.error('[Admin Booking GET]', { error });
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
  }
});

// PUT /api/admin/booking/bookings/[id]
export const PUT = withAdminGuard(async (request: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const data = updateBookingSchema.parse(body);

    const existingBooking = await prisma.booking.findUnique({
      where: { id },
      include: { service: true },
    });
    if (!existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { ...data };

    // If rescheduling, recalculate endTime
    if (data.startTime) {
      const newStart = new Date(data.startTime);
      const newEnd = new Date(newStart.getTime() + existingBooking.service.duration * 60 * 1000);

      // Check overlap
      const overlap = await prisma.booking.findFirst({
        where: {
          serviceId: existingBooking.serviceId,
          status: { not: 'cancelled' },
          NOT: { id },
          OR: [
            { startTime: { lt: newEnd }, endTime: { gt: newStart } },
          ],
        },
      });

      if (overlap) {
        return NextResponse.json({ error: 'Time slot is already booked' }, { status: 409 });
      }

      updateData.startTime = newStart;
      updateData.endTime = newEnd;
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        service: { select: { id: true, name: true, color: true, duration: true } },
      },
    });

    // Audit log
    const session = (ctx as Record<string, unknown>)?.session as { user?: { id?: string } } | undefined;
    if (session?.user?.id) {
      await logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_BOOKING',
        targetType: 'Booking',
        targetId: id,
        previousValue: { status: existingBooking.status },
        newValue: data,
        ipAddress: getClientIpFromRequest(request),
      }).catch(() => {});
    }

    return NextResponse.json({ booking });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    logger.error('[Admin Booking PUT]', { error });
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
});

// DELETE /api/admin/booking/bookings/[id]
export const DELETE = withAdminGuard(async (_request: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Cancel instead of hard delete
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    // Audit log
    const session = (ctx as Record<string, unknown>)?.session as { user?: { id?: string } } | undefined;
    if (session?.user?.id) {
      await logAdminAction({
        adminUserId: session.user.id,
        action: 'CANCEL_BOOKING',
        targetType: 'Booking',
        targetId: id,
        previousValue: { status: booking.status },
        newValue: { status: 'cancelled' },
        ipAddress: getClientIpFromRequest(_request),
      }).catch(() => {});
    }

    return NextResponse.json({ booking: updated, cancelled: true });
  } catch (error) {
    logger.error('[Admin Booking DELETE]', { error });
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
});
