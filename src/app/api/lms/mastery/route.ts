export const dynamic = 'force-dynamic';

/**
 * Concept Mastery API
 * GET  /api/lms/mastery?conceptId=xxx → returns mastery state for one concept
 * GET  /api/lms/mastery → returns all mastery states for the student
 * POST /api/lms/mastery → updates mastery using FSRS engine
 *
 * SEC-HARDENING: Wrapped with withUserGuard for centralized auth + CSRF + rate limiting.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import {
  scheduleReview,
  quizScoreToRating,
  createNewCard,
  type FsrsCard,
  type Rating,
} from '@/lib/lms/fsrs-engine';

const updateMasterySchema = z.object({
  conceptId: z.string().min(1),
  quizScore: z.number().min(0).max(100),
  rating: z.number().min(1).max(4).optional(), // FSRS rating 1-4; auto-derived from quizScore if omitted
  passingScore: z.number().min(0).max(100).optional().default(70),
});

export const GET = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const conceptId = searchParams.get('conceptId');
  const view = searchParams.get('view'); // 'dashboard' returns full concept grid
  const userId = session.user.id!;

  if (conceptId) {
    // Return mastery for a single concept
    const mastery = await prisma.lmsConceptMastery.findUnique({
      where: { tenantId_userId_conceptId: { tenantId, userId, conceptId } },
      include: {
        concept: { select: { id: true, name: true, domain: true, targetBloomLevel: true, description: true, difficulty: true, estimatedMinutes: true } },
      },
    });

    if (!mastery) {
      // Still return the concept info even if no mastery record
      const concept = await prisma.lmsConcept.findFirst({
        where: { id: conceptId, tenantId, isActive: true },
        select: { id: true, slug: true, name: true, description: true, domain: true, targetBloomLevel: true, difficulty: true, estimatedMinutes: true },
      });
      return NextResponse.json({
        mastery: null,
        concept: concept ?? null,
        message: 'No mastery record yet for this concept',
      });
    }

    return NextResponse.json({ mastery: formatMastery(mastery) });
  }

  // Dashboard view: return ALL concepts (including untested) with mastery grid
  if (view === 'dashboard') {
    const [concepts, masteries] = await Promise.all([
      prisma.lmsConcept.findMany({
        where: { tenantId, isActive: true },
        select: {
          id: true, slug: true, name: true, description: true,
          domain: true, targetBloomLevel: true, difficulty: true, estimatedMinutes: true,
        },
        orderBy: [{ domain: 'asc' }, { name: 'asc' }],
        take: 500,
      }),
      prisma.lmsConceptMastery.findMany({
        where: { tenantId, userId },
        select: {
          conceptId: true, currentLevel: true, confidence: true,
          interval: true, reviewCount: true, nextReviewAt: true,
          lastTestedAt: true, lastCorrectAt: true,
          totalAttempts: true, totalCorrect: true, strengthHistory: true,
        },
        take: 500,
      }),
    ]);

    const masteryMap = new Map(masteries.map(m => [m.conceptId, m]));
    const now = new Date();

    const conceptGrid = concepts.map(concept => {
      const m = masteryMap.get(concept.id);
      let status: 'untested' | 'weak' | 'in_progress' | 'mastered';
      if (!m || m.currentLevel === 0) {
        status = 'untested';
      } else if (m.currentLevel <= 1 || m.confidence < 0.3) {
        status = 'weak';
      } else if (m.currentLevel < concept.targetBloomLevel || m.confidence < 0.7) {
        status = 'in_progress';
      } else {
        status = 'mastered';
      }
      return {
        ...concept,
        mastery: m ? {
          currentLevel: m.currentLevel,
          confidence: m.confidence,
          reviewCount: m.reviewCount,
          nextReviewAt: m.nextReviewAt?.toISOString() ?? null,
          lastTestedAt: m.lastTestedAt?.toISOString() ?? null,
          totalAttempts: m.totalAttempts,
          totalCorrect: m.totalCorrect,
          strengthHistory: m.strengthHistory,
        } : null,
        status,
      };
    });

    const reviewQueue = conceptGrid
      .filter(c => c.mastery?.nextReviewAt && new Date(c.mastery.nextReviewAt) <= now)
      .sort((a, b) => {
        const aTime = a.mastery?.nextReviewAt ? new Date(a.mastery.nextReviewAt).getTime() : 0;
        const bTime = b.mastery?.nextReviewAt ? new Date(b.mastery.nextReviewAt).getTime() : 0;
        return aTime - bTime;
      })
      .slice(0, 20);

    const stats = {
      total: conceptGrid.length,
      mastered: conceptGrid.filter(c => c.status === 'mastered').length,
      inProgress: conceptGrid.filter(c => c.status === 'in_progress').length,
      weak: conceptGrid.filter(c => c.status === 'weak').length,
      untested: conceptGrid.filter(c => c.status === 'untested').length,
      dueForReview: reviewQueue.length,
    };

    const domains = [...new Set(concepts.map(c => c.domain))].sort();

    return NextResponse.json({ concepts: conceptGrid, reviewQueue, stats, domains });
  }

  // Default: return all mastery states for the student (only tested concepts)
  const masteries = await prisma.lmsConceptMastery.findMany({
    where: { tenantId, userId },
    include: {
      concept: { select: { id: true, name: true, domain: true, targetBloomLevel: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    masteries: masteries.map(formatMastery),
    total: masteries.length,
  });
}, { skipCsrf: true });

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateMasterySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid mastery update data' }, { status: 400 });
  }

  const { conceptId, quizScore, passingScore } = parsed.data;
  const userId = session.user.id!;

  // Verify concept exists
  const concept = await prisma.lmsConcept.findFirst({
    where: { id: conceptId, tenantId, isActive: true },
    select: { id: true, name: true, targetBloomLevel: true },
  });

  if (!concept) {
    return NextResponse.json({ error: 'Concept not found' }, { status: 404 });
  }

  // Get or create mastery record
  let mastery = await prisma.lmsConceptMastery.findUnique({
    where: { tenantId_userId_conceptId: { tenantId, userId, conceptId } },
  });

  // Determine FSRS rating from quiz score (or use explicit rating)
  const rating: Rating = (parsed.data.rating as Rating) ?? quizScoreToRating(quizScore, passingScore!);

  // Build FSRS card from mastery record
  const card: FsrsCard = mastery
    ? {
        difficulty: Number(mastery.easiness) * 2, // V2 P2 FIX: Convert SM-2 easiness (0.5-5) to FSRS difficulty (1-10)
        stability: mastery.interval,
        retrievability: mastery.confidence,
        lastReview: mastery.lastTestedAt,
        interval: mastery.interval,
        reps: mastery.reviewCount,
        lapses: mastery.totalAttempts - mastery.totalCorrect,
      }
    : createNewCard();

  // Schedule next review using FSRS
  const now = new Date();
  const reviewResult = scheduleReview(card, rating, now);

  // Calculate new mastery level based on quiz score
  const isCorrect = quizScore >= passingScore!;
  const newLevel = isCorrect
    ? Math.min(5, (mastery?.currentLevel ?? 0) + 1)
    : Math.max(0, (mastery?.currentLevel ?? 0) - 1);

  // Update or create mastery record
  const updatedMastery = await prisma.lmsConceptMastery.upsert({
    where: { tenantId_userId_conceptId: { tenantId, userId, conceptId } },
    create: {
      tenantId,
      userId,
      conceptId,
      currentLevel: newLevel,
      confidence: Math.min(1, quizScore / 100),
      easiness: reviewResult.newDifficulty,
      interval: reviewResult.interval,
      reviewCount: 1,
      nextReviewAt: reviewResult.nextReview,
      lastTestedAt: now,
      lastCorrectAt: isCorrect ? now : null,
      totalAttempts: 1,
      totalCorrect: isCorrect ? 1 : 0,
      strengthHistory: JSON.stringify([{
        date: now.toISOString(),
        level: newLevel,
        confidence: quizScore / 100,
        score: quizScore,
      }]),
    },
    update: {
      currentLevel: newLevel,
      confidence: Math.min(1, quizScore / 100),
      easiness: reviewResult.newDifficulty,
      interval: reviewResult.interval,
      reviewCount: { increment: 1 },
      nextReviewAt: reviewResult.nextReview,
      lastTestedAt: now,
      ...(isCorrect && { lastCorrectAt: now }),
      totalAttempts: { increment: 1 },
      totalCorrect: isCorrect ? { increment: 1 } : undefined,
    },
    include: {
      concept: { select: { id: true, name: true, domain: true, targetBloomLevel: true } },
    },
  });

  return NextResponse.json({
    mastery: formatMastery(updatedMastery),
    fsrs: {
      rating,
      nextReview: reviewResult.nextReview.toISOString(),
      interval: reviewResult.interval,
      newDifficulty: reviewResult.newDifficulty,
      newStability: reviewResult.newStability,
    },
  });
});

// ── Helpers ───────────────────────────────────────────────────────────

interface MasteryRecord {
  id: string;
  conceptId: string;
  currentLevel: number;
  confidence: number;
  interval: number;
  reviewCount: number;
  nextReviewAt: Date | null;
  lastTestedAt: Date | null;
  lastCorrectAt: Date | null;
  totalAttempts: number;
  totalCorrect: number;
  concept?: { id: string; name: string; domain: string; targetBloomLevel: number } | null;
}

function formatMastery(m: MasteryRecord) {
  return {
    id: m.id,
    conceptId: m.conceptId,
    conceptName: m.concept?.name ?? null,
    domain: m.concept?.domain ?? null,
    currentLevel: m.currentLevel,
    targetLevel: m.concept?.targetBloomLevel ?? 3,
    confidence: m.confidence,
    interval: m.interval,
    reviewCount: m.reviewCount,
    nextReviewAt: m.nextReviewAt?.toISOString() ?? null,
    lastTestedAt: m.lastTestedAt?.toISOString() ?? null,
    lastCorrectAt: m.lastCorrectAt?.toISOString() ?? null,
    totalAttempts: m.totalAttempts,
    totalCorrect: m.totalCorrect,
    accuracyRate: m.totalAttempts > 0
      ? Math.round((m.totalCorrect / m.totalAttempts) * 100)
      : 0,
    isMastered: m.currentLevel >= (m.concept?.targetBloomLevel ?? 3),
  };
}
