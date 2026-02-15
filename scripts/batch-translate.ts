/**
 * SCRIPT DE TRADUCTION EN MASSE - BioCycle Peptides
 *
 * Usage:
 *   npx tsx scripts/batch-translate.ts                 # Tout traduire
 *   npx tsx scripts/batch-translate.ts --model Product  # Seulement les produits
 *   npx tsx scripts/batch-translate.ts --force          # Forcer la re-traduction
 *   npx tsx scripts/batch-translate.ts --dry-run        # Voir ce qui serait traduit
 *
 * Ce script traduit tous les contenus non encore traduits
 * dans les 22 langues via GPT-4o-mini.
 */

import { PrismaClient } from '@prisma/client';

// We need to set up the environment before importing the translation module
const prisma = new PrismaClient();

// Parse arguments
const args = process.argv.slice(2);
const modelFilter = args.find(a => a.startsWith('--model='))?.split('=')[1]
  || (args.includes('--model') ? args[args.indexOf('--model') + 1] : null);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '3');

type TranslatableModel = 'Product' | 'ProductFormat' | 'Category' | 'Article' | 'BlogPost' | 'Video' | 'Webinar' | 'QuickReply';

const ALL_MODELS: TranslatableModel[] = [
  'Product', 'ProductFormat', 'Category', 'Article',
  'BlogPost', 'Video', 'Webinar', 'QuickReply',
];

const LOCALES = [
  'fr', 'ht', 'gcr', 'ar', 'ar-dz', 'ar-lb', 'ar-ma',
  'zh', 'de', 'es', 'tl', 'hi', 'it', 'ko', 'pl',
  'pt', 'pa', 'ru', 'sv', 'ta', 'vi',
]; // 21 locales (excl. 'en' default)

async function countEntities(model: TranslatableModel): Promise<number> {
  const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic Prisma model access
  return ((prisma as Record<string, any>)[sourceModel]).count();
}

