/**
 * SERVICE DE TRADUCTION AUTOMATIQUE - BioCycle Peptides
 *
 * Utilise GPT-4o-mini (Batch API pour masse, Standard pour urgent)
 * avec glossaire peptides et cache en mémoire.
 *
 * Architecture:
 * 1. Vérifier cache mémoire (via contentHash)
 * 2. Vérifier DB (table *Translation)
 * 3. Sinon: traduire via OpenAI GPT-4o-mini
 * 4. Stocker en DB + cache
 */

import type OpenAI from 'openai';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { cacheGet, cacheSet, CacheTTL } from '@/lib/cache';
import { buildTranslationSystemPrompt, getLanguageName } from './glossary';
import { locales } from '@/i18n/config';

/**
 * DB content source locale: all original content in the database is written in French.
 * This is different from the i18n defaultLocale ('en') which is the website's default display language.
 * The translation system uses this to know which locale doesn't need translation (content is already in FR).
 */
export const DB_SOURCE_LOCALE = 'fr';

// Lazy OpenAI initialization (same pattern as chat)
let openaiInstance: OpenAI | null = null;

async function getOpenAI(): Promise<OpenAI> {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    const { default: OpenAIClient } = await import('openai');
    openaiInstance = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiInstance;
}

// ============================================
// TYPES
// ============================================

export type TranslatableModel =
  | 'Product'
  | 'ProductFormat'
  | 'Category'
  | 'Article'
  | 'BlogPost'
  | 'Video'
  | 'Webinar'
  | 'QuickReply'
  | 'Faq';

export type TranslationContext = 'product' | 'article' | 'general';

interface TranslationField {
  name: string;
  value: string;
}

interface TranslationResult {
  locale: string;
  fields: Record<string, string>;
  contentHash: string;
}

export interface TranslationStatus {
  model: TranslatableModel;
  entityId: string;
  totalLocales: number;
  translatedLocales: number;
  pendingLocales: string[];
  approvedLocales: string[];
}

// ============================================
// HELPERS
// ============================================

/** Generate MD5 hash of content to detect changes */
export function contentHash(fields: Record<string, string | null | undefined>): string {
  const content = Object.entries(fields)
    .filter(([, v]) => v)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
  return createHash('md5').update(content).digest('hex');
}

/** Cache key for translations */
function translationCacheKey(model: string, entityId: string, locale: string): string {
  return `translation:${model}:${entityId}:${locale}`;
}

/** Get translation context from model type */
function getContextForModel(model: TranslatableModel): TranslationContext {
  switch (model) {
    case 'Product':
    case 'ProductFormat':
    case 'Category':
      return 'product';
    case 'Article':
    case 'BlogPost':
      return 'article';
    default:
      return 'general';
  }
}

// ============================================
// MODEL FIELD MAPPING
// ============================================

