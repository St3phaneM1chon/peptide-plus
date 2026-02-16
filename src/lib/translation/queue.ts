/**
 * FILE D'ATTENTE DE TRADUCTION PERSISTANTE - BioCycle Peptides
 *
 * Queue backed by PostgreSQL (via Prisma TranslationJob model).
 * Survit aux redémarrages du serveur.
 *
 * Pipeline 3 passes:
 *   Pass 1 = GPT-4o-mini (immédiat, draft)
 *   Pass 2 = Claude Haiku (nuit, amélioration → improved)
 *   Pass 3 = GPT-4o validation (nuit, vérification → verified)
 *
 * Priorités:
 * 1 = Urgent (produit modifié, traduction manquante demandée)
 * 2 = High (nouveau produit, nouvelle catégorie)
 * 3 = Normal (nouvel article, blog post)
 * 4 = Low (vidéos, webinaires)
 * 5 = Batch (traduction initiale en masse)
 */

import { prisma } from '@/lib/db';
import {
  translateEntityAllLocales,
  TRANSLATABLE_FIELDS,
  type TranslatableModel,
} from './auto-translate';
import { buildGlossaryPrompt, getLanguageName } from './glossary';
import { locales, defaultLocale } from '@/i18n/config';
import type { TranslationJob as PrismaTranslationJob, TranslationJobStatus } from '@prisma/client';
import type OpenAI from 'openai';
import type Anthropic from '@anthropic-ai/sdk';

// ============================================
// TYPES
// ============================================

export type { PrismaTranslationJob as TranslationJob };

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  byPass: {
    pass1: { pending: number; completed: number; failed: number };
    pass2: { pending: number; completed: number; failed: number };
    pass3: { pending: number; completed: number; failed: number };
  };
}

// ============================================
// QUEUE STATE
// ============================================

let isProcessing = false;
let processingTimeout: NodeJS.Timeout | null = null;

// ============================================
// QUEUE OPERATIONS
// ============================================

/**
 * Add a translation job to the persistent queue.
 * Pass 1 = immediate draft, Pass 2 = improvement, Pass 3 = verification.
 */
export async function enqueueTranslation(
  model: TranslatableModel,
  entityId: string,
  options: { priority?: number; force?: boolean; pass?: number } = {}
): Promise<string> {
  const { priority = 3, force = false, pass = 1 } = options;

  // Check for existing pending/processing job with same model+entity+pass
  const existing = await prisma.translationJob.findFirst({
    where: {
      model,
      entityId,
      pass,
      status: { in: ['pending', 'processing'] },
    },
  });

  if (existing && !force) {
    return existing.id;
  }

  const job = await prisma.translationJob.create({
    data: {
      model,
      entityId,
      pass,
      priority,
      status: 'pending',
      scheduledAt: pass === 1 ? new Date() : getNextNightSlot(pass),
    },
  });

  // Start processing pass 1 jobs immediately
  if (pass === 1 && !isProcessing) {
    scheduleProcessing();
  }

  return job.id;
}

/**
 * Schedule pass 2/3 jobs for night processing.
 * Pass 2 at 2AM, Pass 3 at 4AM (local time).
 */
