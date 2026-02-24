export const dynamic = 'force-dynamic';
/**
 * API Admin - Gérer une traduction spécifique
 *
 * GET /api/admin/translations/:id?model=Product&locale=fr
 *   → Lire une traduction
 *
 * PUT /api/admin/translations/:id?model=Product&locale=fr
 *   → Modifier manuellement une traduction
 *   Body: { fields: { name: "Nom traduit", description: "..." }, approve?: boolean }
 *
 * DELETE /api/admin/translations/:id?model=Product&locale=fr
 *   → Supprimer une traduction pour forcer re-traduction
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { TRANSLATABLE_FIELDS, type TranslatableModel } from '@/lib/translation';
import { cacheDelete } from '@/lib/cache';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const translationUpdateSchema = z.object({
  fields: z.record(z.string(), z.unknown()).optional(),
  approve: z.boolean().optional(),
});

// G4-FLAW-10: Maximum allowed length for translation field values
const MAX_TRANSLATION_LENGTH = 10_000;

const TRANSLATION_TABLE_MAP: Record<TranslatableModel, string> = {
  Product: 'productTranslation',
  ProductFormat: 'productFormatTranslation',
  Category: 'categoryTranslation',
  Article: 'articleTranslation',
  BlogPost: 'blogPostTranslation',
  Video: 'videoTranslation',
  Webinar: 'webinarTranslation',
  QuickReply: 'quickReplyTranslation',
};

const FK_FIELD_MAP: Record<TranslatableModel, string> = {
  Product: 'productId',
  ProductFormat: 'formatId',
  Category: 'categoryId',
  Article: 'articleId',
  BlogPost: 'blogPostId',
  Video: 'videoId',
  Webinar: 'webinarId',
  QuickReply: 'quickReplyId',
};

// GET - Lire une traduction
export const GET = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const entityId = params!.id;
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') as TranslatableModel;
    const locale = searchParams.get('locale');

    if (!model || !TRANSLATION_TABLE_MAP[model]) {
      return NextResponse.json({ error: 'Paramètre model requis' }, { status: 400 });
    }

    const tableName = TRANSLATION_TABLE_MAP[model];
    const fkField = FK_FIELD_MAP[model];

    if (locale) {
      // Get single translation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const translation = await ((prisma as Record<string, any>)[tableName]).findUnique({
        where: { [`${fkField}_locale`]: { [fkField]: entityId, locale } },
      });
      return NextResponse.json({ translation });
    } else {
      // Get all translations for this entity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const translations = await ((prisma as Record<string, any>)[tableName]).findMany({
        where: { [fkField]: entityId },
        orderBy: { locale: 'asc' },
      });
      return NextResponse.json({ translations });
    }
  } catch (error) {
    logger.error('Error fetching translation', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
});

// PUT - Modifier une traduction manuellement
export const PUT = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/translations/[id]');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const entityId = params!.id;
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') as TranslatableModel;
    const locale = searchParams.get('locale');

    if (!model || !TRANSLATION_TABLE_MAP[model] || !locale) {
      return NextResponse.json({ error: 'Paramètres model et locale requis' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = translationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { fields, approve } = parsed.data;

    const tableName = TRANSLATION_TABLE_MAP[model];
    const fkField = FK_FIELD_MAP[model];
    const validFields = TRANSLATABLE_FIELDS[model];

    // Filter to only valid translatable fields
    const updateData: Record<string, unknown> = {};
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        if (validFields.includes(key)) {
          // G4-FLAW-10: Validate length and strip control characters
          if (typeof value === 'string') {
            if (value.length > MAX_TRANSLATION_LENGTH) {
              return NextResponse.json(
                { error: `Field "${key}" exceeds maximum length of ${MAX_TRANSLATION_LENGTH} characters` },
                { status: 400 }
              );
            }
            updateData[key] = stripControlChars(value);
          } else {
            updateData[key] = value;
          }
        }
      }
    }

    if (approve !== undefined) {
      updateData.isApproved = approve;
    }

    updateData.translatedBy = 'manual';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translation = await ((prisma as Record<string, any>)[tableName]).upsert({
      where: { [`${fkField}_locale`]: { [fkField]: entityId, locale } },
      create: { [fkField]: entityId, locale, ...updateData },
      update: updateData,
    });

    // Invalidate cache
    cacheDelete(`translation:${model}:${entityId}:${locale}`);

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_TRANSLATION',
      targetType: model,
      targetId: entityId,
      newValue: { locale, fields: Object.keys(updateData), approve },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      message: 'Traduction mise à jour',
      translation,
    });
  } catch (error) {
    logger.error('Error updating translation', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
});

// DELETE - Supprimer une traduction
export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/translations/[id]');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const entityId = params!.id;
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') as TranslatableModel;
    const locale = searchParams.get('locale');

    if (!model || !TRANSLATION_TABLE_MAP[model]) {
      return NextResponse.json({ error: 'Paramètre model requis' }, { status: 400 });
    }

    const tableName = TRANSLATION_TABLE_MAP[model];
    const fkField = FK_FIELD_MAP[model];

    if (locale) {
      // Delete single translation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ((prisma as Record<string, any>)[tableName]).delete({
        where: { [`${fkField}_locale`]: { [fkField]: entityId, locale } },
      });
      cacheDelete(`translation:${model}:${entityId}:${locale}`);

      logAdminAction({
        adminUserId: session.user.id,
        action: 'DELETE_TRANSLATION',
        targetType: model,
        targetId: entityId,
        previousValue: { locale },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ message: `Traduction ${locale} supprimée` });
    } else {
      // Delete all translations for this entity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ((prisma as Record<string, any>)[tableName]).deleteMany({
        where: { [fkField]: entityId },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'DELETE_ALL_TRANSLATIONS',
        targetType: model,
        targetId: entityId,
        newValue: { deleted: result.count },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({
        message: `${result.count} traduction(s) supprimée(s)`,
        deleted: result.count,
      });
    }
  } catch (error) {
    logger.error('Error deleting translation', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
});
