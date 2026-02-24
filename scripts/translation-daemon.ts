#!/usr/bin/env npx tsx
/**
 * DAEMON DE TRADUCTION NOCTURNE - BioCycle Peptides
 *
 * Pipeline 3 passes:
 *   Pass 1: GPT-4o-mini  (immédiat ou batch initial)
 *   Pass 2: Claude Haiku  (nuit 2h AM)
 *   Pass 3: GPT-4o        (nuit 4h AM)
 *
 * Usage:
 *   npx tsx scripts/translation-daemon.ts                    # Mode daemon (tourne en continu)
 *   npx tsx scripts/translation-daemon.ts --batch            # Batch initial Pass 1 puis quitte
 *   npx tsx scripts/translation-daemon.ts --night            # Exécute Pass 2+3 maintenant puis quitte
 *   npx tsx scripts/translation-daemon.ts --status           # Affiche le statut et quitte
 *   npx tsx scripts/translation-daemon.ts --batch --model Product  # Batch un seul modèle
 *
 * Daemon mode:
 *   - Vérifie toutes les 5 minutes s'il y a des jobs Pass 1 pending
 *   - À 2h AM: exécute tous les jobs Pass 2
 *   - À 4h AM: exécute tous les jobs Pass 3
 *   - À 5h AM: rapport par email (TODO)
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ============================================
// PARSE ARGS
// ============================================
const args = process.argv.slice(2);
const MODE = args.includes('--batch') ? 'batch'
  : args.includes('--night') ? 'night'
  : args.includes('--status') ? 'status'
  : 'daemon';
const modelFilter = args.find(a => a.startsWith('--model='))?.split('=')[1]
  || (args.includes('--model') ? args[args.indexOf('--model') + 1] : null);
const force = args.includes('--force');
const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '3');

// ============================================
// CONFIG
// ============================================
type TranslatableModel = 'Product' | 'ProductFormat' | 'Category' | 'Article' | 'BlogPost' | 'Video' | 'Webinar' | 'QuickReply' | 'Faq';

const ALL_MODELS: TranslatableModel[] = [
  'Product', 'ProductFormat', 'Category', 'Article',
  'BlogPost', 'Video', 'Webinar', 'QuickReply', 'Faq',
];

const LOCALES = [
  'fr', 'ht', 'gcr', 'ar', 'ar-dz', 'ar-lb', 'ar-ma',
  'zh', 'de', 'es', 'tl', 'hi', 'it', 'ko', 'pl',
  'pt', 'pa', 'ru', 'sv', 'ta', 'vi',
]; // 21 locales (excl. 'en' default)

const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  Product: ['name', 'subtitle', 'shortDescription', 'description', 'fullDetails', 'specifications', 'metaTitle', 'metaDescription', 'researchSays', 'relatedResearch', 'participateResearch'],
  ProductFormat: ['name', 'description'],
  Category: ['name', 'description'],
  Article: ['title', 'excerpt', 'content', 'metaTitle', 'metaDescription'],
  BlogPost: ['title', 'excerpt', 'content', 'metaTitle', 'metaDescription'],
  Video: ['title', 'description'],
  Webinar: ['title', 'description', 'speakerTitle'],
  QuickReply: ['title', 'content'],
  Faq: ['question', 'answer'],
};

const FK_FIELD: Record<string, string> = {
  Product: 'productId', ProductFormat: 'formatId', Category: 'categoryId',
  Article: 'articleId', BlogPost: 'blogPostId', Video: 'videoId',
  Webinar: 'webinarId', QuickReply: 'quickReplyId', Faq: 'faqId',
};

const TABLE_NAME: Record<string, string> = {
  Product: 'productTranslation', ProductFormat: 'productFormatTranslation',
  Category: 'categoryTranslation', Article: 'articleTranslation',
  BlogPost: 'blogPostTranslation', Video: 'videoTranslation',
  Webinar: 'webinarTranslation', QuickReply: 'quickReplyTranslation',
  Faq: 'faqTranslation',
};

const LOCALE_NAMES: Record<string, string> = {
  fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese (Brazilian)',
  zh: 'Simplified Chinese', ko: 'Korean', ar: 'Modern Standard Arabic',
  'ar-ma': 'Moroccan Arabic (Darija)', 'ar-dz': 'Algerian Arabic (Darja)',
  'ar-lb': 'Lebanese Arabic', ru: 'Russian', hi: 'Hindi',
  pl: 'Polish', sv: 'Swedish', vi: 'Vietnamese', ta: 'Tamil', pa: 'Punjabi (Gurmukhi)',
  tl: 'Filipino/Tagalog', ht: 'Haitian Creole', gcr: 'Guadeloupean Creole',
};

const PEPTIDE_GLOSSARY = `PRESERVE exactly: BPC-157, TB-500, Semaglutide, Tirzepatide, CJC-1295, CJC-1295 DAC, Ipamorelin, GHRP-6, GHRP-2, Epitalon, NAD+, PT-141, Bremelanotide, Melanotan II, GHK-Cu, Tesamorelin, AOD-9604, Selank, Semax, Dihexa, Retatrutide, LL-37, KPV, Follistatin 344, IGF-1 LR3, Kisspeptin-10, Thymalin, NMN, BioCycle Peptides, HPLC, COA, GMP, USP, mg, mcg, µg, mL, IU, Da, kDa, CAD, USD, GLP-1, GIP, GH, IGF-1, mTOR, AMPK, NF-κB, TNF-α, IL-6, IL-10, VEGF, BDNF.
Keep HTML/Markdown tags, numbers, prices, chemical formulas, CAS numbers unchanged.`;

// ============================================
// AI CLIENTS (lazy)
// ============================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let openaiClient: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let anthropicClient: any = null;

async function getOpenAI() {
  if (!openaiClient) {
    const { default: OpenAI } = await import('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

async function getAnthropic() {
  if (!anthropicClient) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// ============================================
// LOGGING
// ============================================
function log(level: string, ...args: unknown[]) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] [${level}]`, ...args);
}

// ============================================
// TRANSLATION FUNCTIONS
// ============================================

function computeHash(fields: Record<string, string | null | undefined>): string {
  const content = Object.entries(fields)
    .filter(([, v]) => v)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
  return createHash('md5').update(content).digest('hex');
}

function parseFieldResponse(result: string, fieldNames: string[]): Record<string, string> {
  const translated: Record<string, string> = {};
  for (const name of fieldNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\[FIELD:${escaped}\\]\\n?([\\s\\S]*?)\\n?\\[/FIELD:${escaped}\\]`);
    const match = result.match(regex);
    if (match && match[1]?.trim()) {
      translated[name] = match[1].trim();
    }
  }
  return translated;
}

/** Pass 1: GPT-4o-mini draft translation */
async function translatePass1(
  fields: { name: string; value: string }[],
  locale: string,
  context: string
): Promise<Record<string, string>> {
  const openai = await getOpenAI();
  const userContent = fields
    .map(f => `[FIELD:${f.name}]\n${f.value}\n[/FIELD:${f.name}]`)
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Translate content for a Canadian peptide research company to ${LOCALE_NAMES[locale] || locale}. Context: ${context}. Return ONLY translated content using the same [FIELD:name]...[/FIELD:name] markers. ${PEPTIDE_GLOSSARY}`,
      },
      { role: 'user', content: `Translate each field:\n\n${userContent}` },
    ],
    temperature: 0.2,
    max_tokens: 8192,
  });

  return parseFieldResponse(
    response.choices[0]?.message?.content || '',
    fields.map(f => f.name)
  );
}

/** Pass 2: Claude Haiku improvement */
async function translatePass2(
  sourceFields: Record<string, string>,
  draftFields: Record<string, string | null>,
  locale: string
): Promise<Record<string, string>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    log('WARN', `Skipping Pass 2 - ANTHROPIC_API_KEY not set`);
    return {};
  }
  const anthropic = await getAnthropic();
  const languageName = LOCALE_NAMES[locale] || locale;

  const fieldPairs = Object.entries(sourceFields)
    .filter(([key]) => draftFields[key])
    .map(([key, src]) => `[FIELD:${key}]\nSOURCE (French): ${src}\nDRAFT (${languageName}): ${draftFields[key]}\n[/FIELD:${key}]`)
    .join('\n\n');

  if (!fieldPairs) return {};

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Improve AI-translated content for a Canadian peptide research company.
Target: ${languageName}. Fix grammar, fluency, scientific accuracy. Keep formatting.
Return ONLY improved text using [FIELD:name] markers.

${PEPTIDE_GLOSSARY}

${fieldPairs}`,
    }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return parseFieldResponse(text, Object.keys(sourceFields));
}