function getNextNightSlot(pass: number): Date {
  const now = new Date();
  const target = new Date(now);
  const targetHour = pass === 2 ? 2 : 4; // 2AM for pass 2, 4AM for pass 3

  target.setHours(targetHour, 0, 0, 0);
  // If we've passed the target hour today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/**
 * Enqueue translation for specific priority presets (Pass 1 only).
 * After Pass 1 completes, Pass 2 and 3 are auto-scheduled.
 */
export const enqueue = {
  product: (entityId: string, force = false) =>
    enqueueTranslation('Product', entityId, { priority: 2, force }),

  productUrgent: (entityId: string) =>
    enqueueTranslation('Product', entityId, { priority: 1, force: true }),

  productFormat: (entityId: string, force = false) =>
    enqueueTranslation('ProductFormat', entityId, { priority: 2, force }),

  category: (entityId: string, force = false) =>
    enqueueTranslation('Category', entityId, { priority: 2, force }),

  article: (entityId: string, force = false) =>
    enqueueTranslation('Article', entityId, { priority: 3, force }),

  blogPost: (entityId: string, force = false) =>
    enqueueTranslation('BlogPost', entityId, { priority: 3, force }),

  video: (entityId: string, force = false) =>
    enqueueTranslation('Video', entityId, { priority: 4, force }),

  webinar: (entityId: string, force = false) =>
    enqueueTranslation('Webinar', entityId, { priority: 4, force }),

  quickReply: (entityId: string, force = false) =>
    enqueueTranslation('QuickReply', entityId, { priority: 3, force }),

  faq: (entityId: string, force = false) =>
    enqueueTranslation('Faq', entityId, { priority: 3, force }),
};

/**
 * Get job status by ID
 */
export async function getJobStatus(jobId: string): Promise<PrismaTranslationJob | null> {
  return prisma.translationJob.findUnique({ where: { id: jobId } });
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
  const jobs = await prisma.translationJob.groupBy({
    by: ['status', 'pass'],
    _count: true,
  });

  const stats: QueueStats = {
    pending: 0, processing: 0, completed: 0, failed: 0, total: 0,
    byPass: {
      pass1: { pending: 0, completed: 0, failed: 0 },
      pass2: { pending: 0, completed: 0, failed: 0 },
      pass3: { pending: 0, completed: 0, failed: 0 },
    },
  };

  for (const group of jobs) {
    const count = group._count;
    stats.total += count;

    switch (group.status as TranslationJobStatus) {
      case 'pending': stats.pending += count; break;
      case 'processing': stats.processing += count; break;
      case 'completed': stats.completed += count; break;
      case 'failed': stats.failed += count; break;
    }

    const passKey = `pass${group.pass}` as keyof typeof stats.byPass;
    if (passKey in stats.byPass) {
      const statusKey = group.status as 'pending' | 'completed' | 'failed';
      if (statusKey in stats.byPass[passKey]) {
        stats.byPass[passKey][statusKey] += count;
      }
    }
  }

  return stats;
}

/**
 * Get jobs filtered by status and/or pass
 */
export async function getJobs(
  filters: { status?: TranslationJobStatus; pass?: number; limit?: number } = {}
): Promise<PrismaTranslationJob[]> {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.pass) where.pass = filters.pass;

  return prisma.translationJob.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
    take: filters.limit || 100,
  });
}

/**
 * Clean up completed/failed jobs older than specified hours
 */
export async function cleanupJobs(olderThanHours = 72): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const result = await prisma.translationJob.deleteMany({
    where: {
      status: { in: ['completed', 'failed'] },
      createdAt: { lt: cutoff },
    },
  });

  return result.count;
}

// ============================================
// QUEUE PROCESSING
// ============================================

function scheduleProcessing(delayMs = 100): void {
  if (processingTimeout) clearTimeout(processingTimeout);
  processingTimeout = setTimeout(processNextJob, delayMs);
}

async function processNextJob(): Promise<void> {
  const now = new Date();

  // Find next pending job that's ready to run (scheduledAt <= now)
  const job = await prisma.translationJob.findFirst({
    where: {
      status: 'pending',
      scheduledAt: { lte: now },
    },
    orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
  });

  if (!job) {
    isProcessing = false;
    return;
  }

  isProcessing = true;

  // Mark as processing
  await prisma.translationJob.update({
    where: { id: job.id },
    data: { status: 'processing', startedAt: now },
  });

  try {
    console.log(`[TranslationQueue] Pass ${job.pass}: Processing ${job.model}#${job.entityId} (priority: ${job.priority})`);

    // Execute the appropriate pass
    await executePass(job);

    // Mark completed
    await prisma.translationJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    console.log(`[TranslationQueue] Pass ${job.pass}: Completed ${job.model}#${job.entityId}`);

    // Auto-schedule next pass if applicable
    if (job.pass === 1) {
      await enqueueTranslation(job.model as TranslatableModel, job.entityId, {
        priority: job.priority,
        pass: 2,
      });
    } else if (job.pass === 2) {
      await enqueueTranslation(job.model as TranslatableModel, job.entityId, {
        priority: job.priority,
        pass: 3,
      });
    }
  } catch (error) {
    const retries = job.retries + 1;
    if (retries >= job.maxRetries) {
      await prisma.translationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          retries,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      console.error(`[TranslationQueue] Pass ${job.pass}: Failed (max retries) ${job.model}#${job.entityId}:`, error);
    } else {
      await prisma.translationJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          retries,
          scheduledAt: new Date(Date.now() + Math.pow(2, retries) * 1000),
        },
      });
      console.warn(`[TranslationQueue] Pass ${job.pass}: Retry ${retries}/${job.maxRetries} for ${job.model}#${job.entityId}`);
    }
  }

  // Schedule next job
  const delay = 500;
  scheduleProcessing(delay);
}

