export const dynamic = 'force-dynamic';

/**
 * Admin Employees API
 * GET  - List users where role is EMPLOYEE or OWNER, with permission groups
 * POST - Create/invite a new employee (create user with EMPLOYEE role)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

// GET /api/admin/employees - List employees and owners
export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      role: { in: ['EMPLOYEE', 'OWNER'] },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          sessions: {
            select: { expires: true },
            orderBy: { expires: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Get permission groups for each user
    const userIds = users.map((u) => u.id);
    const userPermGroups = await prisma.userPermissionGroup.findMany({
      where: { userId: { in: userIds } },
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

    // Group permissions by userId
    const permissionsByUser = new Map<
      string,
      { groups: string[]; permissions: string[] }
    >();
    for (const upg of userPermGroups) {
      const existing = permissionsByUser.get(upg.userId) || {
        groups: [],
        permissions: [],
      };
      existing.groups.push(upg.group.name);
      for (const gp of upg.group.permissions) {
        if (!existing.permissions.includes(gp.permission.code)) {
          existing.permissions.push(gp.permission.code);
        }
      }
      permissionsByUser.set(upg.userId, existing);
    }

    // Also get individual overrides
    const overrides = await prisma.userPermissionOverride.findMany({
      where: { userId: { in: userIds } },
    });

    const overridesByUser = new Map<string, string[]>();
    for (const override of overrides) {
      if (override.granted) {
        const existing = overridesByUser.get(override.userId) || [];
        existing.push(override.permissionCode);
        overridesByUser.set(override.userId, existing);
      }
    }

    const employees = users.map((user) => {
      const userPerms = permissionsByUser.get(user.id);
      const userOverrides = overridesByUser.get(user.id) || [];

      // Merge group permissions + overrides
      const allPermissions = [
        ...(userPerms?.permissions || []),
        ...userOverrides,
      ];
      const uniquePermissions = [...new Set(allPermissions)];

      // Determine isActive: OWNER always active, EMPLOYEE based on role (if role changed to PUBLIC = deactivated)
      const isActive = user.role === 'OWNER' || user.role === 'EMPLOYEE';

      // Last login from session
      const lastSession = user.sessions[0];
      const lastLogin = lastSession ? lastSession.expires.toISOString() : null;

      return {
        id: user.id,
        email: user.email,
        name: user.name || '',
        image: user.image,
        role: user.role,
        permissions: user.role === 'OWNER' ? ['*'] : uniquePermissions,
        permissionGroups: userPerms?.groups || [],
        lastLogin,
        isActive,
        createdAt: user.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      employees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin employees GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/employees - Create/invite a new employee
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // Only OWNER can create employees
    if (session.user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only owners can invite employees' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name, role, permissions } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['EMPLOYEE', 'OWNER'];
    const targetRole = role || 'EMPLOYEE';
    if (!validRoles.includes(targetRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let employee;

    if (existingUser) {
      // Update existing user's role to EMPLOYEE/OWNER
      if (['EMPLOYEE', 'OWNER'].includes(existingUser.role)) {
        return NextResponse.json(
          { error: 'This user is already an employee or owner' },
          { status: 409 }
        );
      }

      employee = await prisma.user.update({
        where: { email },
        data: {
          role: targetRole,
          name: name || existingUser.name,
        },
      });
    } else {
      // Create new user with EMPLOYEE role (no password - will need to set up via invitation)
      employee = await prisma.user.create({
        data: {
          email,
          name,
          role: targetRole,
        },
      });
    }

    // Assign permissions if provided and role is EMPLOYEE
    if (targetRole === 'EMPLOYEE' && Array.isArray(permissions) && permissions.length > 0) {
      // Find or create permission overrides for each permission
      for (const permCode of permissions) {
        await prisma.userPermissionOverride.upsert({
          where: {
            userId_permissionCode: {
              userId: employee.id,
              permissionCode: permCode,
            },
          },
          update: {
            granted: true,
            grantedBy: session.user.id,
          },
          create: {
            userId: employee.id,
            permissionCode: permCode,
            granted: true,
            grantedBy: session.user.id,
            reason: 'Assigned during employee invitation',
          },
        });
      }
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        role: employee.role,
        createdAt: employee.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin employees POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
