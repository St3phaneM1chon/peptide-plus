export const dynamic = 'force-dynamic';

/**
 * Admin Bookings API
 * GET  - List bookings (calendar view, filterable)
 * POST - Create a booking (admin-side manual booking)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
  customerPhone: z.string().nullish(),
  customerId: z.string().nullish(),
  startTime: z.string().datetime(),
  notes: z.string().nullish(),
  status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']).default('confirmed'),
  paymentStatus: z.enum(['pending', 'paid', 'refunded']).nullish(),
  paymentAmount: z.number().min(0).nullish(),
});

// GET /api/admin/booking/bookings
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = (page - 1) * limit;
    const view = searchParams.get('view'); // 'calendar' for calendar data

    const where: Record<string, unknown> = {};
    if (serviceId) where.serviceId = serviceId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (from || to) {
      where.startTime = {};
      if (from) (where.startTime as Record<string, unknown>).gte = new Date(from);
      if (to) (where.startTime as Record<string, unknown>).lte = new Date(to);
    }

    if (view === 'calendar') {
      // Calendar view: return all bookings in range without pagination
      const bookings = await prisma.booking.findMany({
        where,
        include: {
          service: { select: { id: true, name: true, color: true, duration: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 500,
      });
      return NextResponse.json({ bookings });
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          service: { select: { id: true, name: true, color: true, duration: true } },
        },
        orderBy: { startTime: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.booking.count({ where }),
    ]);

    return NextResponse.json({
      bookings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('[Admin Bookings GET]', { error });
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
});

// POST /api/admin/booking/bookings
export const POST = withAdminGuard(async (request, ctx) => {
  try {
    const body = await request.json();
    const data = createBookingSchema.parse(body);

    // Get service to compute endTime
    const service = await prisma.bookingService.findUnique({
      where: { id: data.serviceId },
    });
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const startTime = new Date(data.startTime);
    const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000);

    // Check for overlapping bookings
    const overlap = await prisma.booking.findFirst({
      where: {
        serviceId: data.serviceId,
        status: { not: 'cancelled' },
        OR: [
          { startTime: { lt: endTime }, endTime: { gt: startTime } },
        ],
      },
    });

    if (overlap) {
      return NextResponse.json({ error: 'Time slot is already booked' }, { status: 409 });
    }

    const booking = await prisma.booking.create({
      data: {
        serviceId: data.serviceId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerId: data.customerId,
        startTime,
        endTime,
        status: data.status,
        notes: data.notes,
        paymentStatus: data.paymentStatus,
        paymentAmount: data.paymentAmount,
      },
      include: {
        service: { select: { id: true, name: true, color: true, duration: true } },
      },
    });

    // Audit log
    const session = ctx?.session;
    if (session?.user?.id) {
      await logAdminAction({
        adminUserId: session.user.id,
        action: 'CREATE_BOOKING',
        targetType: 'Booking',
        targetId: booking.id,
        newValue: { customerName: data.customerName, serviceId: data.serviceId, startTime: data.startTime },
        ipAddress: getClientIpFromRequest(request),
      }).catch(() => {});
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    logger.error('[Admin Bookings POST]', { error });
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
});
