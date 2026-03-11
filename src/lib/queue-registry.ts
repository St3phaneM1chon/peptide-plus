/**
 * QUEUE REGISTRY — Maps queue names to their job processor functions.
 *
 * When a worker starts, it looks up the processor for its queue name here.
 * Each processor receives a BullMQ Job and returns a Promise<void>.
 *
 * To add a new queue processor:
 * 1. Create a processor file in src/lib/jobs/<name>.ts
 * 2. Import and register it below
 *
 * This file is deliberately kept thin — it only wires together the queue
 * names and their processors. The actual business logic lives in the
 * individual job files under src/lib/jobs/.
 */

import type { Job } from 'bullmq';

// ---------------------------------------------------------------------------
// Processor type
// ---------------------------------------------------------------------------

export type JobProcessor = (job: Job) => Promise<void>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Maps queue names to their processor functions.
 * Workers call `queueProcessors[queueName]` to get the handler.
 */
export const queueProcessors: Record<string, JobProcessor> = {};

/**
 * Register a processor for a queue name.
 * Typically called at module load time by each job file.
 */
export function registerProcessor(queueName: string, processor: JobProcessor): void {
  queueProcessors[queueName] = processor;
}

// ---------------------------------------------------------------------------
// Job processor registrations
// ---------------------------------------------------------------------------

// Media cleanup — proof of concept migration
import { processMediaCleanup } from '@/lib/jobs/media-cleanup';
registerProcessor('media-cleanup', processMediaCleanup);

// Future registrations will be added here as jobs are migrated:
// import { processFxRateSync } from '@/lib/jobs/fx-rate-sync';
// registerProcessor('fx-rate-sync', processFxRateSync);