/**
 * Execute a translation pass based on pass number.
 * Pass 1: GPT-4o-mini (draft) - via existing translateEntityAllLocales
 * Pass 2: Claude Haiku (improvement) - reads draft, improves quality
 * Pass 3: GPT-4o (verification) - validates fluency, flags issues
 */
async function executePass(job: PrismaTranslationJob): Promise<void> {
  const model = job.model as TranslatableModel;

  switch (job.pass) {
    case 1:
      // Pass 1: Initial translation with GPT-4o-mini
      await translateEntityAllLocales(model, job.entityId, {
        force: true,
        concurrency: 3,
      });
      // Update quality level to 'draft'
      await updateQualityLevel(model, job.entityId, 'draft', 'gpt-4o-mini');
      break;

    case 2:
      // Pass 2: Improvement with Claude Haiku
      await improveTranslationsWithClaude(model, job.entityId);
      await updateQualityLevel(model, job.entityId, 'improved', 'claude-haiku-4-5');
      break;

    case 3:
      // Pass 3: Verification with GPT-4o
      await verifyTranslationsWithGPT4o(model, job.entityId);
      await updateQualityLevel(model, job.entityId, 'verified', 'gpt-4o');
      break;
  }
}

/**
 * Update qualityLevel for all translations of an entity.
 */
async function updateQualityLevel(
  model: TranslatableModel,
  entityId: string,
  quality: 'draft' | 'improved' | 'verified',
  translatedBy: string
): Promise<void> {
  const tableMap: Record<string, string> = {
    Product: 'productTranslation',
    ProductFormat: 'productFormatTranslation',
    Category: 'categoryTranslation',
    Article: 'articleTranslation',
    BlogPost: 'blogPostTranslation',
    Video: 'videoTranslation',
    Webinar: 'webinarTranslation',
    QuickReply: 'quickReplyTranslation',
    Faq: 'faqTranslation',
  };
  const fkMap: Record<string, string> = {
    Product: 'productId',
    ProductFormat: 'formatId',
    Category: 'categoryId',
    Article: 'articleId',
    BlogPost: 'blogPostId',
    Video: 'videoId',
    Webinar: 'webinarId',
    QuickReply: 'quickReplyId',
    Faq: 'faqId',
  };

  const tableName = tableMap[model];
  const fkField = fkMap[model];
  if (!tableName || !fkField) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access
  await ((prisma as Record<string, any>)[tableName]).updateMany({
    where: { [fkField]: entityId },
    data: { qualityLevel: quality, translatedBy },
  });
}

// ============================================
// LAZY AI CLIENT INITIALIZATION
// ============================================

let anthropicInstance: Anthropic | null = null;
let openaiInstance: OpenAI | null = null;

async function getAnthropic(): Promise<Anthropic> {
  if (!anthropicInstance) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured. Pass 2 requires Claude.');
    }
    const { default: AnthropicClient } = await import('@anthropic-ai/sdk');
    anthropicInstance = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicInstance;
}

async function getOpenAI(): Promise<OpenAI> {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured. Pass 3 requires GPT-4o.');
    }
    const { default: OpenAIClient } = await import('openai');
    openaiInstance = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiInstance;
}

// ============================================
// HELPERS FOR PASS 2/3
// ============================================

/** Prisma table + FK maps (duplicated from auto-translate for independence) */
const TABLE_MAP: Record<string, string> = {
  Product: 'productTranslation', ProductFormat: 'productFormatTranslation',
  Category: 'categoryTranslation', Article: 'articleTranslation',
  BlogPost: 'blogPostTranslation', Video: 'videoTranslation',
  Webinar: 'webinarTranslation', QuickReply: 'quickReplyTranslation',
  Faq: 'faqTranslation',
};
const FK_MAP: Record<string, string> = {
  Product: 'productId', ProductFormat: 'formatId',
  Category: 'categoryId', Article: 'articleId',
  BlogPost: 'blogPostId', Video: 'videoId',
  Webinar: 'webinarId', QuickReply: 'quickReplyId',
  Faq: 'faqId',
};

/** Read all existing translations for an entity */
async function readExistingTranslations(
  model: TranslatableModel,
  entityId: string
): Promise<Array<{ locale: string; fields: Record<string, string | null> }>> {
  const tableName = TABLE_MAP[model];
  const fkField = FK_MAP[model];
  if (!tableName || !fkField) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const translations = await ((prisma as Record<string, any>)[tableName]).findMany({
    where: { [fkField]: entityId },
  });

  const fieldNames = TRANSLATABLE_FIELDS[model] || [];
  return translations.map((t: Record<string, unknown>) => ({
    locale: t.locale as string,
    fields: Object.fromEntries(fieldNames.map(f => [f, (t[f] as string) || null])),
  }));
}