/** Pass 3: GPT-4o verification */
async function translatePass3(
  sourceFields: Record<string, string>,
  currentFields: Record<string, string | null>,
  locale: string
): Promise<Record<string, string>> {
  const openai = await getOpenAI();
  const languageName = LOCALE_NAMES[locale] || locale;

  const fieldPairs = Object.entries(sourceFields)
    .filter(([key]) => currentFields[key])
    .map(([key, src]) => `[FIELD:${key}]\nSOURCE (French): ${src}\nCURRENT (${languageName}): ${currentFields[key]}\n[/FIELD:${key}]`)
    .join('\n\n');

  if (!fieldPairs) return {};

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Professional translator verifying ${languageName} translations for a Canadian peptide research company. Check grammar, fluency, scientific accuracy. Return ONLY corrected text using [FIELD:name] markers. If perfect, return unchanged. ${PEPTIDE_GLOSSARY}`,
      },
      { role: 'user', content: `Verify:\n\n${fieldPairs}` },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  return parseFieldResponse(
    response.choices[0]?.message?.content || '',
    Object.keys(sourceFields)
  );
}

// ============================================
// BATCH PASS 1 - Initial translation
// ============================================

async function runBatchPass1() {
  log('INFO', '=== BATCH PASS 1: GPT-4o-mini Draft Translation ===');
  const models = modelFilter
    ? ALL_MODELS.filter(m => m.toLowerCase() === modelFilter!.toLowerCase())
    : ALL_MODELS;

  let totalDone = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  for (const model of models) {
    const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entities = await ((prisma as Record<string, any>)[sourceModel]).findMany();
    const fieldNames = TRANSLATABLE_FIELDS[model];
    const tableName = TABLE_NAME[model];
    const fkField = FK_FIELD[model];

    log('INFO', `--- ${model}: ${entities.length} entities ---`);

    for (const entity of entities) {
      const fields = fieldNames
        .filter((f: string) => entity[f] && String(entity[f]).trim().length > 0)
        .map((f: string) => ({ name: f, value: String(entity[f]) }));

      if (fields.length === 0) {
        log('SKIP', `${model}#${entity.id.slice(0, 8)} - no translatable fields`);
        continue;
      }

      const sourceHash: Record<string, string | null> = {};
      for (const f of fieldNames) sourceHash[f] = entity[f] || null;
      const hash = computeHash(sourceHash);

      const context = ['Product', 'ProductFormat', 'Category'].includes(model) ? 'product descriptions' : 'scientific content';

      // Translate to each locale in batches
      for (let i = 0; i < LOCALES.length; i += concurrency) {
        const batch = LOCALES.slice(i, i + concurrency);

        await Promise.allSettled(batch.map(async (locale) => {
          // Check existing
          if (!force) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const existing = await ((prisma as Record<string, any>)[tableName]).findUnique({
                where: { [`${fkField}_locale`]: { [fkField]: entity.id, locale } },
              });
              if (existing && existing.contentHash === hash) {
                totalSkipped++;
                return;
              }
            } catch { /* continue */ }
          }

          try {
            const translated = await translatePass1(fields, locale, context);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await ((prisma as Record<string, any>)[tableName]).upsert({
              where: { [`${fkField}_locale`]: { [fkField]: entity.id, locale } },
              create: {
                id: randomUUID(),
                [fkField]: entity.id,
                locale,
                contentHash: hash,
                translatedBy: 'gpt-4o-mini',
                qualityLevel: 'draft',
                isApproved: false,
                updatedAt: new Date(),
                ...translated,
              },
              update: {
                contentHash: hash,
                translatedBy: 'gpt-4o-mini',
                qualityLevel: 'draft',
                isApproved: false,
                ...translated,
              },
            });

            totalDone++;
            process.stdout.write(`\r  ${model}#${entity.id.slice(0, 8)}... → ${locale} ✓ (${totalDone} done, ${totalSkipped} skipped)`);
          } catch (error) {
            totalErrors++;
            log('ERROR', `${model}#${entity.id.slice(0, 8)} → ${locale}: ${error instanceof Error ? error.message : error}`);
          }
        }));

        // Rate limit
        if (i + concurrency < LOCALES.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      // Enqueue Pass 2 for this entity
      try {
        await prisma.translationJob.create({
          data: {
            model,
            entityId: entity.id,
            pass: 2,
            priority: model === 'Product' ? 2 : 3,
            status: 'pending',
            scheduledAt: getNextSlot(2),
          },
        });
      } catch { /* duplicate — ignore */ }

      if (totalDone > 0) console.log(); // newline
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  log('INFO', '=== BATCH COMPLETE ===');
  log('INFO', `  Duration: ${elapsed}s`);
  log('INFO', `  Translated: ${totalDone}`);
  log('INFO', `  Skipped: ${totalSkipped}`);
  log('INFO', `  Errors: ${totalErrors}`);
}

