/**
 * DIAGNOSTIC QUIZ SERVICE
 *
 * Quiz diagnostic rapide de 5 minutes au début de chaque cours.
 * Inspiré de Squirrel AI — cartographie instantanée des concepts maîtrisés.
 *
 * Algorithme:
 * 1. Récupérer tous les concepts prérequis du cours
 * 2. Sélectionner 1-2 questions de niveau 2 (compréhension) par concept
 * 3. L'étudiant répond en ≤5 minutes
 * 4. Résultat: carte de concepts connus/inconnus
 * 5. Le parcours saute les leçons des concepts déjà maîtrisés
 */

import { prisma } from '@/lib/db';

interface DiagnosticQuestion {
  id: string;
  conceptId: string;
  conceptName: string;
  question: string;
  type: string;
  options: unknown;
  correctAnswer: string | null;
}

interface DiagnosticConceptResult {
  conceptId: string;
  conceptName: string;
  known: boolean;
  confidence: number; // 0-1
  responseTimeSec: number;
}

/**
 * Génère un quiz diagnostic pour un cours
 * Sélectionne 1-2 questions par concept prérequis
 */
export async function generateDiagnosticQuiz(
  tenantId: string,
  courseId: string
): Promise<DiagnosticQuestion[]> {
  // Récupérer les chapitres/leçons du cours avec leurs concepts mappés
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId },
    include: {
      chapters: {
        include: {
          lessons: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!course) return [];

  // Récupérer tous les concepts liés à ce cours via LmsConceptLessonMap
  const lessonIds = course.chapters.flatMap(ch => ch.lessons.map(l => l.id));

  const conceptMappings = await prisma.lmsConceptLessonMap.findMany({
    where: { lessonId: { in: lessonIds } },
    include: {
      concept: true,
    },
    take: 200,
  });

  const uniqueConceptIds = [...new Set(conceptMappings.map(m => m.conceptId))];

  if (uniqueConceptIds.length === 0) return [];

  // Sélectionner 1-2 questions de niveau 2 (compréhension) par concept
  const questions = await prisma.lmsConceptQuestion.findMany({
    where: {
      tenantId,
      conceptId: { in: uniqueConceptIds },
      bloomLevel: { lte: 2 }, // Niveau 1-2 pour le diagnostic
      isActive: true,
    },
    include: {
      concept: { select: { id: true, name: true } },
    },
    take: 20, // Max 20 questions pour 5 minutes
  });

  // Limiter à 2 questions par concept
  const questionsByConceptMap = new Map<string, typeof questions>();
  for (const q of questions) {
    const list = questionsByConceptMap.get(q.conceptId) || [];
    if (list.length < 2) {
      list.push(q);
      questionsByConceptMap.set(q.conceptId, list);
    }
  }

  const selectedQuestions: DiagnosticQuestion[] = [];
  for (const [, conceptQuestions] of questionsByConceptMap) {
    for (const q of conceptQuestions) {
      selectedQuestions.push({
        id: q.id,
        conceptId: q.concept.id,
        conceptName: q.concept.name,
        question: q.question,
        type: q.type,
        options: q.options,
        correctAnswer: null, // Ne pas envoyer la réponse au client!
      });
    }
  }

  return selectedQuestions.slice(0, 10); // Max 10 questions
}

/**
 * Évalue les résultats du diagnostic et met à jour la maîtrise
 */
export async function evaluateDiagnostic(
  tenantId: string,
  userId: string,
  courseId: string,
  answers: Array<{ questionId: string; answer: string | string[]; responseTimeSec: number }>
): Promise<{
  results: DiagnosticConceptResult[];
  knownConcepts: number;
  unknownConcepts: number;
  lessonsToSkip: string[];
}> {
  // FIX P2: Validate total response time against diagnostic maxMinutes
  const totalTimeSec = answers.reduce((sum, a) => sum + (a.responseTimeSec || 0), 0);
  const diagnostic = await prisma.diagnosticQuiz.findFirst({
    where: { tenantId, courseId },
    select: { maxMinutes: true },
  });
  if (diagnostic?.maxMinutes && totalTimeSec > diagnostic.maxMinutes * 60 * 1.1) {
    // Allow 10% grace period
    throw new Error('Diagnostic time limit exceeded');
  }

  // Récupérer les questions avec leurs réponses correctes
  const questionIds = answers.map(a => a.questionId);
  const questions = await prisma.lmsConceptQuestion.findMany({
    where: { id: { in: questionIds } },
    include: { concept: { select: { id: true, name: true } } },
  });

  // Évaluer par concept
  const conceptResults = new Map<string, { correct: number; total: number; avgTime: number }>();

  for (const answer of answers) {
    const question = questions.find(q => q.id === answer.questionId);
    if (!question) continue;

    const isCorrect = gradeAnswer(question, answer.answer);
    const conceptId = question.conceptId;

    const existing = conceptResults.get(conceptId) || { correct: 0, total: 0, avgTime: 0 };
    existing.total += 1;
    if (isCorrect) existing.correct += 1;
    existing.avgTime = (existing.avgTime * (existing.total - 1) + answer.responseTimeSec) / existing.total;
    conceptResults.set(conceptId, existing);
  }

  // Construire les résultats
  const results: DiagnosticConceptResult[] = [];
  const knownConceptIds: string[] = [];

  for (const [conceptId, stats] of conceptResults) {
    const question = questions.find(q => q.conceptId === conceptId);
    const score = stats.total > 0 ? stats.correct / stats.total : 0;
    const known = score >= 0.7; // 70%+ = concept connu
    const confidence = Math.min(1, score * (stats.total > 1 ? 1 : 0.7)); // Plus de questions = plus de confiance

    results.push({
      conceptId,
      conceptName: question?.concept.name || 'Unknown',
      known,
      confidence,
      responseTimeSec: Math.round(stats.avgTime),
    });

    if (known) knownConceptIds.push(conceptId);

    // Mettre à jour la maîtrise du concept
    await prisma.lmsConceptMastery.upsert({
      where: { tenantId_userId_conceptId: { tenantId, userId, conceptId } },
      create: {
        tenantId,
        userId,
        conceptId,
        currentLevel: known ? 2 : 0, // Niveau 2 si connu (diagnostic teste niveau 2)
        confidence,
        lastTestedAt: new Date(),
      },
      update: {
        currentLevel: known ? 2 : 0,
        confidence,
        lastTestedAt: new Date(),
      },
    });
  }

  // Déterminer les leçons à sauter (concepts déjà maîtrisés)
  const lessonsToSkip: string[] = [];
  if (knownConceptIds.length > 0) {
    const skippableMappings = await prisma.lmsConceptLessonMap.findMany({
      where: {
        conceptId: { in: knownConceptIds },
        bloomLevel: { lte: 2 }, // Ne sauter que les leçons de niveau 1-2
      },
      select: { lessonId: true },
      take: 100,
    });
    lessonsToSkip.push(...skippableMappings.map(m => m.lessonId));
  }

  // Sauvegarder le résultat
  await prisma.diagnosticResult.create({
    data: {
      tenantId,
      userId,
      diagnosticId: courseId, // On utilise courseId comme clé
      conceptResults: JSON.parse(JSON.stringify(results)),
      totalConcepts: results.length,
      knownConcepts: results.filter(r => r.known).length,
      unknownConcepts: results.filter(r => !r.known).length,
      timeSpentSec: answers.reduce((sum, a) => sum + a.responseTimeSec, 0),
      lessonsSkipped: lessonsToSkip.length,
      pathGenerated: true,
    },
  });

  return {
    results,
    knownConcepts: results.filter(r => r.known).length,
    unknownConcepts: results.filter(r => !r.known).length,
    lessonsToSkip,
  };
}

function gradeAnswer(
  question: { type: string; options: unknown; correctAnswer: string | null },
  answer: string | string[]
): boolean {
  switch (question.type) {
    case 'MULTIPLE_CHOICE': {
      const options = question.options as Array<{ id: string; isCorrect: boolean }>;
      const correctIds = options.filter(o => o.isCorrect).map(o => o.id).sort();
      const selectedIds = (Array.isArray(answer) ? answer : [answer]).sort();
      return JSON.stringify(correctIds) === JSON.stringify(selectedIds);
    }
    case 'TRUE_FALSE': {
      const options = question.options as Array<{ id: string; isCorrect: boolean }>;
      const correct = options.find(o => o.isCorrect);
      return correct?.id === answer;
    }
    case 'FILL_IN':
      if (!question.correctAnswer) return false;
      return (Array.isArray(answer) ? answer[0] : answer)
        .trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    default:
      return false;
  }
}
