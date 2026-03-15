/**
 * AI Scoring Engine — Coaching Call Analysis
 *
 * Analyzes coaching call transcripts to generate competency scores:
 * - Keyword detection (positive/negative terms per criterion)
 * - Talk-time ratio (coach vs student)
 * - Sentiment analysis (basic positive/negative scoring)
 * - Competency grid auto-fill (CoachingScore records)
 *
 * Criteria are configurable per company/session topic.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Default coaching criteria for insurance training (Aptitudes.vip / Chubb).
 * Each criterion has keywords that indicate competency.
 */
const DEFAULT_CRITERIA: ScoringCriterion[] = [
  {
    name: 'Accueil client',
    weight: 1.0,
    positiveKeywords: ['bonjour', 'bienvenue', 'comment puis-je', 'enchanté', 'merci d\'appeler'],
    negativeKeywords: ['oui allô', 'c\'est qui', 'quoi'],
  },
  {
    name: 'Écoute active',
    weight: 1.5,
    positiveKeywords: ['je comprends', 'si je comprends bien', 'vous dites que', 'effectivement', 'tout à fait'],
    negativeKeywords: ['mais non', 'vous avez tort', 'ce n\'est pas vrai'],
  },
  {
    name: 'Identification des besoins',
    weight: 1.5,
    positiveKeywords: ['quels sont vos besoins', 'qu\'est-ce qui est important', 'votre situation', 'vos priorités', 'vos objectifs'],
    negativeKeywords: [],
  },
  {
    name: 'Argumentation produit',
    weight: 1.0,
    positiveKeywords: ['avantage', 'bénéfice', 'protection', 'couverture', 'garantie', 'économiser', 'sécurité'],
    negativeKeywords: ['je ne sais pas', 'peut-être', 'je pense que'],
  },
  {
    name: 'Traitement des objections',
    weight: 1.0,
    positiveKeywords: ['je comprends votre préoccupation', 'c\'est une bonne question', 'permettez-moi', 'en fait'],
    negativeKeywords: ['non mais', 'vous avez tort', 'ce n\'est pas ça'],
  },
  {
    name: 'Conclusion et engagement',
    weight: 1.0,
    positiveKeywords: ['prochaine étape', 'je vous propose', 'souhaitez-vous', 'êtes-vous d\'accord', 'confirmer', 'rendez-vous'],
    negativeKeywords: ['bon ben', 'voilà c\'est tout', 'au revoir'],
  },
  {
    name: 'Professionnalisme',
    weight: 0.5,
    positiveKeywords: ['monsieur', 'madame', 's\'il vous plaît', 'je vous remercie', 'avec plaisir'],
    negativeKeywords: ['tu', 'genre', 'tsé', 'faque', 'whatever'],
  },
];

interface ScoringCriterion {
  name: string;
  weight: number;
  positiveKeywords: string[];
  negativeKeywords: string[];
}

interface ScoringResult {
  sessionId: string;
  overallScore: number;
  criteria: Array<{
    criterion: string;
    score: number;
    weight: number;
    comment: string;
  }>;
  talkTimeRatio: { coach: number; student: number };
  sentiment: { positive: number; negative: number; neutral: number };
  wordCount: number;
}

/**
 * Score a coaching session based on its transcript.
 * Fetches the transcript from CallTranscription linked to the session's call.
 */