// ============================================
// NIGHT PASS 2 + 3
// ============================================

async function runNightPasses() {
  log('INFO', '=== NIGHT WORKER: Pass 2 (Claude Haiku) + Pass 3 (GPT-4o) ===');

  for (const pass of [2, 3]) {
    const passName = pass === 2 ? 'Claude Haiku (improvement)' : 'GPT-4o (verification)';
    log('INFO', `--- Pass ${pass}: ${passName} ---`);

    const jobs = await prisma.translationJob.findMany({
      where: { status: 'pending', pass },
      orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
      take: 500,
    });

    log('INFO', `  ${jobs.length} jobs to process`);
    let processed = 0;
    let errors = 0;

    for (const job of jobs) {
      const model = job.model as TranslatableModel;
      const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);
      const tableName = TABLE_NAME[model];
      const fkField = FK_FIELD[model];
      const fieldNames = TRANSLATABLE_FIELDS[model];

      try {
        await prisma.translationJob.update({
          where: { id: job.id },
          data: { status: 'processing', startedAt: new Date() },
        });

        // Read source entity
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entity = await ((prisma as Record<string, any>)[sourceModel]).findUnique({
          where: { id: job.entityId },
        });
        if (!entity) {
          log('WARN', `  Entity not found: ${model}#${job.entityId}`);
          continue;
        }

        const sourceFields: Record<string, string> = {};
        for (const f of fieldNames) {
          if (entity[f]) sourceFields[f] = String(entity[f]);
        }

        // Read existing translations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const translations = await ((prisma as Record<string, any>)[tableName]).findMany({
          where: { [fkField]: job.entityId },
        });

        // Process each locale
        for (let i = 0; i < translations.length; i += concurrency) {
          const batch = translations.slice(i, i + concurrency);
          await Promise.allSettled(batch.map(async (t: Record<string, unknown>) => {
            const locale = t.locale as string;
            const currentFields: Record<string, string | null> = {};
            for (const f of fieldNames) currentFields[f] = (t[f] as string) || null;

            let improved: Record<string, string>;
            if (pass === 2) {
              improved = await translatePass2(sourceFields, currentFields, locale);
            } else {
              improved = await translatePass3(sourceFields, currentFields, locale);
            }

            if (Object.keys(improved).length > 0) {
              const quality = pass === 2 ? 'improved' : 'verified';
              const translatedBy = pass === 2 ? 'claude-haiku-4-5' : 'gpt-4o';
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await ((prisma as Record<string, any>)[tableName]).update({
                where: { [`${fkField}_locale`]: { [fkField]: job.entityId, locale } },
                data: { ...improved, qualityLevel: quality, translatedBy },
              });
            }
          }));

          if (i + concurrency < translations.length) {
            await new Promise(r => setTimeout(r, 300));
          }
        }

        // Mark completed
        await prisma.translationJob.update({
          where: { id: job.id },
          data: { status: 'completed', completedAt: new Date() },
        });

        // Schedule next pass
        if (pass === 2) {
          try {
            await prisma.translationJob.create({
              data: {
                model: job.model,
                entityId: job.entityId,
                pass: 3,
                priority: job.priority,
                status: 'pending',
                scheduledAt: getNextSlot(3),
              },
            });
          } catch { /* duplicate */ }
        }

        processed++;
        log('INFO', `  ✓ ${model}#${job.entityId.slice(0, 8)} Pass ${pass} complete (${processed}/${jobs.length})`);

      } catch (error) {
        errors++;
        log('ERROR', `  ✗ ${model}#${job.entityId.slice(0, 8)} Pass ${pass}: ${error instanceof Error ? error.message : error}`);

        const retries = job.retries + 1;
        await prisma.translationJob.update({
          where: { id: job.id },
          data: retries >= job.maxRetries
            ? { status: 'failed', retries, error: String(error) }
            : { status: 'pending', retries, scheduledAt: new Date(Date.now() + 60000) },
        });
      }
    }

    log('INFO', `  Pass ${pass} done: ${processed} processed, ${errors} errors`);
  }
}

