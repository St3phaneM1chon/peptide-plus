export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PERMISSION_MODULES, seedPermissions } from '@/lib/permissions';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { permissionPostSchema } from '@/lib/validations/permission';

// GET /api/admin/permissions - List all permissions, groups, and overrides
export const GET = withAdminGuard(async (request, { session }) => {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'permissions';

  if (tab === 'permissions') {
    const count = await prisma.permission.count();
    if (count === 0) {
      await seedPermissions();
    }

    const permissions = await prisma.permission.findMany({
      orderBy: { module: 'asc' },
    });

    return NextResponse.json({ permissions, modules: PERMISSION_MODULES });
  }

  if (tab === 'groups') {
    const groups = await prisma.permissionGroup.findMany({
      include: {
        permissions: { include: { permission: true } },
        users: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ groups });
  }

  if (tab === 'overrides') {
    const userId = searchParams.get('userId');
    const where = userId ? { userId } : {};

    const overrides = await prisma.userPermissionOverride.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ overrides });
  }

  if (tab === 'users') {
    const search = searchParams.get('search') || '';
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
      },
      take: 50,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ users });
  }

  return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
});

// POST /api/admin/permissions - Create group or override
export const POST = withAdminGuard(async (request, { session }) => {
  const body = await request.json();

  // Validate with Zod discriminated union
  const parsed = permissionPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { action } = parsed.data;

  if (action === 'seed') {
    await seedPermissions();
    return NextResponse.json({ success: true });
  }

  // Use validated data for all actions
  const validatedData = parsed.data;

  if (action === 'createGroup') {
    const { name, description, color, permissionCodes } = validatedData as Extract<typeof validatedData, { action: 'createGroup' }>;

    const group = await prisma.permissionGroup.create({
      data: { name, description, color },
    });

    if (permissionCodes?.length) {
      const permissions = await prisma.permission.findMany({
        where: { code: { in: permissionCodes } },
      });

      await prisma.permissionGroupPermission.createMany({
        data: permissions.map((p: { id: string }) => ({
          groupId: group.id,
          permissionId: p.id,
        })),
      });
    }

    return NextResponse.json({ group });
  }

  if (action === 'updateGroup') {
    const { groupId, name, description, color, permissionCodes } = validatedData as Extract<typeof validatedData, { action: 'updateGroup' }>;

    await prisma.permissionGroup.update({
      where: { id: groupId },
      data: { name, description, color },
    });

    await prisma.permissionGroupPermission.deleteMany({ where: { groupId } });

    if (permissionCodes?.length) {
      const permissions = await prisma.permission.findMany({
        where: { code: { in: permissionCodes } },
      });

      await prisma.permissionGroupPermission.createMany({
        data: permissions.map((p: { id: string }) => ({
          groupId,
          permissionId: p.id,
        })),
      });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'deleteGroup') {
    const { groupId } = validatedData as Extract<typeof validatedData, { action: 'deleteGroup' }>;
    await prisma.permissionGroup.delete({ where: { id: groupId } });
    return NextResponse.json({ success: true });
  }

  if (action === 'assignGroup') {
    const { userId, groupId } = validatedData as Extract<typeof validatedData, { action: 'assignGroup' }>;

    await prisma.userPermissionGroup.upsert({
      where: { userId_groupId: { userId, groupId } },
      update: {},
      create: { userId, groupId, assignedBy: session.user.id },
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'removeFromGroup') {
    const { userId, groupId } = validatedData as Extract<typeof validatedData, { action: 'removeFromGroup' }>;

    await prisma.userPermissionGroup.deleteMany({
      where: { userId, groupId },
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'setOverride') {
    const { userId, permissionCode, granted, reason, expiresAt } = validatedData as Extract<typeof validatedData, { action: 'setOverride' }>;

    await prisma.userPermissionOverride.upsert({
      where: { userId_permissionCode: { userId, permissionCode } },
      update: {
        granted,
        reason,
        grantedBy: session.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      create: {
        userId,
        permissionCode,
        granted,
        reason,
        grantedBy: session.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'removeOverride') {
    const { userId, permissionCode } = validatedData as Extract<typeof validatedData, { action: 'removeOverride' }>;

    await prisma.userPermissionOverride.deleteMany({
      where: { userId, permissionCode },
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'updateDefaults') {
    const { code, defaultOwner, defaultEmployee, defaultClient, defaultCustomer } = validatedData as Extract<typeof validatedData, { action: 'updateDefaults' }>;

    await prisma.permission.update({
      where: { code },
      data: { defaultOwner, defaultEmployee, defaultClient, defaultCustomer },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
});
