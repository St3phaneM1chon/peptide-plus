export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { PERMISSION_MODULES, seedPermissions } from '@/lib/permissions';
import { withApiHandler, apiSuccess, apiError, type ApiContext } from '@/lib/api-handler';

// GET /api/admin/permissions - List all permissions, groups, and overrides
export const GET = withApiHandler(async (ctx: ApiContext) => {
  const { searchParams } = new URL(ctx.request.url);
  const tab = searchParams.get('tab') || 'permissions';

  if (tab === 'permissions') {
    const count = await prisma.permission.count();
    if (count === 0) {
      await seedPermissions();
    }

    const permissions = await prisma.permission.findMany({
      orderBy: { module: 'asc' },
    });

    return apiSuccess({ permissions, modules: PERMISSION_MODULES });
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

    return apiSuccess({ groups });
  }

  if (tab === 'overrides') {
    const userId = searchParams.get('userId');
    const where = userId ? { userId } : {};

    const overrides = await prisma.userPermissionOverride.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({ overrides });
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

    return apiSuccess({ users });
  }

  return apiError('Invalid tab', 400);
}, { roles: ['OWNER'] });

// POST /api/admin/permissions - Create group or override
export const POST = withApiHandler(async (ctx: ApiContext) => {
  const body = await ctx.request.json();
  const { action } = body;

  if (action === 'seed') {
    await seedPermissions();
    return apiSuccess({ success: true });
  }

  if (action === 'createGroup') {
    const { name, description, color, permissionCodes } = body;

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

    return apiSuccess({ group });
  }

  if (action === 'updateGroup') {
    const { groupId, name, description, color, permissionCodes } = body;

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

    return apiSuccess({ success: true });
  }

  if (action === 'deleteGroup') {
    await prisma.permissionGroup.delete({ where: { id: body.groupId } });
    return apiSuccess({ success: true });
  }

  if (action === 'assignGroup') {
    const { userId, groupId } = body;

    await prisma.userPermissionGroup.upsert({
      where: { userId_groupId: { userId, groupId } },
      update: {},
      create: { userId, groupId, assignedBy: ctx.session!.user.id },
    });

    return apiSuccess({ success: true });
  }

  if (action === 'removeFromGroup') {
    const { userId, groupId } = body;

    await prisma.userPermissionGroup.deleteMany({
      where: { userId, groupId },
    });

    return apiSuccess({ success: true });
  }

  if (action === 'setOverride') {
    const { userId, permissionCode, granted, reason, expiresAt } = body;

    await prisma.userPermissionOverride.upsert({
      where: { userId_permissionCode: { userId, permissionCode } },
      update: {
        granted,
        reason,
        grantedBy: ctx.session!.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      create: {
        userId,
        permissionCode,
        granted,
        reason,
        grantedBy: ctx.session!.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return apiSuccess({ success: true });
  }

  if (action === 'removeOverride') {
    const { userId, permissionCode } = body;

    await prisma.userPermissionOverride.deleteMany({
      where: { userId, permissionCode },
    });

    return apiSuccess({ success: true });
  }

  if (action === 'updateDefaults') {
    const { code, defaultOwner, defaultEmployee, defaultClient, defaultCustomer } = body;

    await prisma.permission.update({
      where: { code },
      data: { defaultOwner, defaultEmployee, defaultClient, defaultCustomer },
    });

    return apiSuccess({ success: true });
  }

  return apiError('Invalid action', 400);
}, { roles: ['OWNER'] });