/** Fields that should be translated for each model type */
export const TRANSLATABLE_FIELDS: Record<TranslatableModel, string[]> = {
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

/** Prisma model name to translation table mapping */
const TRANSLATION_TABLE_MAP: Record<TranslatableModel, string> = {
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

/** Foreign key field name in translation table */
const FK_FIELD_MAP: Record<TranslatableModel, string> = {
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

// ============================================
// CORE TRANSLATION FUNCTIONS
// ============================================

/**
 * Translate a single text to a target language via GPT-4o-mini
 */
export async function translateText(
  text: string,
  targetLocale: string,
  context: TranslationContext = 'general'
): Promise<string> {
  if (!text || text.trim().length === 0) return '';

  const languageName = getLanguageName(targetLocale);
  const systemPrompt = buildTranslationSystemPrompt(languageName, context);

  const openai = await getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content?.trim() || text;
}

/**
 * Translate multiple fields at once (more efficient - single API call)
 */
export async function translateFields(
  fields: TranslationField[],
  targetLocale: string,
  context: TranslationContext = 'general'
): Promise<Record<string, string>> {
  const nonEmptyFields = fields.filter(f => f.value && f.value.trim().length > 0);
  if (nonEmptyFields.length === 0) return {};

  const languageName = getLanguageName(targetLocale);
  const systemPrompt = buildTranslationSystemPrompt(languageName, context);

  // Build a structured prompt for multiple fields
  const userContent = nonEmptyFields
    .map(f => `[FIELD:${f.name}]\n${f.value}\n[/FIELD:${f.name}]`)
    .join('\n\n');

  const formatInstruction = `Translate each field below to ${languageName}. Return the result using the EXACT same [FIELD:name]...[/FIELD:name] markers. Only translate the content between the markers.\n\n${userContent}`;

  const openai = await getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: formatInstruction },
    ],
    temperature: 0.2,
    max_tokens: 8192,
  });

  const result = response.choices[0]?.message?.content || '';

  // Parse the response back into field->value map
  const translated: Record<string, string> = {};
  for (const field of nonEmptyFields) {
    const escapedName = field.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\[FIELD:${escapedName}\\]\\n?([\\s\\S]*?)\\n?\\[/FIELD:${escapedName}\\]`);
    const match = result.match(regex);
    translated[field.name] = match ? match[1].trim() : field.value;
  }

  return translated;
}

// ============================================
// ENTITY TRANSLATION (DB-backed)
// ============================================

/**
 * Translate an entity into a specific locale and persist to DB
 */
export async function translateEntity(
  model: TranslatableModel,
  entityId: string,
  targetLocale: string,
  options: { force?: boolean } = {}
): Promise<TranslationResult | null> {
  const tableName = TRANSLATION_TABLE_MAP[model];
  const fkField = FK_FIELD_MAP[model];
  const translatableFields = TRANSLATABLE_FIELDS[model];
  const context = getContextForModel(model);

  // 1. Fetch source entity
  const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access requires runtime key indexing
  const prismaModel = (prisma as Record<string, any>)[sourceModel];
  const entity = await prismaModel.findUnique({
    where: { id: entityId },
  });

  if (!entity) {
    console.error(`[Translation] Entity not found: ${model}#${entityId}`);
    return null;
  }

  // 2. Compute content hash of source
  const sourceFields: Record<string, string | null> = {};
  for (const field of translatableFields) {
    sourceFields[field] = entity[field] || null;
  }
  const hash = contentHash(sourceFields);

  // 3. Check if translation already exists and is up to date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access requires runtime key indexing
  const prismaTranslation = (prisma as Record<string, any>)[tableName];
  if (!options.force) {
    const existing = await prismaTranslation.findUnique({
      where: { [`${fkField}_locale`]: { [fkField]: entityId, locale: targetLocale } },
    });

    if (existing && existing.contentHash === hash) {
      // Translation is up to date
      const fields: Record<string, string> = {};
      for (const f of translatableFields) {
        if (existing[f]) fields[f] = existing[f];
      }

      // Update memory cache
      cacheSet(translationCacheKey(model, entityId, targetLocale), fields, {
        ttl: CacheTTL.STATIC,
        tags: [`translation:${model}`, `translation:${entityId}`],
      });

      return { locale: targetLocale, fields, contentHash: hash };
    }
  }

  // 4. Translate the fields
  const fieldsToTranslate: TranslationField[] = translatableFields
    .filter(f => entity[f] && entity[f].trim().length > 0)
    .map(f => ({ name: f, value: entity[f] }));

  if (fieldsToTranslate.length === 0) return null;

  const translatedFields = await translateFields(fieldsToTranslate, targetLocale, context);

  // 4b. Translate customSections JSON if present (Product model only)
  if (model === 'Product' && entity.customSections) {
    try {
      const sections = typeof entity.customSections === 'string'
        ? JSON.parse(entity.customSections)
        : entity.customSections;
      if (Array.isArray(sections) && sections.length > 0) {
        const sectionFields: TranslationField[] = [];
        for (let i = 0; i < sections.length; i++) {
          if (sections[i].title) sectionFields.push({ name: `cs_title_${i}`, value: sections[i].title });
          if (sections[i].content) sectionFields.push({ name: `cs_content_${i}`, value: sections[i].content });
        }
        if (sectionFields.length > 0) {
          const translatedSections = await translateFields(sectionFields, targetLocale, context);
          const result = sections.map((s: { title?: string; content?: string }, i: number) => ({
            title: translatedSections[`cs_title_${i}`] || s.title || '',
            content: translatedSections[`cs_content_${i}`] || s.content || '',
          }));
          translatedFields.customSections = JSON.stringify(result);
        }
      }
    } catch {
      // Skip customSections translation on parse error
    }
  }

  // 5. Upsert translation in DB
  const data: Record<string, string | boolean> = {
    locale: targetLocale,
    contentHash: hash,
    translatedBy: 'gpt-4o-mini',
    isApproved: false,
    ...translatedFields,
  };

  await prismaTranslation.upsert({
    where: { [`${fkField}_locale`]: { [fkField]: entityId, locale: targetLocale } },
    create: { [fkField]: entityId, ...data },
    update: data,
  });

  // 6. Update memory cache
  cacheSet(translationCacheKey(model, entityId, targetLocale), translatedFields, {
    ttl: CacheTTL.STATIC,
    tags: [`translation:${model}`, `translation:${entityId}`],
  });

  return { locale: targetLocale, fields: translatedFields, contentHash: hash };
}

