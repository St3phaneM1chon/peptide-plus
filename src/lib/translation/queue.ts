/**
 * FILE D'ATTENTE DE TRADUCTION - BioCycle Peptides
 *
 * Queue en mémoire pour les traductions asynchrones.
 * Les jobs sont traités séquentiellement avec retry et backoff exponentiel.
 *
 * Priorités:
 * 1 = Urgent (produit modifié, traduction manquante demandée)
 * 2 = High (nouveau produit, nouvelle catégorie)
 * 3 = Normal (nouvel article, blog post)
 * 4 = Low (vidéos, webinaires)
 * 5 = Batch (traduction initiale en masse)
 */

import {
  translateEntityAllLocales,
  type TranslatableModel,
} from './auto-translate';

// ============================================
// TYPES
// ============================================

export interface TranslationJob {
  id: string;
  model: TranslatableModel;
  entityId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  maxRetries: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  force: boolean;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// ============================================
// QUEUE STATE
// ============================================

const jobs: Map<string, TranslationJob> = new Map();
let isProcessing = false;
let processingTimeout: NodeJS.Timeout | null = null;

// ============================================
// QUEUE OPERATIONS
// ============================================

function generateJobId(): string {
  return `tj_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 6)}`;
}

/**
 * Add a translation job to the queue
 */
export function enqueueTranslation(
  model: TranslatableModel,
  entityId: string,
  options: { priority?: number; force?: boolean } = {}
): string {
  const { priority = 3, force = false } = options;

  // Check for duplicate pending job
  for (const [, job] of jobs) {
    if (
      job.model === model &&
      job.entityId === entityId &&
      (job.status === 'pending' || job.status === 'processing')
    ) {
      return job.id; // Already queued
    }
  }

  const id = generateJobId();
  const job: TranslationJob = {
    id,
    model,
    entityId,
    priority,
    status: 'pending',
    retries: 0,
    maxRetries: 3,
    createdAt: new Date(),
    force,
  };

  jobs.set(id, job);

  // Start processing if not already running
  if (!isProcessing) {
    scheduleProcessing();
  }

  return id;
}

/**
 * Enqueue translation for specific priority presets
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
};

/**
 * Get job status
 */
export function getJobStatus(jobId: string): TranslationJob | undefined {
  return jobs.get(jobId);
}

/**
 * Get queue statistics
 */
export function getQueueStats(): QueueStats {
  let pending = 0, processing = 0, completed = 0, failed = 0;

  for (const [, job] of jobs) {
    switch (job.status) {
      case 'pending': pending++; break;
      case 'processing': processing++; break;
      case 'completed': completed++; break;
      case 'failed': failed++; break;
    }
  }

  return { pending, processing, completed, failed, total: jobs.size };
}

/**
 * Get all jobs (optionally filtered by status)
 */
export function getJobs(status?: TranslationJob['status']): TranslationJob[] {
  const allJobs = Array.from(jobs.values());
  if (status) return allJobs.filter(j => j.status === status);
  return allJobs.sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Clear completed/failed jobs older than specified hours
 */
export function cleanupJobs(olderThanHours = 24): number {
  const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
  let removed = 0;

  for (const [id, job] of jobs) {
    if (
      (job.status === 'completed' || job.status === 'failed') &&
      job.createdAt.getTime() < cutoff
    ) {
      jobs.delete(id);
      removed++;
    }
  }

  return removed;
}

// ============================================
// QUEUE PROCESSING
// ============================================

function scheduleProcessing(delayMs = 100): void {
  if (processingTimeout) clearTimeout(processingTimeout);
  processingTimeout = setTimeout(processNextJob, delayMs);
}

async function processNextJob(): Promise<void> {
  // Find next pending job by priority
  const pendingJobs = Array.from(jobs.values())
    .filter(j => j.status === 'pending')
    .sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());

  if (pendingJobs.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const job = pendingJobs[0];
  job.status = 'processing';
  job.startedAt = new Date();

  try {
    console.log(`[TranslationQueue] Processing ${job.model}#${job.entityId} (priority: ${job.priority})`);

    await translateEntityAllLocales(job.model, job.entityId, {
      force: job.force,
      concurrency: 3,
    });

    job.status = 'completed';
    job.completedAt = new Date();
    console.log(`[TranslationQueue] Completed ${job.model}#${job.entityId}`);
  } catch (error) {
    job.retries++;
    if (job.retries >= job.maxRetries) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      console.error(`[TranslationQueue] Failed (max retries) ${job.model}#${job.entityId}:`, error);
    } else {
      job.status = 'pending';
      console.warn(`[TranslationQueue] Retry ${job.retries}/${job.maxRetries} for ${job.model}#${job.entityId}`);
    }
  }

  // Schedule next job with backoff if retrying
  const delay = job.status === 'pending'
    ? Math.pow(2, job.retries) * 1000 // Exponential backoff
    : 500; // Normal delay between jobs

  scheduleProcessing(delay);
}

/**
 * Stop the queue processing
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
