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
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Lire une traduction
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { id: entityId } = await params;
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
      const translation = await (prisma as any)[tableName].findUnique({
        where: { [`${fkField}_locale`]: { [fkField]: entityId, locale } },
      });
      return NextResponse.json({ translation });
    } else {
      // Get all translations for this entity
      const translations = await (prisma as any)[tableName].findMany({
        where: { [fkField]: entityId },
        orderBy: { locale: 'asc' },
      });
      return NextResponse.json({ translations });
    }
  } catch (error) {
    console.error('Error fetching translation:', error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}

// PUT - Modifier une traduction manuellement
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { id: entityId } = await params;
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
    const updateData: Record<string, any> = {};
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

    const translation = await (prisma as any)[tableName].upsert({
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
}

// DELETE - Supprimer une traduction
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { id: entityId } = await params;
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
      await (prisma as any)[tableName].delete({
        where: { [`${fkField}_locale`]: { [fkField]: entityId, locale } },
      });
      cacheDelete(`translation:${model}:${entityId}:${locale}`);
      return NextResponse.json({ message: `Traduction ${locale} supprimée` });
    } else {
      // Delete all translations for this entity
      const result = await (prisma as any)[tableName].deleteMany({
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
}
