export const dynamic = 'force-dynamic';

/**
 * Admin Booking Availability API
 * GET - Check available slots for a given service and date
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GET /api/admin/booking/availability?serviceId=xxx&date=2026-03-28
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const dateStr = searchParams.get('date');

    if (!serviceId || !dateStr) {
      return NextResponse.json({ error: 'serviceId and date are required' }, { status: 400 });
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const service = await prisma.bookingService.findUnique({
      where: { id: serviceId },
      include: { slots: { where: { isActive: true } } },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const dayOfWeek = date.getDay();
    const daySlots = service.slots.filter(s => s.dayOfWeek === dayOfWeek);

    if (daySlots.length === 0) {
      return NextResponse.json({ availableSlots: [], message: 'No availability on this day' });
    }

    // Get existing bookings for this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await prisma.booking.findMany({
      where: {
        serviceId,
        status: { not: 'cancelled' },
        startTime: { gte: startOfDay, lte: endOfDay },
      },
      select: { startTime: true, endTime: true },
    });

    // Generate available time slots
    const totalDuration = service.duration + service.bufferBefore + service.bufferAfter;
    const availableSlots: { startTime: string; endTime: string; available: boolean }[] = [];

    for (const slot of daySlots) {
      const [startH, startM] = slot.startTime.split(':').map(Number);
      const [endH, endM] = slot.endTime.split(':').map(Number);

      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      while (currentMinutes + service.duration <= endMinutes) {
        const slotStart = new Date(date);
        slotStart.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + service.duration * 60 * 1000);

        // Check buffer zone
        const bufferStart = new Date(slotStart.getTime() - service.bufferBefore * 60 * 1000);
        const bufferEnd = new Date(slotEnd.getTime() + service.bufferAfter * 60 * 1000);

        const isAvailable = !existingBookings.some(b => {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bufferStart < bEnd && bufferEnd > bStart;
        });

        availableSlots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          available: isAvailable,
        });

        currentMinutes += totalDuration;
      }
    }

    return NextResponse.json({
      service: { id: service.id, name: service.name, duration: service.duration },
      date: dateStr,
      availableSlots,
    });
  } catch (error) {
    logger.error('[Admin Booking Availability GET]', { error });
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 });
  }
});
