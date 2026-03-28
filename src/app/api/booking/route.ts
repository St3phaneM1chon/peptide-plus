export const dynamic = 'force-dynamic';

/**
 * Public Booking API
 * GET  - List active booking services (customer-facing)
 * POST - Create a new booking (customer-facing)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/security';

const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
  customerPhone: z.string().max(30).nullish(),
  startTime: z.string().datetime(),
  notes: z.string().max(1000).nullish(),
});

// GET /api/booking - List available services
export async function GET() {
  try {
    const services = await prisma.bookingService.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        duration: true,
        price: true,
        currency: true,
        color: true,
        maxAdvanceDays: true,
        sortOrder: true,
        slots: {
          where: { isActive: true },
          select: { dayOfWeek: true, startTime: true, endTime: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ services });
  } catch (error) {
    logger.error('[Public Booking GET]', { error });
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

// POST /api/booking - Create a booking
export async function POST(request: Request) {
  try {
    // Rate limit: 10 bookings per minute per IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { allowed } = checkRateLimit(`booking:${ip}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const data = createBookingSchema.parse(body);

    // Get service
    const service = await prisma.bookingService.findUnique({
      where: { id: data.serviceId },
      include: { slots: { where: { isActive: true } } },
    });

    if (!service || !service.isActive) {
      return NextResponse.json({ error: 'Service not available' }, { status: 404 });
    }

    const startTime = new Date(data.startTime);
    const now = new Date();

    // Validate: not in the past
    if (startTime <= now) {
      return NextResponse.json({ error: 'Cannot book in the past' }, { status: 400 });
    }

    // Validate: not too far in advance
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + service.maxAdvanceDays);
    if (startTime > maxDate) {
      return NextResponse.json(
        { error: `Cannot book more than ${service.maxAdvanceDays} days in advance` },
        { status: 400 }
      );
    }

    // Validate: day of week has slots
    const dayOfWeek = startTime.getDay();
    const daySlots = service.slots.filter(s => s.dayOfWeek === dayOfWeek);
    if (daySlots.length === 0) {
      return NextResponse.json({ error: 'No availability on this day' }, { status: 400 });
    }

    // Validate: startTime falls within a slot window
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const endMinutes = startMinutes + service.duration;
    const withinSlot = daySlots.some(s => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      return startMinutes >= sh * 60 + sm && endMinutes <= eh * 60 + em;
    });

    if (!withinSlot) {
      return NextResponse.json({ error: 'Selected time is outside available hours' }, { status: 400 });
    }

    const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000);

    // Check overlap (including buffer)
    const bufferStart = new Date(startTime.getTime() - service.bufferBefore * 60 * 1000);
    const bufferEnd = new Date(endTime.getTime() + service.bufferAfter * 60 * 1000);

    const overlap = await prisma.booking.findFirst({
      where: {
        serviceId: data.serviceId,
        status: { not: 'cancelled' },
        startTime: { lt: bufferEnd },
        endTime: { gt: bufferStart },
      },
    });

    if (overlap) {
      return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 409 });
    }

    const booking = await prisma.booking.create({
      data: {
        serviceId: data.serviceId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        startTime,
        endTime,
        status: 'confirmed',
        notes: data.notes,
        paymentStatus: Number(service.price) > 0 ? 'pending' : null,
        paymentAmount: Number(service.price) > 0 ? service.price : null,
      },
      include: {
        service: { select: { name: true, duration: true } },
      },
    });

    return NextResponse.json({
      booking: {
        id: booking.id,
        serviceName: booking.service.name,
        customerName: booking.customerName,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      },
      message: 'Booking confirmed successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    logger.error('[Public Booking POST]', { error });
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
