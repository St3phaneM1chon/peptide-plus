export const dynamic = 'force-dynamic';

/**
 * IVR Menu Detail API
 * GET    — Get single IVR menu
 * PUT    — Update IVR menu
 * DELETE — Deactivate IVR menu
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { resolveTenant } from '@/lib/voip/tenant-context';
import { resolveIvrMenu, buildGreetingText } from '@/lib/voip/ivr-engine';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve tenant to scope by companyId
    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    const menu = await prisma.ivrMenu.findFirst({
      where: { id, companyId: tenant.companyId },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!menu) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Enrich with generated greeting preview and resolved time-of-day routing
    const resolvedMenu = await resolveIvrMenu({ routeToIvr: id });
    const isAfterHoursRedirect = resolvedMenu?.id !== menu.id;

    return NextResponse.json({
      data: {
        ...menu,
        generatedGreeting: menu.greetingText || buildGreetingText(menu.options),
        isAfterHoursRedirect,
        activeMenuId: resolvedMenu?.id || menu.id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve tenant to scope by companyId
    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    // Verify menu belongs to tenant
    const existing = await prisma.ivrMenu.findFirst({
      where: { id, companyId: tenant.companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const raw = await request.json();
    const ivrOptionSchema = z.object({
      digit: z.string(),
      label: z.string(),
      action: z.string(),
      target: z.string(),
      announcement: z.string().optional(),
      sortOrder: z.number().int().optional(),
    });
    const parsed = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      greetingText: z.string().optional(),
      language: z.string().optional(),
      inputTimeout: z.number().int().optional(),
      maxRetries: z.number().int().optional(),
      timeoutAction: z.string().optional(),
      timeoutTarget: z.string().optional(),
      businessHoursStart: z.string().optional(),
      businessHoursEnd: z.string().optional(),
      afterHoursMenuId: z.string().optional(),
      isActive: z.boolean().optional(),
      options: z.array(ivrOptionSchema).optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      greetingText,
      language,
      inputTimeout,
      maxRetries,
      timeoutAction,
      timeoutTarget,
      businessHoursStart,
      businessHoursEnd,
      afterHoursMenuId,
      isActive,
      options,
    } = parsed.data;

    // Update menu
    await prisma.ivrMenu.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(greetingText !== undefined ? { greetingText } : {}),
        ...(language !== undefined ? { language } : {}),
        ...(inputTimeout !== undefined ? { inputTimeout } : {}),
        ...(maxRetries !== undefined ? { maxRetries } : {}),
        ...(timeoutAction !== undefined ? { timeoutAction } : {}),
        ...(timeoutTarget !== undefined ? { timeoutTarget } : {}),
        ...(businessHoursStart !== undefined ? { businessHoursStart } : {}),
        ...(businessHoursEnd !== undefined ? { businessHoursEnd } : {}),
        ...(afterHoursMenuId !== undefined ? { afterHoursMenuId } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    // Replace options if provided
    if (options) {
      await prisma.ivrMenuOption.deleteMany({ where: { menuId: id } });
      await prisma.ivrMenuOption.createMany({
        data: options.map((opt: {
          digit: string;
          label: string;
          action: string;
          target: string;
          announcement?: string;
          sortOrder?: number;
        }, idx: number) => ({
          menuId: id,
          digit: opt.digit,
          label: opt.label,
          action: opt.action,
          target: opt.target,
          announcement: opt.announcement,
          sortOrder: opt.sortOrder ?? idx,
        })),
      });
    }

    const updated = await prisma.ivrMenu.findUnique({
      where: { id },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST — Simulate/test IVR digit input (dry-run: validates digit routing without making calls)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    const existing = await prisma.ivrMenu.findFirst({
      where: { id, companyId: tenant.companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rawPost = await request.json();
    const parsedPost = z.object({
      digit: z.string().min(1),
    }).safeParse(rawPost);
    if (!parsedPost.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsedPost.error.flatten() },
        { status: 400 }
      );
    }
    const { digit } = parsedPost.data;

    // Look up the option for this digit (dry-run — no call control)
    const option = await prisma.ivrMenuOption.findUnique({
      where: { menuId_digit: { menuId: id, digit } },
    });

    if (!option) {
      return NextResponse.json({
        data: { matched: false, digit, message: 'No option configured for this digit' },
      });
    }

    return NextResponse.json({
      data: {
        matched: true,
        digit,
        action: option.action,
        target: option.target,
        label: option.label,
        announcement: option.announcement,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve tenant to scope by companyId
    const tenant = await resolveTenant(session.user.id);
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    // Verify menu belongs to tenant
    const existing = await prisma.ivrMenu.findFirst({
      where: { id, companyId: tenant.companyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.ivrMenu.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ status: 'deactivated' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