/**
 * Translate an entity into ALL locales (except source/default)
 */
export async function translateEntityAllLocales(
  model: TranslatableModel,
  entityId: string,
  options: { force?: boolean; sourceLocale?: string; concurrency?: number } = {}
): Promise<TranslationResult[]> {
  const sourceLocale = options.sourceLocale || DB_SOURCE_LOCALE;
  const targetLocales = locales.filter(l => l !== sourceLocale);
  const concurrency = options.concurrency || 3; // Parallel translations

  const results: TranslationResult[] = [];

  // Process in batches for rate limiting
  for (let i = 0; i < targetLocales.length; i += concurrency) {
    const batch = targetLocales.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(locale => translateEntity(model, entityId, locale, options))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      } else if (result.status === 'rejected') {
        console.error(`[Translation] Failed for locale batch:`, result.reason);
      }
    }

    // Small delay between batches to respect rate limits
    if (i + concurrency < targetLocales.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

// ============================================
// FETCH TRANSLATIONS (Read path)
// ============================================

/**
 * Get translated content for an entity in a specific locale
 * Falls back to source content if no translation exists
 */
export async function getTranslatedFields(
  model: TranslatableModel,
  entityId: string,
  locale: string
): Promise<Record<string, string> | null> {
  // If requesting DB source locale, no translation needed (content is already in French)
  if (locale === DB_SOURCE_LOCALE) return null;

  const tableName = TRANSLATION_TABLE_MAP[model];
  const fkField = FK_FIELD_MAP[model];
  const translatableFields = TRANSLATABLE_FIELDS[model];

  // 1. Check memory cache
  const cacheKey = translationCacheKey(model, entityId, locale);
  const cached = cacheGet<Record<string, string>>(cacheKey);
  if (cached) return cached;

  // 2. Check DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access requires runtime key indexing
  const translation = await ((prisma as Record<string, any>)[tableName]).findUnique({
    where: { [`${fkField}_locale`]: { [fkField]: entityId, locale } },
  });

  if (!translation) return null;

  const fields: Record<string, string> = {};
  for (const f of translatableFields) {
    if (translation[f]) fields[f] = translation[f];
  }

  // Cache the result
  cacheSet(cacheKey, fields, {
    ttl: CacheTTL.STATIC,
    tags: [`translation:${model}`, `translation:${entityId}`],
  });

  return Object.keys(fields).length > 0 ? fields : null;
}

/**
 * Apply translations to an entity object
 * Returns a new object with translated fields overlaid
 */
export async function withTranslation<T extends Record<string, unknown> & { id: string }>(
  entity: T,
  model: TranslatableModel,
  locale: string
): Promise<T> {
  if (locale === DB_SOURCE_LOCALE) return entity;

  const translated = await getTranslatedFields(model, entity.id, locale);
  if (!translated) return entity;

  return { ...entity, ...translated };
}

/**
 * Apply translations to an array of entities
 */
export async function withTranslations<T extends Record<string, unknown> & { id: string }>(
  entities: T[],
  model: TranslatableModel,
  locale: string
): Promise<T[]> {
  if (locale === DB_SOURCE_LOCALE) return entities;

  return Promise.all(
    entities.map(entity => withTranslation(entity, model, locale))
  );
}

// ============================================
// TRANSLATION STATUS / MONITORING
// ============================================

/**
 * Get translation status for an entity
 */
export async function getTranslationStatus(
  model: TranslatableModel,
  entityId: string
): Promise<TranslationStatus> {
  const tableName = TRANSLATION_TABLE_MAP[model];
  const fkField = FK_FIELD_MAP[model];
  const allLocales = locales.filter(l => l !== DB_SOURCE_LOCALE);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access requires runtime key indexing
  const translations: { locale: string; isApproved: boolean }[] = await ((prisma as Record<string, any>)[tableName]).findMany({
    where: { [fkField]: entityId },
    select: { locale: true, isApproved: true },
  });

  const translatedLocales = translations.map((t) => t.locale);
  const approvedLocales = translations.filter((t) => t.isApproved).map((t) => t.locale);
  const pendingLocales = allLocales.filter(l => !translatedLocales.includes(l));

  return {
    model,
    entityId,
    totalLocales: allLocales.length,
    translatedLocales: translatedLocales.length,
    pendingLocales,
    approvedLocales,
  };
}

/**
 * Get overall translation coverage for a model type
 */
export async function getModelTranslationCoverage(model: TranslatableModel): Promise<{
  totalEntities: number;
  fullyTranslated: number;
  partiallyTranslated: number;
  untranslated: number;
  coveragePercent: number;
}> {
  const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);
  const tableName = TRANSLATION_TABLE_MAP[model];
  const fkField = FK_FIELD_MAP[model];
  const targetLocaleCount = locales.length - 1; // Exclude default

  // Count total entities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access requires runtime key indexing
  const totalEntities = await ((prisma as Record<string, any>)[sourceModel]).count();
  if (totalEntities === 0) {
    return { totalEntities: 0, fullyTranslated: 0, partiallyTranslated: 0, untranslated: 0, coveragePercent: 100 };
  }

  // Count translations per entity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access requires runtime key indexing
  const translationCounts = await ((prisma as Record<string, any>)[tableName]).groupBy({
    by: [fkField],
    _count: { locale: true },
  });

  let fullyTranslated = 0;
  let partiallyTranslated = 0;

  const translatedEntityIds = new Set<string>();
  for (const tc of translationCounts) {
    translatedEntityIds.add(tc[fkField]);
    if (tc._count.locale >= targetLocaleCount) {
      fullyTranslated++;
    } else {
      partiallyTranslated++;
    }
  }

  const untranslated = totalEntities - translatedEntityIds.size;
  const coveragePercent = totalEntities > 0
    ? Math.round((fullyTranslated / totalEntities) * 100)
    : 0;

  return { totalEntities, fullyTranslated, partiallyTranslated, untranslated, coveragePercent };
}

// ============================================
// BATCH TRANSLATION (for initial migration)
// ============================================

/**
 * Translate all entities of a model type that don't have translations yet
 */
export async function batchTranslateModel(
  model: TranslatableModel,
  options: {
    batchSize?: number;
    concurrency?: number;
    force?: boolean;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<{ translated: number; errors: number }> {
  const { batchSize = 10, concurrency = 2, force = false, onProgress } = options;
  const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);

  // Get all entity IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access requires runtime key indexing
  const entities = await ((prisma as Record<string, any>)[sourceModel]).findMany({
    select: { id: true },
  });

  let translated = 0;
  let errors = 0;
  const total = entities.length;

  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);

    for (const entity of batch) {
      try {
        await translateEntityAllLocales(model, entity.id, { force, concurrency });
        translated++;
      } catch (error) {
        console.error(`[BatchTranslate] Error translating ${model}#${entity.id}:`, error);
        errors++;
      }
    }

    if (onProgress) onProgress(Math.min(i + batchSize, total), total);

    // Delay between batches
    if (i + batchSize < entities.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { translated, errors };
}
