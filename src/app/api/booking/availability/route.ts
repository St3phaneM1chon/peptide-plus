export const dynamic = 'force-dynamic';

/**
 * Public Booking Availability API
 * GET - Check available time slots for a service on a given date
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET /api/booking/availability?serviceId=xxx&date=2026-03-28
export async function GET(request: NextRequest) {
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

    // Validate: not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return NextResponse.json({ availableSlots: [] });
    }

    const service = await prisma.bookingService.findUnique({
      where: { id: serviceId },
      include: { slots: { where: { isActive: true } } },
    });

    if (!service || !service.isActive) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Validate: not too far in advance
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + service.maxAdvanceDays);
    if (date > maxDate) {
      return NextResponse.json({ availableSlots: [], message: 'Date too far in advance' });
    }

    const dayOfWeek = date.getDay();
    const daySlots = service.slots.filter(s => s.dayOfWeek === dayOfWeek);

    if (daySlots.length === 0) {
      return NextResponse.json({ availableSlots: [] });
    }

    // Get existing bookings for this day
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
    const now = new Date();
    const availableSlots: { startTime: string; endTime: string }[] = [];

    for (const slot of daySlots) {
      const [startH, startM] = slot.startTime.split(':').map(Number);
      const [endH, endM] = slot.endTime.split(':').map(Number);

      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      while (currentMinutes + service.duration <= endMinutes) {
        const slotStart = new Date(date);
        slotStart.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + service.duration * 60 * 1000);

        // Skip past slots
        if (slotStart <= now) {
          currentMinutes += totalDuration;
          continue;
        }

        // Check buffer zone overlap
        const bufferStart = new Date(slotStart.getTime() - service.bufferBefore * 60 * 1000);
        const bufferEnd = new Date(slotEnd.getTime() + service.bufferAfter * 60 * 1000);

        const isAvailable = !existingBookings.some(b => {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bufferStart < bEnd && bufferEnd > bStart;
        });

        if (isAvailable) {
          availableSlots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
          });
        }

        currentMinutes += totalDuration;
      }
    }

    return NextResponse.json({
      service: { id: service.id, name: service.name, duration: service.duration, price: service.price, currency: service.currency },
      date: dateStr,
      availableSlots,
    });
  } catch (error) {
    logger.error('[Public Booking Availability GET]', { error });
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 });
  }
}
