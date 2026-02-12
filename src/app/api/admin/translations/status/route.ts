export const dynamic = 'force-dynamic';
/**
 * API Admin - Statut des traductions
 *
 * GET /api/admin/translations/status
 *   → Vue d'ensemble de toutes les traductions
 *
 * GET /api/admin/translations/status?model=Product
 *   → Couverture pour un modèle spécifique
 *
 * GET /api/admin/translations/status?model=Product&entityId=xxx
 *   → Statut détaillé pour une entité
 *
 * GET /api/admin/translations/status?queue=true
 *   → Statut de la file d'attente
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import {
  getTranslationStatus,
  getModelTranslationCoverage,
  getQueueStats,
  getJobs,
  type TranslatableModel,
} from '@/lib/translation';

const ALL_MODELS: TranslatableModel[] = [
  'Product', 'ProductFormat', 'Category', 'Article',
  'BlogPost', 'Video', 'Webinar', 'QuickReply',
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') as TranslatableModel | null;
    const entityId = searchParams.get('entityId');
    const showQueue = searchParams.get('queue') === 'true';

    // Queue status
    if (showQueue) {
      const stats = getQueueStats();
      const recentJobs = getJobs().slice(0, 50); // Last 50 jobs
      return NextResponse.json({ queue: stats, recentJobs });
    }

    // Single entity status
    if (model && entityId) {
      if (!ALL_MODELS.includes(model)) {
        return NextResponse.json({ error: 'Modèle invalide' }, { status: 400 });
      }
      const status = await getTranslationStatus(model, entityId);
      return NextResponse.json({ status });
    }

    // Single model coverage
    if (model) {
      if (!ALL_MODELS.includes(model)) {
        return NextResponse.json({ error: 'Modèle invalide' }, { status: 400 });
      }
      const coverage = await getModelTranslationCoverage(model);
      return NextResponse.json({ model, coverage });
    }

    // Overview: all models coverage
    const overview: Record<string, any> = {};
    for (const m of ALL_MODELS) {
      try {
        overview[m] = await getModelTranslationCoverage(m);
      } catch {
        overview[m] = { error: 'Impossible de calculer la couverture' };
      }
    }

    const queueStats = getQueueStats();

    return NextResponse.json({
      overview,
      queue: queueStats,
    });
  } catch (error) {
    console.error('Error fetching translation status:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du statut' },
      { status: 500 }
    );
  }
}