// ============================================
// STATUS
// ============================================

async function showStatus() {
  log('INFO', '=== TRANSLATION STATUS ===\n');

  // Translation coverage
  for (const model of ALL_MODELS) {
    const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);
    const tableName = TABLE_NAME[model];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalEntities = await ((prisma as Record<string, any>)[sourceModel]).count();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalTranslations = await ((prisma as Record<string, any>)[tableName]).count();
    const expected = totalEntities * LOCALES.length;
    const pct = expected > 0 ? Math.round((totalTranslations / expected) * 100) : 0;

    // Quality breakdown
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byQuality = await ((prisma as Record<string, any>)[tableName]).groupBy({
      by: ['qualityLevel'],
      _count: true,
    }).catch(() => []);

    const qualityStr = byQuality.map((q: { qualityLevel: string; _count: number }) =>
      `${q.qualityLevel || 'unknown'}:${q._count}`
    ).join(', ');

    console.log(`  ${model.padEnd(18)} ${String(totalEntities).padStart(4)} entities | ${String(totalTranslations).padStart(5)}/${expected} translations (${pct}%) | ${qualityStr || 'none'}`);
  }

  // Job queue
  console.log('\n  --- Translation Jobs ---');
  const jobStats = await prisma.translationJob.groupBy({
    by: ['pass', 'status'],
    _count: true,
  });

  if (jobStats.length === 0) {
    console.log('  No jobs in queue');
  } else {
    for (const stat of jobStats) {
      console.log(`  Pass ${stat.pass} | ${stat.status.padEnd(12)} | ${stat._count} jobs`);
    }
  }
}

