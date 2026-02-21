export const dynamic = 'force-dynamic';

/**
 * Admin Employee Detail API
 * GET    - Employee detail with permissions
 * PATCH  - Update employee (role, permissions, active status)
 * DELETE - Deactivate employee (set role to PUBLIC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

// GET /api/admin/employees/[id] - Get employee detail
export const GET = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        phone: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          select: { expires: true },
          orderBy: { expires: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!['EMPLOYEE', 'OWNER'].includes(user.role)) {
      return NextResponse.json({ error: 'User is not an employee' }, { status: 404 });
    }

    // Get permission groups
    const userPermGroups = await prisma.userPermissionGroup.findMany({
      where: { userId: id },
      include: {
        group: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const groups = userPermGroups.map((upg) => ({
      id: upg.group.id,
      name: upg.group.name,
      description: upg.group.description,
      color: upg.group.color,
      permissions: upg.group.permissions.map((gp) => ({
        code: gp.permission.code,
        name: gp.permission.name,
        module: gp.permission.module,
      })),
    }));

    // Get individual overrides
    const overrides = await prisma.userPermissionOverride.findMany({
      where: { userId: id },
    });

    // Combine all permissions
    const groupPermissions = groups.flatMap((g) =>
      g.permissions.map((p) => p.code)
    );
    const overridePermissions = overrides
      .filter((o) => o.granted)
      .map((o) => o.permissionCode);
    const revokedPermissions = overrides
      .filter((o) => !o.granted)
      .map((o) => o.permissionCode);

    const effectivePermissions = [
      ...new Set([...groupPermissions, ...overridePermissions]),
    ].filter((p) => !revokedPermissions.includes(p));

    const lastLogin = user.sessions[0]?.expires.toISOString() || null;

    return NextResponse.json({
      employee: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        image: user.image,
        role: user.role,
        phone: user.phone,
        locale: user.locale,
        isActive: true,
        lastLogin,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        permissionGroups: groups,
        overrides: overrides.map((o) => ({
          permissionCode: o.permissionCode,
          granted: o.granted,
          reason: o.reason,
          expiresAt: o.expiresAt?.toISOString() || null,
        })),
        effectivePermissions:
          user.role === 'OWNER' ? ['*'] : effectivePermissions,
      },
    });
  } catch (error) {
    console.error('Admin employee GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/employees/[id] - Update employee
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    // Only OWNER can modify employees
    if (session.user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only owners can modify employees' },
        { status: 403 }
      );
    }

    const id = params!.id;
    const body = await request.json();

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Prevent modifying your own role
    if (id === session.user.id && body.role && body.role !== existing.role) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Role change
    if (body.role !== undefined) {
      const validRoles = ['EMPLOYEE', 'OWNER', 'PUBLIC'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.role = body.role;
    }

    // Name change
    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    // Phone change
    if (body.phone !== undefined) {
      updateData.phone = body.phone;
    }

    // Active status: deactivate by setting role to PUBLIC
    if (body.isActive === false && existing.role !== 'OWNER') {
      updateData.role = 'PUBLIC';
    } else if (body.isActive === true && existing.role === 'PUBLIC') {
      updateData.role = 'EMPLOYEE';
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id },
        data: updateData,
      });
    }

    // Update permissions if provided
    if (Array.isArray(body.permissions)) {
      // Remove all existing overrides for this user
      await prisma.userPermissionOverride.deleteMany({
        where: { userId: id },
      });

      // Create new overrides
      if (body.permissions.length > 0) {
        await prisma.userPermissionOverride.createMany({
          data: body.permissions.map((permCode: string) => ({
            userId: id,
            permissionCode: permCode,
            granted: true,
            grantedBy: session.user.id,
            reason: 'Updated via employee management',
          })),
        });
      }
    }

    // Fetch updated employee
    const updated = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        updatedAt: true,
      },
    });

    // Get updated permissions
    const updatedOverrides = await prisma.userPermissionOverride.findMany({
      where: { userId: id, granted: true },
      select: { permissionCode: true },
    });

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_EMPLOYEE',
      targetType: 'User',
      targetId: id,
      previousValue: { role: existing.role, name: existing.name },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      employee: {
        ...updated,
        permissions: updatedOverrides.map((o) => o.permissionCode),
        isActive: updated?.role === 'EMPLOYEE' || updated?.role === 'OWNER',
      },
    });
  } catch (error) {
    console.error('Admin employee PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/employees/[id] - Deactivate employee (set role to PUBLIC)
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    // Only OWNER can deactivate employees
    if (session.user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only owners can deactivate employees' },
        { status: 403 }
      );
    }

    const id = params!.id;

    // Prevent self-deactivation
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot deactivate yourself' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!['EMPLOYEE', 'OWNER'].includes(existing.role)) {
      return NextResponse.json({ error: 'User is not an employee' }, { status: 400 });
    }

    // Prevent deactivating another OWNER (only self, which is blocked above)
    if (existing.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot deactivate an owner account' },
        { status: 403 }
      );
    }

    // Set role to PUBLIC (deactivate)
    const updated = await prisma.user.update({
      where: { id },
      data: { role: 'PUBLIC' },
    });

    // Remove all permission overrides
    await prisma.userPermissionOverride.deleteMany({
      where: { userId: id },
    });

    // Remove from all permission groups
    await prisma.userPermissionGroup.deleteMany({
      where: { userId: id },
    });

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'DEACTIVATE_EMPLOYEE',
      targetType: 'User',
      targetId: id,
      previousValue: { role: existing.role, name: existing.name, email: existing.email },
      newValue: { role: 'PUBLIC', isActive: false },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      employee: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isActive: false,
      },
    });
  } catch (error) {
    console.error('Admin employee DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
