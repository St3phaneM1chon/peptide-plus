/**
 * AI Quiz Generator — Generate quiz questions from lesson content via Claude API
 *
 * Uses the lesson's manualText or textContent to generate contextually relevant
 * quiz questions at various Bloom taxonomy levels.
 */

import { logger } from '@/lib/logger';

// Lazy-load Anthropic SDK
type AnthropicClient = import('@anthropic-ai/sdk').default;
let _anthropic: AnthropicClient | null = null;

async function getAnthropicClient(): Promise<AnthropicClient> {
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ── Types ──

export interface GeneratedQuestion {
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN';
  question: string;
  options: string[] | null; // null for FILL_IN, array for MCQ/TF
  correctAnswer: string;
  explanation: string;
  bloomLevel: number; // 1-5
  points: number;
}

export interface QuizGenerationOptions {
  lessonTitle: string;
  content: string; // manualText or textContent
  questionCount?: number; // default 5
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed'; // default mixed
  types?: ('MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN')[]; // default all
  language?: 'fr' | 'en'; // default fr
  domain?: string; // e.g., "assurance vie", "deontologie"
}

// ── Generator ──

export async function generateQuizQuestions(
  options: QuizGenerationOptions
): Promise<GeneratedQuestion[]> {
  const {
    lessonTitle,
    content,
    questionCount = 5,
    difficulty = 'mixed',
    types = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN'],
    language = 'fr',
    domain,
  } = options;

  if (!content || content.length < 50) {
    throw new Error('Content too short to generate meaningful questions');
  }
  // FIX P2: Cap questionCount to prevent excessive API cost
  const safeQuestionCount = Math.min(questionCount, 20);

  // Truncate content if too long (Claude context limit)
  const truncatedContent = content.length > 15000 ? content.slice(0, 15000) + '\n[...]' : content;

  const isFr = language === 'fr';

  const systemPrompt = isFr
    ? `Tu es un expert en creation de quiz pour la formation professionnelle en assurance au Canada. Tu generes des questions de quiz basees sur le contenu fourni. Les questions doivent etre precises, pertinentes et tester la comprehension reelle du contenu.

REGLES:
1. Chaque question doit etre directement liee au contenu fourni
2. Les distracteurs (mauvaises reponses) doivent etre plausibles mais clairement faux
3. L'explication doit citer la partie du contenu qui justifie la bonne reponse
4. Varier les niveaux de Bloom (1=memorisation, 2=comprehension, 3=application, 4=analyse, 5=evaluation)
5. Les questions TRUE_FALSE doivent avoir "Vrai" ou "Faux" comme reponse correcte
6. Les questions FILL_IN doivent avoir un mot ou expression courte comme reponse`
    : `You are an expert quiz creator for professional insurance training in Canada. Generate quiz questions based on the provided content.`;

  const userPrompt = `${isFr ? 'Contenu de la lecon' : 'Lesson content'} "${lessonTitle}"${domain ? ` (${isFr ? 'domaine' : 'domain'}: ${domain})` : ''}:

---
${truncatedContent}
---

${isFr ? 'Genere' : 'Generate'} ${safeQuestionCount} ${isFr ? 'questions' : 'questions'} (${isFr ? 'difficulte' : 'difficulty'}: ${difficulty}).
${isFr ? 'Types autorises' : 'Allowed types'}: ${types.join(', ')}

${isFr ? 'Reponds en JSON valide' : 'Respond in valid JSON'}:
{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN",
      "question": "...",
      "options": ["A", "B", "C", "D"] | ["Vrai", "Faux"] | null,
      "correctAnswer": "...",
      "explanation": "...",
      "bloomLevel": 1-5,
      "points": 1-5
    }
  ]
}`;

  try {
    const client = await getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const questions: GeneratedQuestion[] = (parsed.questions || []).map((q: GeneratedQuestion) => ({
      type: q.type,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      bloomLevel: Math.min(5, Math.max(1, q.bloomLevel || 2)),
      points: Math.min(5, Math.max(1, q.points || 1)),
    }));

    logger.info(`[AI Quiz] Generated ${questions.length} questions for "${lessonTitle}"`);
    return questions;

  } catch (error) {
    logger.error('[AI Quiz] Generation failed', { error, lessonTitle });
    throw new Error(`Quiz generation failed: ${(error as Error).message}`);
  }
}
