export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { PERMISSION_MODULES, seedPermissions } from '@/lib/permissions';

// GET /api/admin/permissions - List all permissions, groups, and overrides
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'permissions';

  if (tab === 'permissions') {
    // Seed if empty
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
}

// POST /api/admin/permissions - Create group or override
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  // Seed permissions
  if (action === 'seed') {
    await seedPermissions();
    return NextResponse.json({ success: true });
  }

  // Create permission group
  if (action === 'createGroup') {
    const { name, description, color, permissionCodes } = body;

    const group = await prisma.permissionGroup.create({
      data: {
        name,
        description,
        color,
      },
    });

    if (permissionCodes?.length) {
      const permissions = await prisma.permission.findMany({
        where: { code: { in: permissionCodes } },
      });

      await prisma.permissionGroupPermission.createMany({
        data: permissions.map((p) => ({
          groupId: group.id,
          permissionId: p.id,
        })),
      });
    }

    return NextResponse.json({ group });
  }

  // Update permission group
  if (action === 'updateGroup') {
    const { groupId, name, description, color, permissionCodes } = body;

    await prisma.permissionGroup.update({
      where: { id: groupId },
      data: { name, description, color },
    });

    // Replace permissions
    await prisma.permissionGroupPermission.deleteMany({ where: { groupId } });

    if (permissionCodes?.length) {
      const permissions = await prisma.permission.findMany({
        where: { code: { in: permissionCodes } },
      });

      await prisma.permissionGroupPermission.createMany({
        data: permissions.map((p) => ({
          groupId,
          permissionId: p.id,
        })),
      });
    }

    return NextResponse.json({ success: true });
  }

  // Delete group
  if (action === 'deleteGroup') {
    await prisma.permissionGroup.delete({ where: { id: body.groupId } });
    return NextResponse.json({ success: true });
  }

  // Assign user to group
  if (action === 'assignGroup') {
    const { userId, groupId } = body;

    await prisma.userPermissionGroup.upsert({
      where: { userId_groupId: { userId, groupId } },
      update: {},
      create: { userId, groupId, assignedBy: session.user.id },
    });

    return NextResponse.json({ success: true });
  }

  // Remove user from group
  if (action === 'removeFromGroup') {
    const { userId, groupId } = body;

    await prisma.userPermissionGroup.deleteMany({
      where: { userId, groupId },
    });

    return NextResponse.json({ success: true });
  }

  // Set user override
  if (action === 'setOverride') {
    const { userId, permissionCode, granted, reason, expiresAt } = body;

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

  // Remove override
  if (action === 'removeOverride') {
    const { userId, permissionCode } = body;

    await prisma.userPermissionOverride.deleteMany({
      where: { userId, permissionCode },
    });

    return NextResponse.json({ success: true });
  }

  // Update role defaults
  if (action === 'updateDefaults') {
    const { code, defaultOwner, defaultEmployee, defaultClient, defaultCustomer } = body;

    await prisma.permission.update({
      where: { code },
      data: { defaultOwner, defaultEmployee, defaultClient, defaultCustomer },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
