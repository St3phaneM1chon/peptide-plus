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
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  translateEntityAllLocales,
  translateEntity,
  enqueue,
  type TranslatableModel,
} from '@/lib/translation';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const VALID_MODELS: TranslatableModel[] = [
  'Product', 'ProductFormat', 'Category', 'Article',
  'BlogPost', 'Video', 'Webinar', 'QuickReply',
];

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const { model, entityId, force = false, locales: targetLocales, all = false } = body;

    if (!model || !VALID_MODELS.includes(model)) {
      return NextResponse.json(
        { error: `Modèle invalide. Valeurs acceptées: ${VALID_MODELS.join(', ')}` },
        { status: 400 }
      );
    }

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
