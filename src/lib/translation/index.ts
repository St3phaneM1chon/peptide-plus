/**
 * MODULE DE TRADUCTION AUTOMATIQUE - BioCycle Peptides
 *
 * Usage:
 *   import { translateEntity, withTranslation, enqueue } from '@/lib/translation';
 *
 *   // Traduire un produit dans toutes les langues
 *   await translateEntityAllLocales('Product', productId);
 *
 *   // Appliquer les traductions à un objet produit
 *   const translatedProduct = await withTranslation(product, 'Product', 'fr');
 *
 *   // Mettre en file d'attente (asynchrone)
 *   enqueue.product(productId);
 */

export {
  // Core translation
  translateText,
  translateFields,
  translateEntity,
  translateEntityAllLocales,
  batchTranslateModel,

  // Read path
  getTranslatedFields,
  withTranslation,
  withTranslations,

  // Status
  getTranslationStatus,
  getModelTranslationCoverage,

  // Helpers
  contentHash,
  TRANSLATABLE_FIELDS,

  // Types
  type TranslatableModel,
  type TranslationStatus,
} from './auto-translate';

export {
  // Queue operations (DB-backed, persistent)
  enqueueTranslation,
  enqueue,
  getJobStatus,
  getQueueStats,
  getJobs,
  cleanupJobs,
  stopQueue,
  resumeQueue,
  processNightJobs,
  type TranslationJob,
  type QueueStats,
} from './queue';

export {
  // Glossary
  buildGlossaryPrompt,
  buildTranslationSystemPrompt,
  getLanguageName,
  PEPTIDE_NAMES,
  SCIENTIFIC_TERMS,
  LOCALE_TO_LANGUAGE,
} from './glossary';
