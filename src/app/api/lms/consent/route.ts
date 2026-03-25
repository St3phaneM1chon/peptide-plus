export const dynamic = 'force-dynamic';

/**
 * LMS Consent API (Loi 25 Quebec - PROFILING)
 * POST /api/lms/consent — Record or update profiling consent
 * GET  /api/lms/consent — Get current consent status
 *
 * SEC-HARDENING: Wrapped with withUserGuard for centralized auth + CSRF + rate limiting.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Validation ───────────────────────────────────────────────

const CONSENT_CATEGORIES = [
  'PROFILING',
  'learning_style',
  'cognitive',
  'psychological',
  'voice_analysis',
  'study_habits',
] as const;

const CONSENT_DESCRIPTIONS: Record<string, string> = {
  PROFILING: 'Analyse globale de votre profil d\'apprentissage pour personnaliser le parcours de formation.',
  learning_style: 'Identification de votre style VARK (visuel, auditif, lecture, kinesthesique).',
  cognitive: 'Analyse de vos patterns cognitifs (memoire, attention, resolution de problemes).',
  psychological: 'Evaluation de la motivation, confiance et tolerance a la frustration.',
  voice_analysis: 'Analyse vocale pour detecter le stress et adapter le rythme.',
  study_habits: 'Suivi de vos habitudes d\'etude (horaires, duree, frequence).',
};

const consentSchema = z.object({
  type: z.enum(CONSENT_CATEGORIES),
  accepted: z.boolean(),
});

// ── GET — Current consent status ─────────────────────────────

export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  const userId = session.user.id!;

  const records = await prisma.lmsConsentRecord.findMany({
    where: { tenantId, userId },
    select: {
      category: true,
      granted: true,
      grantedAt: true,
      revokedAt: true,
      description: true,
      dataRetentionDays: true,
      updatedAt: true,
    },
    orderBy: { category: 'asc' },
  });

  // Build a complete status map (including categories with no record yet)
  const statusMap: Record<string, {
    granted: boolean;
    grantedAt: string | null;
    revokedAt: string | null;
    description: string;
    dataRetentionDays: number;
  }> = {};

  for (const cat of CONSENT_CATEGORIES) {
    const record = records.find(r => r.category === cat);
    statusMap[cat] = {
      granted: record?.granted ?? false,
      grantedAt: record?.grantedAt?.toISOString() ?? null,
      revokedAt: record?.revokedAt?.toISOString() ?? null,
      description: CONSENT_DESCRIPTIONS[cat] ?? '',
      dataRetentionDays: record?.dataRetentionDays ?? 730,
    };
  }

  return NextResponse.json({ consents: statusMap });
}, { skipCsrf: true });

// ── POST — Record or update consent ──────────────────────────

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  const userId = session.user.id!;

  const body = await request.json();
  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, accepted } = parsed.data;
  const now = new Date();

  // Extract IP from request headers for audit trail
  const ipAddress =
    request.headers.get('x-azure-clientip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1';

  try {
    const record = await prisma.lmsConsentRecord.upsert({
      where: {
        tenantId_userId_category: {
          tenantId,
          userId,
          category: type,
        },
      },
      create: {
        tenantId,
        userId,
        category: type,
        granted: accepted,
        grantedAt: accepted ? now : null,
        revokedAt: accepted ? null : now,
        description: CONSENT_DESCRIPTIONS[type] ?? '',
        consentMethod: 'api',
        ipAddress,
      },
      update: {
        granted: accepted,
        grantedAt: accepted ? now : undefined,
        revokedAt: accepted ? null : now,
        consentMethod: 'api',
        ipAddress,
      },
    });

    logger.info('[LMS Consent] Consent recorded', {
      userId,
      tenantId,
      category: type,
      accepted,
    });

    return NextResponse.json({
      success: true,
      consent: {
        category: record.category,
        granted: record.granted,
        grantedAt: record.grantedAt?.toISOString() ?? null,
        revokedAt: record.revokedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    logger.error('[LMS Consent] Failed to record consent', {
      userId,
      tenantId,
      error: 'Operation failed',
    });
    return NextResponse.json(
      { error: 'Failed to record consent' },
      { status: 500 }
    );
  }
});
