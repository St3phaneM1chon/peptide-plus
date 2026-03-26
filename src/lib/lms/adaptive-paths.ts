/**
 * Adaptive Learning Paths Service (stub)
 * TODO: Full implementation of adaptive recommendation engine
 */

import { logger } from '@/lib/logger';

interface AdaptiveRecommendation {
  nextLessonId: string | null;
  reviewLessonIds: string[];
  difficulty: 'easier' | 'same' | 'harder';
  message: string;
}

/**
 * Generate an adaptive recommendation based on quiz performance.
 * Currently returns a basic pass-through recommendation.
 */
export async function getAdaptiveRecommendation(
  _userId: string,
  _lessonId: string,
  quizScore: number
): Promise<AdaptiveRecommendation> {
  logger.debug('[adaptive] Generating recommendation', { quizScore });

  if (quizScore >= 80) {
    return {
      nextLessonId: null,
      reviewLessonIds: [],
      difficulty: 'harder',
      message: 'Great performance! Ready for the next challenge.',
    };
  }

  if (quizScore >= 50) {
    return {
      nextLessonId: null,
      reviewLessonIds: [],
      difficulty: 'same',
      message: 'Good effort. Review the material before proceeding.',
    };
  }

  return {
    nextLessonId: null,
    reviewLessonIds: [],
    difficulty: 'easier',
    message: 'Consider reviewing the fundamentals before retrying.',
  };
}