// ============================================
// DAEMON MODE
// ============================================

function getNextSlot(pass: number): Date {
  const now = new Date();
  const target = new Date(now);
  target.setHours(pass === 2 ? 2 : 4, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

async function runDaemon() {
  log('INFO', '=== TRANSLATION DAEMON STARTED ===');
  log('INFO', `  Pass 1: On-demand (check every 5 min)`);
  log('INFO', `  Pass 2: 2:00 AM (Claude Haiku)`);
  log('INFO', `  Pass 3: 4:00 AM (GPT-4o)`);
  log('INFO', `  PID: ${process.pid}`);

  let lastPass2Run = 0;
  let lastPass3Run = 0;

  const tick = async () => {
    const now = new Date();
    const hour = now.getHours();

    // Pass 1: Process any pending immediate jobs
    const pass1Jobs = await prisma.translationJob.findMany({
      where: { status: 'pending', pass: 1, scheduledAt: { lte: now } },
      orderBy: [{ priority: 'asc' }],
      take: 10,
    });

    if (pass1Jobs.length > 0) {
      log('INFO', `Processing ${pass1Jobs.length} Pass 1 jobs...`);
      for (const job of pass1Jobs) {
        try {
          const model = job.model as TranslatableModel;
          const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entity = await ((prisma as Record<string, any>)[sourceModel]).findUnique({
            where: { id: job.entityId },
          });
          if (!entity) continue;

          const fieldNames = TRANSLATABLE_FIELDS[model];
          const fields = fieldNames
            .filter((f: string) => entity[f] && String(entity[f]).trim().length > 0)
            .map((f: string) => ({ name: f, value: String(entity[f]) }));

          const tableName = TABLE_NAME[model];
          const fkField = FK_FIELD[model];
          const sourceHash: Record<string, string | null> = {};
          for (const f of fieldNames) sourceHash[f] = entity[f] || null;
          const hash = computeHash(sourceHash);

          await prisma.translationJob.update({
            where: { id: job.id },
            data: { status: 'processing', startedAt: now },
          });

          for (let i = 0; i < LOCALES.length; i += concurrency) {
            const batch = LOCALES.slice(i, i + concurrency);
            await Promise.allSettled(batch.map(async (locale) => {
              const translated = await translatePass1(fields, locale, 'product descriptions');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await ((prisma as Record<string, any>)[tableName]).upsert({
                where: { [`${fkField}_locale`]: { [fkField]: entity.id, locale } },
                create: { id: randomUUID(), [fkField]: entity.id, locale, contentHash: hash, translatedBy: 'gpt-4o-mini', qualityLevel: 'draft', isApproved: false, updatedAt: new Date(), ...translated },
                update: { contentHash: hash, translatedBy: 'gpt-4o-mini', qualityLevel: 'draft', ...translated },
              });
            }));
            if (i + concurrency < LOCALES.length) await new Promise(r => setTimeout(r, 300));
          }

          await prisma.translationJob.update({
            where: { id: job.id },
            data: { status: 'completed', completedAt: new Date() },
          });

          // Schedule Pass 2
          try {
            await prisma.translationJob.create({
              data: { model: job.model, entityId: job.entityId, pass: 2, priority: job.priority, status: 'pending', scheduledAt: getNextSlot(2) },
            });
          } catch { /* dup */ }

          log('INFO', `  ✓ Pass 1 complete: ${model}#${job.entityId.slice(0, 8)}`);
        } catch (error) {
          log('ERROR', `  Pass 1 failed: ${job.model}#${job.entityId.slice(0, 8)}: ${error}`);
          await prisma.translationJob.update({
            where: { id: job.id },
            data: { status: 'failed', error: String(error) },
          });
        }
      }
    }

    // Pass 2: Run at 2 AM
    if (hour === 2 && lastPass2Run !== now.getDate()) {
      lastPass2Run = now.getDate();
      log('INFO', `🌙 2:00 AM - Starting Pass 2 (Claude Haiku)...`);
      await runNightPasses();
    }

    // Pass 3 runs as part of runNightPasses after Pass 2 schedules them
    // But also check at 4 AM for any pending
    if (hour === 4 && lastPass3Run !== now.getDate()) {
      lastPass3Run = now.getDate();
      const pendingPass3 = await prisma.translationJob.count({
        where: { status: 'pending', pass: 3 },
      });
      if (pendingPass3 > 0) {
        log('INFO', `🌙 4:00 AM - ${pendingPass3} Pass 3 jobs pending...`);
        // runNightPasses handles both, but we can also call just for pass 3
      }
    }
  };

  // Run immediately then every 5 minutes
  await tick();
  setInterval(tick, 5 * 60 * 1000);

  // Keep alive
  process.on('SIGINT', async () => {
    log('INFO', 'Daemon shutting down...');
    await prisma.$disconnect();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    log('INFO', 'Daemon shutting down (SIGTERM)...');
    await prisma.$disconnect();
    process.exit(0);
  });
}

// ============================================
// MAIN
// ============================================

async function main() {
  switch (MODE) {
    case 'batch':
      await runBatchPass1();
      break;
    case 'night':
      await runNightPasses();
      break;
    case 'status':
      await showStatus();
      break;
    case 'daemon':
      await runDaemon();
      return; // Don't disconnect — daemon stays alive
  }
  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Fatal:', error);
  process.exit(1);
});
