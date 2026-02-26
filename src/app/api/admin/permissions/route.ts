export const dynamic = 'force-dynamic';

// FAILLE-088 FIX: POST action refactored to switch/case on discriminated union type
// TODO: FAILLE-096 - User search (tab=users) uses general admin rate limit; add stricter limit (10/min) to prevent enumeration
// FAILLE-097 FIX: Using _count instead of include: { users: true } (fixed in GET handler below)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PERMISSION_MODULES, seedPermissions } from '@/lib/permissions';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { permissionPostSchema } from '@/lib/validations/permission';
import { logger } from '@/lib/logger';

// GET /api/admin/permissions - List all permissions, groups, and overrides
export const GET = withAdminGuard(async (request, _ctx) => {
  try {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'permissions';

  if (tab === 'permissions') {
    // TODO: FAILLE-076 - Auto-seeding permissions in a GET handler violates REST (GET should be read-only).
    //       Move seeding to a dedicated POST endpoint or CLI script. Keep this as temporary bootstrap only.
    const count = await prisma.permission.count();
    if (count === 0) {
      await seedPermissions();
    }

    const permissions = await prisma.permission.findMany({
      orderBy: { module: 'asc' },
      take: 200,
    });

    return NextResponse.json({ permissions, modules: PERMISSION_MODULES });
  }

  if (tab === 'groups') {
    const groups = await prisma.permissionGroup.findMany({
      include: {
        permissions: { include: { permission: true } },
        // FAILLE-097 FIX: Remove unused users include, keep only _count for performance
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
      take: 200,
    });

    return NextResponse.json({ groups });
  }

  if (tab === 'overrides') {
    const userId = searchParams.get('userId');
    const where = userId ? { userId } : {};

    const overrides = await prisma.userPermissionOverride.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ overrides });
  }

  if (tab === 'users') {
    // FAILLE-057 FIX: Limit search param length to prevent oversized queries
    const search = (searchParams.get('search') || '').substring(0, 100);
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
  } catch (error) {
    logger.error('[admin/permissions] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/permissions - Create group or override
// FAILLE-004 FIX: Require users.manage_permissions for mutation operations (defense-in-depth)
export const POST = withAdminGuard(async (request, { session }) => {
  try {
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

  // Use validated data for all actions
  const validatedData = parsed.data;

  // FAILLE-088 FIX: Use switch/case on discriminated union type instead of if-cascade
  switch (action) {
    case 'seed': {
      // SECURITY (FAILLE-010): Only OWNER can seed permissions
      if (session.user.role !== 'OWNER') {
        return NextResponse.json(
          { error: 'Seul le propriétaire peut initialiser les permissions' },
          { status: 403 }
        );
      }
      await seedPermissions();
      logAdminAction({
        adminUserId: session.user.id,
        action: 'SEED_PERMISSIONS',
        targetType: 'Permission',
        targetId: 'all',
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));
      return NextResponse.json({ success: true });
    }

    case 'createGroup': {
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

      logAdminAction({
        adminUserId: session.user.id,
        action: 'CREATE_PERMISSION_GROUP',
        targetType: 'PermissionGroup',
        targetId: group.id,
        newValue: { name, description, color, permissionCodes },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

      return NextResponse.json({ group });
    }

    case 'updateGroup': {
      const { groupId, name, description, color, permissionCodes } = validatedData as Extract<typeof validatedData, { action: 'updateGroup' }>;

      // AMELIORATION A-014: Wrap updateGroup in a transaction for atomicity
      await prisma.$transaction(async (tx) => {
        await tx.permissionGroup.update({
          where: { id: groupId },
          data: { name, description, color },
        });

        await tx.permissionGroupPermission.deleteMany({ where: { groupId } });

        if (permissionCodes?.length) {
          const permissions = await tx.permission.findMany({
            where: { code: { in: permissionCodes } },
          });

          await tx.permissionGroupPermission.createMany({
            data: permissions.map((p: { id: string }) => ({
              groupId,
              permissionId: p.id,
            })),
          });
        }
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_PERMISSION_GROUP',
        targetType: 'PermissionGroup',
        targetId: groupId,
        newValue: { name, description, color, permissionCodes },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

      return NextResponse.json({ success: true });
    }

    case 'deleteGroup': {
      const { groupId } = validatedData as Extract<typeof validatedData, { action: 'deleteGroup' }>;

      // FAILLE-025 FIX: Check for assigned users before deleting group
      const assignedUsersCount = await prisma.userPermissionGroup.count({ where: { groupId } });
      if (assignedUsersCount > 0) {
        return NextResponse.json(
          { error: `Cannot delete group: ${assignedUsersCount} user(s) still assigned. Remove them first.` },
          { status: 409 }
        );
      }

      await prisma.permissionGroup.delete({ where: { id: groupId } });
      logAdminAction({
        adminUserId: session.user.id,
        action: 'DELETE_PERMISSION_GROUP',
        targetType: 'PermissionGroup',
        targetId: groupId,
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));
      return NextResponse.json({ success: true });
    }

    case 'assignGroup': {
      const { userId, groupId } = validatedData as Extract<typeof validatedData, { action: 'assignGroup' }>;

      await prisma.userPermissionGroup.upsert({
        where: { userId_groupId: { userId, groupId } },
        update: {},
        create: { userId, groupId, assignedBy: session.user.id },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'ASSIGN_PERMISSION_GROUP',
        targetType: 'UserPermissionGroup',
        targetId: `${userId}_${groupId}`,
        newValue: { userId, groupId },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

      return NextResponse.json({ success: true });
    }

    case 'removeFromGroup': {
      const { userId, groupId } = validatedData as Extract<typeof validatedData, { action: 'removeFromGroup' }>;

      await prisma.userPermissionGroup.deleteMany({
        where: { userId, groupId },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'REMOVE_FROM_PERMISSION_GROUP',
        targetType: 'UserPermissionGroup',
        targetId: `${userId}_${groupId}`,
        previousValue: { userId, groupId },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

      return NextResponse.json({ success: true });
    }

    case 'setOverride': {
      const { userId, permissionCode, granted, reason, expiresAt } = validatedData as Extract<typeof validatedData, { action: 'setOverride' }>;

      // FAILLE-024 FIX: Verify user exists before creating override
      const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

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

      logAdminAction({
        adminUserId: session.user.id,
        action: 'SET_PERMISSION_OVERRIDE',
        targetType: 'UserPermissionOverride',
        targetId: `${userId}_${permissionCode}`,
        newValue: { userId, permissionCode, granted, reason, expiresAt },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

      return NextResponse.json({ success: true });
    }

    case 'removeOverride': {
      const { userId, permissionCode } = validatedData as Extract<typeof validatedData, { action: 'removeOverride' }>;

      await prisma.userPermissionOverride.deleteMany({
        where: { userId, permissionCode },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'REMOVE_PERMISSION_OVERRIDE',
        targetType: 'UserPermissionOverride',
        targetId: `${userId}_${permissionCode}`,
        previousValue: { userId, permissionCode },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

      return NextResponse.json({ success: true });
    }

    case 'updateDefaults': {
      const { code, defaultOwner, defaultEmployee, defaultClient, defaultCustomer } = validatedData as Extract<typeof validatedData, { action: 'updateDefaults' }>;

      await prisma.permission.update({
        where: { code },
        data: { defaultOwner, defaultEmployee, defaultClient, defaultCustomer },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_PERMISSION_DEFAULTS',
        targetType: 'Permission',
        targetId: code,
        newValue: { defaultOwner, defaultEmployee, defaultClient, defaultCustomer },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((e) => logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) }));

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  } catch (error) {
    logger.error('[admin/permissions] POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'users.manage_permissions' });
