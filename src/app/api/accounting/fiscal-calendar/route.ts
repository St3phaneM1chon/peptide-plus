import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getUpcomingDeadlines } from '@/lib/accounting/canadian-tax-config';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createFiscalEventSchema = z.object({
  title: z.string().min(1, 'title is required'),
  titleFr: z.string().optional(),
  description: z.string().optional(),
  descriptionFr: z.string().optional(),
  dueDate: z.string().min(1, 'dueDate is required'),
  category: z.string().optional(),
  authority: z.string().optional(),
  frequency: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  isRecurring: z.boolean().optional(),
  templateId: z.string().optional(),
  reminderDate: z.string().optional(),
});

const patchFiscalEventSchema = z.object({
  id: z.string().min(1, 'Event ID required'),
  status: z.string().optional(),
  completedBy: z.string().optional(),
  notes: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
});

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
    logger.error('Fiscal calendar error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch fiscal calendar' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/fiscal-calendar');
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

    const body = await request.json();
    const parsed = createFiscalEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { title, titleFr, description, descriptionFr, dueDate, category, authority, frequency, amount, isRecurring, templateId, reminderDate } = parsed.data;

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
        amount: amount ? parseFloat(String(amount)) : null,
        isRecurring: isRecurring || false,
        templateId: templateId || null,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    logger.error('Create fiscal event error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to create fiscal event' }, { status: 500 });
  }
});

export const PATCH = withAdminGuard(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/fiscal-calendar');
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

    const body = await request.json();
    const parsed = patchFiscalEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id, status, completedBy, notes, amount } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
        updateData.completedBy = completedBy || 'admin';
      }
    }
    if (notes !== undefined) updateData.notes = notes;
    if (amount !== undefined) updateData.amount = parseFloat(String(amount));

    const event = await prisma.fiscalCalendarEvent.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ event });
  } catch (error) {
    logger.error('Update fiscal event error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to update fiscal event' }, { status: 500 });
  }
});