export async function scoreCoachingSession(
  sessionId: string,
  customCriteria?: ScoringCriterion[]
): Promise<ScoringResult> {
  const session = await prisma.coachingSession.findUnique({
    where: { id: sessionId },
    include: {
      callLog: {
        include: {
          transcription: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error(`Coaching session ${sessionId} not found`);
  }

  // Get transcript text
  let transcript = '';
  if (session.callLog?.transcription) {
    transcript = session.callLog.transcription.fullText || '';
  }

  if (!transcript) {
    logger.warn('[Scoring] No transcript available', { sessionId });
    // Return default scores
    return createDefaultResult(sessionId);
  }

  const criteria = customCriteria || DEFAULT_CRITERIA;
  const lowerTranscript = transcript.toLowerCase();
  const wordCount = lowerTranscript.split(/\s+/).length;

  // Score each criterion
  const criteriaResults = criteria.map(criterion => {
    const positiveHits = criterion.positiveKeywords.filter(kw =>
      lowerTranscript.includes(kw.toLowerCase())
    ).length;

    const negativeHits = criterion.negativeKeywords.filter(kw =>
      lowerTranscript.includes(kw.toLowerCase())
    ).length;

    const maxPositive = Math.max(criterion.positiveKeywords.length, 1);
    const positiveRatio = positiveHits / maxPositive;

    // Score formula: base 5 + positive bonus (up to 4) - negative penalty (up to 3)
    // Clamped to 1-10
    let score = 5 + (positiveRatio * 4) - (negativeHits * 1.5);
    score = Math.max(1, Math.min(10, Math.round(score)));

    const comment = generateCriterionComment(criterion.name, score, positiveHits, negativeHits);

    return {
      criterion: criterion.name,
      score,
      weight: criterion.weight,
      comment,
    };
  });

  // Calculate weighted overall score
  const totalWeight = criteriaResults.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = criteriaResults.reduce((sum, c) => sum + c.score * c.weight, 0);
  const overallScore = Math.round((weightedSum / totalWeight) * 10) / 10;

  // Basic sentiment analysis
  const sentiment = analyzeSentiment(lowerTranscript);

  // Talk time ratio (approximate by word distribution if dual-channel available)
  const talkTimeRatio = estimateTalkTime(transcript);

  // Save scores to database
  await saveScores(sessionId, criteriaResults);

  const result: ScoringResult = {
    sessionId,
    overallScore,
    criteria: criteriaResults,
    talkTimeRatio,
    sentiment,
    wordCount,
  };

  logger.info('[Scoring] Session scored', {
    sessionId,
    overallScore,
    wordCount,
    criteriaCount: criteriaResults.length,
  });

  return result;
}

/**
 * Get scoring results for a session.
 */
export async function getSessionScores(sessionId: string): Promise<{
  scores: Array<{
    criterion: string;
    score: number;
    weight: number;
    comment: string | null;
    isAutoScored: boolean;
  }>;
  overallScore: number;
}> {
  const scores = await prisma.coachingScore.findMany({
    where: { sessionId },
    orderBy: { criterion: 'asc' },
  });

  if (scores.length === 0) {
    return { scores: [], overallScore: 0 };
  }

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = scores.reduce((sum, s) => sum + s.score * s.weight, 0);
  const overallScore = Math.round((weightedSum / totalWeight) * 10) / 10;

  return {
    scores: scores.map(s => ({
      criterion: s.criterion,
      score: s.score,
      weight: s.weight,
      comment: s.comment,
      isAutoScored: s.isAutoScored,
    })),
    overallScore,
  };
}

/**
 * Manually override or add a score for a criterion.
 */
export async function setManualScore(
  sessionId: string,
  criterion: string,
  score: number,
  comment?: string
): Promise<void> {
  await prisma.coachingScore.upsert({
    where: {
      sessionId_criterion: { sessionId, criterion },
    },
    update: {
      score: Math.max(1, Math.min(10, score)),
      comment,
      isAutoScored: false,
    },
    create: {
      sessionId,
      criterion,
      score: Math.max(1, Math.min(10, score)),
      comment,
      isAutoScored: false,
    },
  });
}

/**
 * Get aggregate scores for a student across all their coaching sessions.
 */
export async function getStudentProgress(
  studentId: string,
  options?: { limit?: number }
): Promise<{
  sessions: Array<{
    sessionId: string;
    scheduledAt: Date;
    topic: string | null;
    overallScore: number;
    status: string;
  }>;
  averageBycriterion: Record<string, number>;
}> {
  const limit = options?.limit || 20;

  const sessions = await prisma.coachingSession.findMany({
    where: { studentId, status: 'COMPLETED' },
    include: {
      scores: true,
    },
    orderBy: { scheduledAt: 'desc' },
    take: limit,
  });

  const sessionResults = sessions.map(s => {
    const totalWeight = s.scores.reduce((sum, sc) => sum + sc.weight, 0);
    const weightedSum = s.scores.reduce((sum, sc) => sum + sc.score * sc.weight, 0);
    const overallScore = totalWeight > 0
      ? Math.round((weightedSum / totalWeight) * 10) / 10
      : 0;

    return {
      sessionId: s.id,
      scheduledAt: s.scheduledAt,
      topic: s.topic,
      overallScore,
      status: s.status,
    };
  });

  // Average by criterion across all sessions
  const criterionTotals: Record<string, { sum: number; count: number }> = {};
  for (const s of sessions) {
    for (const sc of s.scores) {
      if (!criterionTotals[sc.criterion]) {
        criterionTotals[sc.criterion] = { sum: 0, count: 0 };
      }
      criterionTotals[sc.criterion].sum += sc.score;
      criterionTotals[sc.criterion].count += 1;
    }
  }

  const averageBycriterion: Record<string, number> = {};
  for (const [criterion, totals] of Object.entries(criterionTotals)) {
    averageBycriterion[criterion] = Math.round((totals.sum / totals.count) * 10) / 10;
  }

  return { sessions: sessionResults, averageBycriterion };
}

// ── Helpers ──────────────────

function createDefaultResult(sessionId: string): ScoringResult {
  return {
    sessionId,
    overallScore: 0,
    criteria: DEFAULT_CRITERIA.map(c => ({
      criterion: c.name,
      score: 0,
      weight: c.weight,
      comment: 'Aucune transcription disponible',
    })),
    talkTimeRatio: { coach: 50, student: 50 },
    sentiment: { positive: 0, negative: 0, neutral: 100 },
    wordCount: 0,
  };
}

function generateCriterionComment(
  name: string,
  score: number,
  positiveHits: number,
  negativeHits: number
): string {
  if (score >= 8) return `Excellent — ${positiveHits} indicateur(s) positif(s) détecté(s)`;
  if (score >= 6) return `Bien — ${positiveHits} indicateur(s) positif(s), ${negativeHits} point(s) à améliorer`;
  if (score >= 4) return `Moyen — efforts notés mais ${negativeHits} point(s) négatif(s)`;
  return `À améliorer — peu d'indicateurs positifs pour "${name}"`;
}

function analyzeSentiment(text: string): { positive: number; negative: number; neutral: number } {
  const positiveWords = [
    'excellent', 'parfait', 'merci', 'formidable', 'super', 'très bien',
    'bravo', 'content', 'satisfait', 'heureux', 'accord', 'intéressant',
  ];
  const negativeWords = [
    'problème', 'malheureusement', 'désolé', 'impossible', 'difficile',
    'plainte', 'insatisfait', 'mécontent', 'erreur', 'mauvais', 'non',
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const w of positiveWords) {
    const regex = new RegExp(w, 'gi');
    const matches = text.match(regex);
    if (matches) positiveCount += matches.length;
  }

  for (const w of negativeWords) {
    const regex = new RegExp(w, 'gi');
    const matches = text.match(regex);
    if (matches) negativeCount += matches.length;
  }

  const sentimentTotal = positiveCount + negativeCount || 1;
  return {
    positive: Math.round((positiveCount / sentimentTotal) * 100),
    negative: Math.round((negativeCount / sentimentTotal) * 100),
    neutral: Math.max(0, 100 - Math.round((positiveCount / sentimentTotal) * 100) - Math.round((negativeCount / sentimentTotal) * 100)),
  };
}

function estimateTalkTime(transcript: string): { coach: number; student: number } {
  // If dual-channel transcript has speaker labels
  const coachLines = (transcript.match(/\[coach\]|\[agent\]|\[formateur\]/gi) || []).length;
  const studentLines = (transcript.match(/\[student\]|\[client\]|\[étudiant\]/gi) || []).length;

  if (coachLines + studentLines > 0) {
    const total = coachLines + studentLines;
    return {
      coach: Math.round((coachLines / total) * 100),
      student: Math.round((studentLines / total) * 100),
    };
  }

  // Default assumption: roughly even
  return { coach: 50, student: 50 };
}

// N+1 FIX: Batch all upserts in a single $transaction instead of
// sequential individual upserts (was 1 query per criterion, now 1 transaction)
async function saveScores(
  sessionId: string,
  criteria: Array<{ criterion: string; score: number; weight: number; comment: string }>
): Promise<void> {
  await prisma.$transaction(
    criteria.map((c) =>
      prisma.coachingScore.upsert({
        where: {
          sessionId_criterion: { sessionId, criterion: c.criterion },
        },
        update: {
          score: c.score,
          weight: c.weight,
          comment: c.comment,
          isAutoScored: true,
        },
        create: {
          sessionId,
          criterion: c.criterion,
          score: c.score,
          weight: c.weight,
          comment: c.comment,
          isAutoScored: true,
        },
      })
    )
  );
}
