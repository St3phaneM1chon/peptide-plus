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
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { TRANSLATABLE_FIELDS, type TranslatableModel } from '@/lib/translation';
import { cacheDelete } from '@/lib/cache';

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
    console.error('Error fetching translation:', error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
});

// PUT - Modifier une traduction manuellement
export const PUT = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const entityId = params!.id;
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') as TranslatableModel;
    const locale = searchParams.get('locale');

    if (!model || !TRANSLATION_TABLE_MAP[model] || !locale) {
      return NextResponse.json({ error: 'Paramètres model et locale requis' }, { status: 400 });
    }

    const body = await request.json();
    const { fields, approve } = body;

    const tableName = TRANSLATION_TABLE_MAP[model];
    const fkField = FK_FIELD_MAP[model];
    const validFields = TRANSLATABLE_FIELDS[model];

    // Filter to only valid translatable fields
    const updateData: Record<string, unknown> = {};
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        if (validFields.includes(key)) {
          updateData[key] = value;
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

    return NextResponse.json({
      message: 'Traduction mise à jour',
      translation,
    });
  } catch (error) {
    console.error('Error updating translation:', error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
});

// DELETE - Supprimer une traduction
export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
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
      // Delete single translation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ((prisma as Record<string, any>)[tableName]).delete({
        where: { [`${fkField}_locale`]: { [fkField]: entityId, locale } },
      });
      cacheDelete(`translation:${model}:${entityId}:${locale}`);
      return NextResponse.json({ message: `Traduction ${locale} supprimée` });
    } else {
      // Delete all translations for this entity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ((prisma as Record<string, any>)[tableName]).deleteMany({
        where: { [fkField]: entityId },
      });
      return NextResponse.json({
        message: `${result.count} traduction(s) supprimée(s)`,
        deleted: result.count,
      });
    }
  } catch (error) {
    console.error('Error deleting translation:', error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
});
