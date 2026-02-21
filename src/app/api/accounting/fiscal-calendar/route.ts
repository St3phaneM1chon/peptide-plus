import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getUpcomingDeadlines, FISCAL_DEADLINES } from '@/lib/accounting/canadian-tax-config';

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';

    // Get events from database
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const events = await prisma.fiscalCalendarEvent.findMany({
      where: {
        ...where,
        dueDate: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31),
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Get upcoming deadlines from config (next 90 days)
    const upcomingFromConfig = getUpcomingDeadlines(90);

    // Stats
    const stats = {
      total: events.length,
      pending: events.filter(e => e.status === 'PENDING').length,
      completed: events.filter(e => e.status === 'COMPLETED').length,
      overdue: events.filter(e => e.status === 'PENDING' && new Date(e.dueDate) < new Date()).length,
    };

    return NextResponse.json({ events, upcomingFromConfig, stats, year });
  } catch (error) {
    console.error('Fiscal calendar error:', error);
    return NextResponse.json({ error: 'Failed to fetch fiscal calendar' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { title, titleFr, description, descriptionFr, dueDate, category, authority, frequency, amount, isRecurring, templateId, reminderDate } = body;

    const event = await prisma.fiscalCalendarEvent.create({
      data: {
        title,
        titleFr: titleFr || null,
        description: description || null,
        descriptionFr: descriptionFr || null,
        dueDate: new Date(dueDate),
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        category: category || 'other',
        authority: authority || 'CRA',
        frequency: frequency || 'once',
        amount: amount ? parseFloat(amount) : null,
        isRecurring: isRecurring || false,
        templateId: templateId || null,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('Create fiscal event error:', error);
    return NextResponse.json({ error: 'Failed to create fiscal event' }, { status: 500 });
  }
});

export const PATCH = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { id, status, completedBy, notes, amount } = body;

    if (!id) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
        updateData.completedBy = completedBy || 'admin';
      }
    }
    if (notes !== undefined) updateData.notes = notes;
    if (amount !== undefined) updateData.amount = parseFloat(amount);

    const event = await prisma.fiscalCalendarEvent.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Update fiscal event error:', error);
    return NextResponse.json({ error: 'Failed to update fiscal event' }, { status: 500 });
  }
});