/** Read source entity fields (French/default locale) */
async function readSourceFields(
  model: TranslatableModel,
  entityId: string
): Promise<Record<string, string>> {
  const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entity = await ((prisma as Record<string, any>)[sourceModel]).findUnique({
    where: { id: entityId },
  });
  if (!entity) return {};

  const fieldNames = TRANSLATABLE_FIELDS[model] || [];
  const result: Record<string, string> = {};
  for (const f of fieldNames) {
    if (entity[f]) result[f] = entity[f];
  }
  return result;
}

/** Update a single translation in DB */
async function updateTranslationFields(
  model: TranslatableModel,
  entityId: string,
  locale: string,
  fields: Record<string, string>
): Promise<void> {
  const tableName = TABLE_MAP[model];
  const fkField = FK_MAP[model];
  if (!tableName || !fkField) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await ((prisma as Record<string, any>)[tableName]).update({
    where: { [`${fkField}_locale`]: { [fkField]: entityId, locale } },
    data: fields,
  });
}

// ============================================
// PASS 2: CLAUDE HAIKU IMPROVEMENT
// ============================================

/**
 * Pass 2: Read existing draft translations, send to Claude Haiku for improvement.
 * Claude reads the source (French) + draft translation and improves quality.
 * Processes 3 locales in parallel for efficiency.
 */
async function improveTranslationsWithClaude(
  model: TranslatableModel,
  entityId: string
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`[Pass2] Skipping - ANTHROPIC_API_KEY not configured for ${model}#${entityId}`);
    return;
  }

  const anthropic = await getAnthropic();
  const sourceFields = await readSourceFields(model, entityId);
  if (Object.keys(sourceFields).length === 0) return;

  const translations = await readExistingTranslations(model, entityId);
  const targetLocales = locales.filter(l => l !== defaultLocale);

  // Process locales in batches of 3
  for (let i = 0; i < targetLocales.length; i += 3) {
    const batch = targetLocales.slice(i, i + 3);
    await Promise.allSettled(
      batch.map(async (locale) => {
        const existing = translations.find(t => t.locale === locale);
        if (!existing) return;

        const languageName = getLanguageName(locale);

        // Build the improvement prompt with source + draft
        const fieldPairs = Object.entries(sourceFields)
          .filter(([key]) => existing.fields[key])
          .map(([key, sourceValue]) => (
            `[FIELD:${key}]\nSOURCE (French): ${sourceValue}\nDRAFT (${languageName}): ${existing.fields[key]}\n[/FIELD:${key}]`
          ))
          .join('\n\n');

        if (!fieldPairs) return;

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: `You are improving AI-translated content for a Canadian peptide research company.

Target language: ${languageName}

For each field below, you have the French SOURCE and a DRAFT translation. Improve the draft:
- Fix grammar, fluency, and naturalness
- Ensure scientific terminology is accurate
- Keep the same tone and formatting
- Return ONLY the improved translation using the same [FIELD:name] markers

${buildGlossaryPrompt()}

${fieldPairs}

Return each improved field using [FIELD:name]...[/FIELD:name] markers. Only output the improved ${languageName} text, nothing else.`,
          }],
        });

        // Parse response
        const result = response.content[0]?.type === 'text' ? response.content[0].text : '';
        const updatedFields: Record<string, string> = {};
        const fieldNames = TRANSLATABLE_FIELDS[model] || [];

        for (const fieldName of fieldNames) {
          const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\[FIELD:${escaped}\\]\\n?([\\s\\S]*?)\\n?\\[/FIELD:${escaped}\\]`);
          const match = result.match(regex);
          if (match && match[1]?.trim()) {
            updatedFields[fieldName] = match[1].trim();
          }
        }

        if (Object.keys(updatedFields).length > 0) {
          await updateTranslationFields(model, entityId, locale, updatedFields);
        }
      })
    );

    // Rate limit between batches
    if (i + 3 < targetLocales.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  console.log(`[Pass2] Claude Haiku improved ${model}#${entityId} across ${targetLocales.length} locales`);
}

// ============================================
// PASS 3: GPT-4o VERIFICATION
// ============================================

/**
 * Pass 3: Read improved translation, send to GPT-4o for verification.
 * GPT-4o checks fluency, accuracy, and fixes remaining issues.
 * Processes 3 locales in parallel.
 */
