export const dynamic = 'force-dynamic';
/**
 * API Admin - Déclencher la traduction d'un contenu
 *
 * POST /api/admin/translations/trigger
 * Body: { model: "Product", entityId: "cuid...", force?: boolean, locales?: string[] }
 *
 * Peut aussi déclencher la traduction de TOUS les contenus d'un type:
 * POST /api/admin/translations/trigger
 * Body: { model: "Product", all: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  translateEntityAllLocales,
  translateEntity,
  enqueue,
  type TranslatableModel,
} from '@/lib/translation';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const translationTriggerSchema = z.object({
  model: z.enum(['Product', 'ProductFormat', 'Category', 'Article', 'BlogPost', 'Video', 'Webinar', 'QuickReply']),
  entityId: z.string().optional(),
  force: z.boolean().optional().default(false),
  locales: z.array(z.string()).optional(),
  all: z.boolean().optional().default(false),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/translations/trigger');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = translationTriggerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { model, entityId, force = false, locales: targetLocales, all = false } = parsed.data;

    // Batch translate ALL entities of a model
    if (all) {
      // This runs asynchronously - queue each entity
      const sourceModelName = model === 'ProductFormat'
        ? 'productFormat'
        : model.charAt(0).toLowerCase() + model.slice(1);

      const { prisma } = await import('@/lib/db');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access
      const entities = await ((prisma as Record<string, any>)[sourceModelName]).findMany({
        select: { id: true },
      });

      for (const entity of entities) {
        enqueue[
          model === 'ProductFormat' ? 'productFormat' :
          model === 'BlogPost' ? 'blogPost' :
          model === 'QuickReply' ? 'quickReply' :
          (model.charAt(0).toLowerCase() + model.slice(1)) as keyof typeof enqueue
        ](entity.id, force);
      }

      logAdminAction({
        adminUserId: session.user.id,
        action: 'TRIGGER_BATCH_TRANSLATION',
        targetType: model,
        targetId: 'all',
        newValue: { model, queued: entities.length, force },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({
        message: `${entities.length} ${model}(s) en file d'attente pour traduction`,
        queued: entities.length,
      });
    }

    // Single entity translation
    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId requis (ou all: true pour tout traduire)' },
        { status: 400 }
      );
    }

    // If specific locales requested, translate only those
    if (targetLocales && Array.isArray(targetLocales)) {
      const results = await Promise.allSettled(
        targetLocales.map((locale: string) =>
          translateEntity(model as TranslatableModel, entityId, locale, { force })
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return NextResponse.json({
        message: `Traduction terminée: ${successful} réussies, ${failed} échouées`,
        successful,
        failed,
      });
    }

    // Translate to ALL locales
    const results = await translateEntityAllLocales(
      model as TranslatableModel,
      entityId,
      { force, concurrency: 3 }
    );

    logAdminAction({
      adminUserId: session.user.id,
      action: 'TRIGGER_TRANSLATION',
      targetType: model,
      targetId: entityId,
      newValue: { model, entityId, force, translatedLocales: results.length },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      message: `Traduction terminée pour ${model}#${entityId}`,
      translatedLocales: results.length,
      locales: results.map(r => r.locale),
    });
  } catch (error) {
    logger.error('Error triggering translation', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors du déclenchement de la traduction' },
      { status: 500 }
    );
  }
});
