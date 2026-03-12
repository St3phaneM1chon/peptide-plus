export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const replaceTagsSchema = z.object({
  tags: z.array(z.string()),
});

const patchTagsSchema = z.object({
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
}).refine((data) => data.add !== undefined || data.remove !== undefined, {
  message: 'Le corps doit contenir "add" ou "remove"',
});

// GET: Return user's tags
export const GET = withAdminGuard(
  async (_request, { params }) => {
    try {
      const id = params!.id as string;

      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, tags: true },
      });

      if (!user) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
      }

      return NextResponse.json({ tags: user.tags });
    } catch (error) {
      logger.error('Admin user tags GET error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
  },
  { requiredPermission: 'users.view', skipCsrf: true }
);

// PUT: Replace all tags ({ tags: string[] })
export const PUT = withAdminGuard(
  async (request, { session, params }) => {
    try {
      const id = params!.id as string;

      const body = await request.json();
      const parsed = replaceTagsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid data', details: parsed.error.errors },
          { status: 400 }
        );
      }

      const cleanTags = parsed.data.tags.map((t) => t.trim()).filter(Boolean);

      const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!exists) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { tags: cleanTags },
        select: { id: true, tags: true },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_USER_TAGS',
        targetType: 'User',
        targetId: id,
        newValue: { tags: cleanTags },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: { operation: 'replace' },
      }).catch((e) =>
        logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) })
      );

      return NextResponse.json({ tags: updated.tags });
    } catch (error) {
      logger.error('Admin user tags PUT error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
  },
  { requiredPermission: 'users.edit' }
);

// PATCH: Add tags ({ add: string[] }) or remove tags ({ remove: string[] })
export const PATCH = withAdminGuard(
  async (request, { session, params }) => {
    try {
      const id = params!.id as string;

      const body = await request.json();
      const parsed = patchTagsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid data', details: parsed.error.errors },
          { status: 400 }
        );
      }
      const { add, remove } = parsed.data;

      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, tags: true },
      });

      if (!user) {
        return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
      }

      let currentTags = user.tags as string[];

      if (add) {
        const toAdd = (add as string[]).map((t) => t.trim()).filter(Boolean);
        currentTags = [...new Set([...currentTags, ...toAdd])];
      }

      if (remove) {
        const toRemove = new Set((remove as string[]).map((t) => t.trim()));
        currentTags = currentTags.filter((t) => !toRemove.has(t));
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { tags: currentTags },
        select: { id: true, tags: true },
      });

      const operation = add ? 'add' : 'remove';

      logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_USER_TAGS',
        targetType: 'User',
        targetId: id,
        newValue: { tags: currentTags },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: { operation, add, remove },
      }).catch((e) =>
        logger.error('[audit]', { error: e instanceof Error ? e.message : String(e) })
      );

      return NextResponse.json({ tags: updated.tags });
    } catch (error) {
      logger.error('Admin user tags PATCH error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
  },
  { requiredPermission: 'users.edit' }
);