async function verifyTranslationsWithGPT4o(
  model: TranslatableModel,
  entityId: string
): Promise<void> {
  const openai = await getOpenAI();
  const sourceFields = await readSourceFields(model, entityId);
  if (Object.keys(sourceFields).length === 0) return;

  const translations = await readExistingTranslations(model, entityId);
  const targetLocales = locales.filter(l => l !== defaultLocale);

  for (let i = 0; i < targetLocales.length; i += 3) {
    const batch = targetLocales.slice(i, i + 3);
    await Promise.allSettled(
      batch.map(async (locale) => {
        const existing = translations.find(t => t.locale === locale);
        if (!existing) return;

        const languageName = getLanguageName(locale);

        const fieldPairs = Object.entries(sourceFields)
          .filter(([key]) => existing.fields[key])
          .map(([key, sourceValue]) => (
            `[FIELD:${key}]\nSOURCE (French): ${sourceValue}\nCURRENT (${languageName}): ${existing.fields[key]}\n[/FIELD:${key}]`
          ))
          .join('\n\n');

        if (!fieldPairs) return;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a professional translator verifying translations for a Canadian peptide research company.
Your job is to verify and finalize the ${languageName} translations.

Rules:
1. Check for grammatical errors, awkward phrasing, or incorrect terminology
2. Verify scientific terms are used correctly
3. Ensure the translation is natural and fluent in ${languageName}
4. Preserve all items from the glossary exactly
5. Return ONLY corrected translations using [FIELD:name] markers
6. If a translation is already perfect, return it unchanged

${buildGlossaryPrompt()}`,
            },
            {
              role: 'user',
              content: `Verify and finalize these ${languageName} translations:\n\n${fieldPairs}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 4096,
        });

        const result = response.choices[0]?.message?.content || '';
        const updatedFields: Record<string, string> = {};
        const fieldNames = TRANSLATABLE_FIELDS[model] || [];

        for (const fieldName of fieldNames) {
          const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\[FIELD:${escaped}\\]\\n?([\\s\\S]*?)\\n?\\[/FIELD:${escaped}\\]`);
          const match = result.match(regex);
          if (match && match[1]?.trim()) {
            updatedFields[fieldName] = match[1].trim();
          }
        }

        if (Object.keys(updatedFields).length > 0) {
          await updateTranslationFields(model, entityId, locale, updatedFields);
        }
      })
    );

    if (i + 3 < targetLocales.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  console.log(`[Pass3] GPT-4o verified ${model}#${entityId} across ${targetLocales.length} locales`);
}

// ============================================
// NIGHT WORKER
// ============================================

/**
 * Process all pending Pass 2 and Pass 3 jobs.
 * Called by cron/API endpoint at night.
 */
export async function processNightJobs(): Promise<{
  pass2: { processed: number; errors: number };
  pass3: { processed: number; errors: number };
}> {
  const results = {
    pass2: { processed: 0, errors: 0 },
    pass3: { processed: 0, errors: 0 },
  };

  for (const pass of [2, 3]) {
    const jobs = await prisma.translationJob.findMany({
      where: { status: 'pending', pass },
      orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
      take: 500,
    });

    for (const job of jobs) {
      try {
        await prisma.translationJob.update({
          where: { id: job.id },
          data: { status: 'processing', startedAt: new Date() },
        });

        await executePass(job);

        await prisma.translationJob.update({
          where: { id: job.id },
          data: { status: 'completed', completedAt: new Date() },
        });

        const passKey = pass === 2 ? 'pass2' : 'pass3';
        results[passKey].processed++;

        // Auto-schedule next pass
        if (pass === 2) {
          await enqueueTranslation(job.model as TranslatableModel, job.entityId, {
            priority: job.priority,
            pass: 3,
          });
        }
      } catch (error) {
        const passKey = pass === 2 ? 'pass2' : 'pass3';
        results[passKey].errors++;
        console.error(`[NightWorker] Pass ${pass} error for ${job.model}#${job.entityId}:`, error);

        await prisma.translationJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  return results;
}

// ============================================
// CONTROL
// ============================================

/**
 * Stop the queue processing loop
 */
export function stopQueue(): void {
  if (processingTimeout) {
    clearTimeout(processingTimeout);
    processingTimeout = null;
  }
  isProcessing = false;
}

/**
 * Resume queue processing
 */
export function resumeQueue(): void {
  if (!isProcessing) {
    scheduleProcessing();
  }
}
