export const dynamic = 'force-dynamic';

/**
 * Admin Mailing List Subscribers API
 * GET    - List subscribers with pagination, search, status filter
 * POST   - Add a new subscriber manually
 * PATCH  - Update subscriber status (activate, unsubscribe, etc.)
 * DELETE - Remove a subscriber permanently
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const addSubscriberSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().max(200).optional().nullable(),
  status: z.enum(['PENDING', 'ACTIVE', 'UNSUBSCRIBED', 'BOUNCED']).optional(),
  consentType: z.enum(['EXPRESS', 'IMPLIED']).optional(),
  consentMethod: z.string().max(100).optional(),
});

const patchSubscriberSchema = z.object({
  id: z.string().min(1, 'Subscriber ID is required'),
  status: z.enum(['PENDING', 'ACTIVE', 'UNSUBSCRIBED', 'BOUNCED']).optional(),
  name: z.string().max(200).optional().nullable(),
});

// GET /api/admin/mailing-list - List subscribers
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || '';

    const where = {
      ...(status ? { status: status as 'PENDING' | 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED' } : {}),
      ...(search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [subscribers, total, statusCounts] = await Promise.all([
      prisma.mailingListSubscriber.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          consentType: true,
          consentMethod: true,
          createdAt: true,
          updatedAt: true,
          confirmedAt: true,
          unsubscribedAt: true,
          preferences: {
            select: {
              id: true,
              category: true,
              isEnabled: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mailingListSubscriber.count({ where }),
      prisma.mailingListSubscriber.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({ subscribers, total, page, limit, statusCounts });
  } catch (error) {
    logger.error('Admin mailing list GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/mailing-list - Add a subscriber manually
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = addSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { email, name, status, consentType, consentMethod } = parsed.data;

    // Check for duplicate email
    const existing = await prisma.mailingListSubscriber.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, status: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A subscriber with this email already exists', existingId: existing.id, existingStatus: existing.status },
        { status: 409 }
      );
    }

    const subscriber = await prisma.mailingListSubscriber.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        status: status || 'ACTIVE',
        consentType: consentType || 'EXPRESS',
        consentMethod: consentMethod || 'admin_manual',
        consentDate: new Date(),
        confirmedAt: status === 'ACTIVE' || !status ? new Date() : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        consentType: true,
        consentMethod: true,
        createdAt: true,
        confirmedAt: true,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'ADD_MAILING_LIST_SUBSCRIBER',
      targetType: 'MailingListSubscriber',
      targetId: subscriber.id,
      newValue: { email: subscriber.email, status: subscriber.status },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ subscriber }, { status: 201 });
  } catch (error) {
    logger.error('Admin mailing list POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/mailing-list - Update subscriber status or name
export const PATCH = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = patchSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id, status, name } = parsed.data;

    const existing = await prisma.mailingListSubscriber.findUnique({
      where: { id },
      select: { id: true, email: true, status: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name?.trim() || null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'UNSUBSCRIBED') {
        updateData.unsubscribedAt = new Date();
      }
      if (status === 'ACTIVE' && existing.status !== 'ACTIVE') {
        updateData.confirmedAt = new Date();
      }
    }

    const subscriber = await prisma.mailingListSubscriber.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        consentType: true,
        consentMethod: true,
        createdAt: true,
        updatedAt: true,
        confirmedAt: true,
        unsubscribedAt: true,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_MAILING_LIST_SUBSCRIBER',
      targetType: 'MailingListSubscriber',
      targetId: id,
      previousValue: { status: existing.status, name: existing.name },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ subscriber });
  } catch (error) {
    logger.error('Admin mailing list PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/mailing-list - Remove a subscriber permanently
export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Subscriber ID is required' }, { status: 400 });
    }

    const existing = await prisma.mailingListSubscriber.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    // Delete preferences first, then subscriber
    await prisma.$transaction(async (tx) => {
      await tx.mailingListPreference.deleteMany({ where: { subscriberId: id } });
      await tx.mailingListSubscriber.delete({ where: { id } });
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_MAILING_LIST_SUBSCRIBER',
      targetType: 'MailingListSubscriber',
      targetId: id,
      previousValue: { email: existing.email },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin mailing list DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