async function main() {
  console.log('='.repeat(60));
  console.log('  BioCycle Peptides - Traduction automatique en masse');
  console.log('  GPT-4o-mini | 22 langues | Glossaire peptides');
  console.log('='.repeat(60));
  console.log();

  const models = modelFilter
    ? ALL_MODELS.filter(m => m.toLowerCase() === modelFilter.toLowerCase())
    : ALL_MODELS;

  if (models.length === 0) {
    console.error(`Modèle invalide: ${modelFilter}`);
    console.error(`Modèles valides: ${ALL_MODELS.join(', ')}`);
    process.exit(1);
  }

  console.log(`Modèles:     ${models.join(', ')}`);
  console.log(`Force:       ${force ? 'OUI' : 'NON'}`);
  console.log(`Dry run:     ${dryRun ? 'OUI' : 'NON'}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Locales:     ${LOCALES.length} langues`);
  console.log();

  // Count entities first
  let totalEntities = 0;
  for (const model of models) {
    const count = await countEntities(model);
    console.log(`  ${model}: ${count} entités`);
    totalEntities += count;
  }

  const totalTranslations = totalEntities * LOCALES.length;
  console.log();
  console.log(`Total: ${totalEntities} entités x ${LOCALES.length} langues = ${totalTranslations} traductions`);
  console.log();

  if (dryRun) {
    console.log('[DRY RUN] Aucune traduction effectuée.');
    await prisma.$disconnect();
    return;
  }

  if (totalEntities === 0) {
    console.log('Aucune entité à traduire.');
    await prisma.$disconnect();
    return;
  }

  // Dynamic import of translation module (needs Next.js env)
  // Since this runs outside Next.js, we use a direct OpenAI approach
  const { default: OpenAI } = await import('openai');

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY non définie. Ajoutez-la dans .env');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Translation field definitions
  const TRANSLATABLE_FIELDS: Record<string, string[]> = {
    Product: ['name', 'subtitle', 'shortDescription', 'description', 'fullDetails', 'specifications', 'metaTitle', 'metaDescription'],
    ProductFormat: ['name', 'description'],
    Category: ['name', 'description'],
    Article: ['title', 'excerpt', 'content', 'metaTitle', 'metaDescription'],
    BlogPost: ['title', 'excerpt', 'content', 'metaTitle', 'metaDescription'],
    Video: ['title', 'description'],
    Webinar: ['title', 'description', 'speakerTitle'],
    QuickReply: ['title', 'content'],
  };

  const FK_FIELD: Record<string, string> = {
    Product: 'productId', ProductFormat: 'formatId', Category: 'categoryId',
    Article: 'articleId', BlogPost: 'blogPostId', Video: 'videoId',
    Webinar: 'webinarId', QuickReply: 'quickReplyId',
  };

  const TABLE_NAME: Record<string, string> = {
    Product: 'productTranslation', ProductFormat: 'productFormatTranslation',
    Category: 'categoryTranslation', Article: 'articleTranslation',
    BlogPost: 'blogPostTranslation', Video: 'videoTranslation',
    Webinar: 'webinarTranslation', QuickReply: 'quickReplyTranslation',
  };

  const LOCALE_NAMES: Record<string, string> = {
    fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese',
    zh: 'Simplified Chinese', ko: 'Korean', ar: 'Arabic', 'ar-ma': 'Moroccan Arabic',
    'ar-dz': 'Algerian Arabic', 'ar-lb': 'Lebanese Arabic', ru: 'Russian', hi: 'Hindi',
    pl: 'Polish', sv: 'Swedish', vi: 'Vietnamese', ta: 'Tamil', pa: 'Punjabi',
    tl: 'Filipino', ht: 'Haitian Creole', gcr: 'Guadeloupean Creole',
  };

  const GLOSSARY = `PRESERVE exactly: BPC-157, TB-500, Semaglutide, Tirzepatide, CJC-1295, Ipamorelin, GHRP-6, Epitalon, NAD+, PT-141, GHK-Cu, AOD-9604, Selank, Semax, LL-37, KPV, BioCycle Peptides, HPLC, COA, GMP, mg, mcg, mL, IU, Da, CAD, USD. Keep HTML/Markdown tags, numbers, prices, chemical formulas, CAS numbers unchanged.`;

  async function translateFields(fields: { name: string; value: string }[], locale: string): Promise<Record<string, string>> {
    const nonEmpty = fields.filter(f => f.value && f.value.trim().length > 0);
    if (nonEmpty.length === 0) return {};

    const userContent = nonEmpty
      .map(f => `[FIELD:${f.name}]\n${f.value}\n[/FIELD:${f.name}]`)
      .join('\n\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Translate content for a Canadian peptide research company to ${LOCALE_NAMES[locale] || locale}. Return ONLY translated content using the same [FIELD:name]...[/FIELD:name] markers. ${GLOSSARY}`,
        },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 8192,
    });

    const result = response.choices[0]?.message?.content || '';
    const translated: Record<string, string> = {};

    for (const field of nonEmpty) {
      const escapedName = field.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\[FIELD:${escapedName}\\]\\n?([\\s\\S]*?)\\n?\\[/FIELD:${escapedName}\\]`);
      const match = result.match(regex);
      translated[field.name] = match ? match[1].trim() : field.value;
    }

    return translated;
  }

  // Process each model
  let totalDone = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  for (const model of models) {
    const sourceModel = model === 'ProductFormat' ? 'productFormat' : model.charAt(0).toLowerCase() + model.slice(1);
    const entities = await ((prisma as Record<string, any>)[sourceModel]).findMany() // eslint-disable-line @typescript-eslint/no-explicit-any

    console.log(`\n--- ${model} (${entities.length} entités) ---`);

    for (const entity of entities) {
      const fields = TRANSLATABLE_FIELDS[model]
        .filter((f: string) => entity[f] && entity[f].trim().length > 0)
        .map((f: string) => ({ name: f, value: entity[f] }));

      if (fields.length === 0) {
        console.log(`  [SKIP] ${model}#${entity.id} - aucun champ à traduire`);
        continue;
      }

      // Compute content hash
      const { createHash } = await import('crypto');
      const hashContent = fields.map((f: { name: string; value: string }) => `${f.name}:${f.value}`).sort().join('|');
      const hash = createHash('md5').update(hashContent).digest('hex');

      // Translate to each locale
      for (let i = 0; i < LOCALES.length; i += concurrency) {
        const batch = LOCALES.slice(i, i + concurrency);

        await Promise.all(batch.map(async (locale) => {
          const tableName = TABLE_NAME[model];
          const fkField = FK_FIELD[model];

          // Check if translation already exists and is current
          if (!force) {
            try {
              const existing = await ((prisma as Record<string, any>)[tableName]).findUnique({ // eslint-disable-line @typescript-eslint/no-explicit-any
                where: { [`${fkField}_locale`]: { [fkField]: entity.id, locale } },
              });
              if (existing && existing.contentHash === hash) {
                return; // Already translated
              }
            } catch {
              // Table might not exist yet - continue with translation
            }
          }

          try {
            const translated = await translateFields(fields, locale);

            await ((prisma as Record<string, any>)[tableName]).upsert({ // eslint-disable-line @typescript-eslint/no-explicit-any
              where: { [`${fkField}_locale`]: { [fkField]: entity.id, locale } },
              create: {
                [fkField]: entity.id,
                locale,
                contentHash: hash,
                translatedBy: 'gpt-4o-mini',
                isApproved: false,
                ...translated,
              },
              update: {
                contentHash: hash,
                translatedBy: 'gpt-4o-mini',
                isApproved: false,
                ...translated,
              },
            });

            totalDone++;
            process.stdout.write(`\r  ${model}#${entity.id.slice(0, 8)}... → ${locale} ✓ (${totalDone} total)`);
          } catch (error) {
            totalErrors++;
            console.error(`\n  [ERROR] ${model}#${entity.id} → ${locale}:`, error instanceof Error ? error.message : error);
          }
        }));

        // Rate limit delay
        if (i + concurrency < LOCALES.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      console.log(); // New line after locale progress
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '='.repeat(60));
  console.log(`  Terminé en ${elapsed}s`);
  console.log(`  Traductions réussies: ${totalDone}`);
  console.log(`  Erreurs: ${totalErrors}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
