/**
 * Post-Call Survey Engine
 *
 * Manages survey template lifecycle and response collection for post-call
 * satisfaction measurement. Integrates with the CallSurvey Prisma model
 * and VoipSetting (JSON store) for survey configuration.
 *
 * Features:
 * - Survey template CRUD (stored as JSON in SiteSetting)
 * - Question builder with typed question options (rating, yes/no, open text, DTMF)
 * - Survey response aggregation and statistics
 * - Active survey selection for IVR integration
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SurveyQuestion {
  text: string;
  type: 'rating' | 'yes_no' | 'open_text' | 'dtmf';
}

export interface SurveyTemplate {
  id: string;
  name: string;
  questions: SurveyQuestion[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyResponse {
  callLogId: string;
  overallScore?: number;
  resolvedScore?: number;
  method: 'dtmf' | 'web_form';
  completedAt: Date;
}

export interface SurveyStats {
  totalResponses: number;
  averageOverallScore: number | null;
  averageResolvedScore: number | null;
  responsesByMethod: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

/**
 * Create a new survey template object with a unique ID.
 */
export function createSurveyTemplate(
  name: string,
  questions: SurveyQuestion[],
  isActive = true,
): SurveyTemplate {
  return {
    id: `survey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    questions,
    isActive,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate survey questions before saving.
 * Returns an array of error messages (empty = valid).
 */
export function validateSurveyQuestions(questions: SurveyQuestion[]): string[] {
  const errors: string[] = [];
  const validTypes = ['rating', 'yes_no', 'open_text', 'dtmf'];

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push('At least one question is required');
    return errors;
  }

  questions.forEach((q, idx) => {
    if (!q.text || typeof q.text !== 'string' || !q.text.trim()) {
      errors.push(`Question ${idx + 1}: text is required`);
    }
    if (!q.type || !validTypes.includes(q.type)) {
      errors.push(`Question ${idx + 1}: type must be one of ${validTypes.join(', ')}`);
    }
  });

  return errors;
}

/**
 * Get the default survey templates used when no custom configuration exists.
 */
export function getDefaultSurveyTemplates(): SurveyTemplate[] {
  return [
    createSurveyTemplate(
      'Post-Call Satisfaction',
      [
        { text: 'How would you rate your overall experience? (1-5)', type: 'rating' },
        { text: 'Was your issue resolved?', type: 'yes_no' },
      ],
      true,
    ),
  ];
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Compute aggregate statistics from a list of survey responses.
 */
export function computeSurveyStats(responses: SurveyResponse[]): SurveyStats {
  if (responses.length === 0) {
    return {
      totalResponses: 0,
      averageOverallScore: null,
      averageResolvedScore: null,
      responsesByMethod: {},
    };
  }

  const overallScores = responses
    .map((r) => r.overallScore)
    .filter((s): s is number => s != null);

  const resolvedScores = responses
    .map((r) => r.resolvedScore)
    .filter((s): s is number => s != null);

  const responsesByMethod: Record<string, number> = {};
  for (const r of responses) {
    responsesByMethod[r.method] = (responsesByMethod[r.method] || 0) + 1;
  }

  logger.info('[PostCallSurvey] Stats computed', {
    totalResponses: responses.length,
    overallScoreCount: overallScores.length,
  });

  return {
    totalResponses: responses.length,
    averageOverallScore:
      overallScores.length > 0
        ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length
        : null,
    averageResolvedScore:
      resolvedScores.length > 0
        ? resolvedScores.reduce((a, b) => a + b, 0) / resolvedScores.length
        : null,
    responsesByMethod,
  };
}
