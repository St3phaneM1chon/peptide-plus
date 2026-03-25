/**
 * AI Course Generator — Generate course structure from uploaded documents (PDF, DOCX, TXT)
 * Uses Claude API to analyze document content and create a structured course outline.
 */

import { logger } from '@/lib/logger';

type AnthropicClient = import('@anthropic-ai/sdk').default;
let _anthropic: AnthropicClient | null = null;

async function getClient(): Promise<AnthropicClient> {
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

export interface GeneratedCourseOutline {
  title: string;
  subtitle: string;
  description: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  estimatedHours: number;
  tags: string[];
  chapters: Array<{
    title: string;
    description: string;
    lessons: Array<{
      title: string;
      description: string;
      type: 'TEXT' | 'VIDEO' | 'QUIZ' | 'EXERCISE';
      estimatedMinutes: number;
      manualText?: string;
      keyPoints: string[];
      quizQuestions?: Array<{
        question: string;
        type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
        options: string[];
        correctAnswer: string;
        explanation: string;
      }>;
    }>;
  }>;
}

/**
 * Generate a complete course outline from document text content.
 */
export async function generateCourseFromDocument(
  documentText: string,
  options?: {
    language?: 'fr' | 'en';
    domain?: string;
    targetAudience?: string;
    maxChapters?: number;
  }
): Promise<GeneratedCourseOutline> {
  const { language = 'fr', domain, targetAudience, maxChapters = 10 } = options ?? {};
  const isFr = language === 'fr';

  // Truncate to ~50K chars (Claude context)
  const content = documentText.length > 50000 ? documentText.slice(0, 50000) + '\n[... document tronque ...]' : documentText;

  const systemPrompt = isFr
    ? `Tu es un concepteur pedagogique expert en formation professionnelle pour l'industrie de l'assurance au Canada. A partir du contenu d'un document, tu crees une structure de cours complete, pedagogiquement solide et engageante.

REGLES:
1. Chaque chapitre couvre un theme majeur du document
2. Chaque lecon couvre une notion specifique
3. Inclure des quiz de verification apres chaque 2-3 lecons
4. Les exercices doivent etre des mises en situation professionnelles
5. Le contenu doit etre adapte au marche canadien (Quebec et provinces)
6. Maximum ${maxChapters} chapitres`
    : `You are an expert instructional designer for professional insurance training in Canada. Create a complete course structure from document content.`;

  const userPrompt = `${isFr ? 'Document source' : 'Source document'}${domain ? ` (${domain})` : ''}${targetAudience ? ` — ${isFr ? 'Public cible' : 'Target audience'}: ${targetAudience}` : ''}:

---
${content}
---

${isFr ? 'Genere la structure complete du cours en JSON' : 'Generate complete course structure in JSON'}:
{
  "title": "...",
  "subtitle": "...",
  "description": "...",
  "level": "BEGINNER|INTERMEDIATE|ADVANCED|EXPERT",
  "estimatedHours": N,
  "tags": ["...", "..."],
  "chapters": [
    {
      "title": "...",
      "description": "...",
      "lessons": [
        {
          "title": "...",
          "description": "...",
          "type": "TEXT|VIDEO|QUIZ|EXERCISE",
          "estimatedMinutes": N,
          "manualText": "... (for TEXT type, extract relevant section from document)",
          "keyPoints": ["...", "..."],
          "quizQuestions": [{ "question": "...", "type": "MULTIPLE_CHOICE|TRUE_FALSE", "options": ["..."], "correctAnswer": "...", "explanation": "..." }]
        }
      ]
    }
  ]
}`;

  const client = await getClient();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in AI response');

  const outline = JSON.parse(jsonMatch[0]) as GeneratedCourseOutline;
  logger.info(`[AI Course Gen] Generated: "${outline.title}" — ${outline.chapters.length} chapters`);
  return outline;
}
