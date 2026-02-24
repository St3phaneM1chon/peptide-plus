/**
 * Recurring Entries Service
 * Manages automatic recurring journal entries (subscriptions, depreciation, etc.)
 */

import { db as prisma } from '@/lib/db';
import { logAuditTrail } from './audit-trail.service';
import { logger } from '@/lib/logger';

// #95 Retry configuration for failed recurring entries
const RETRY_CONFIG = {
  /** Maximum number of retry attempts for a failed recurring entry */
  MAX_RETRIES: 3,
  /** Base delay between retries in milliseconds (doubles each attempt) */
  BASE_DELAY_MS: 1000,
} as const;

export interface RecurringEntryTemplate {
  id: string;
  name: string;
  description: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  dayOfMonth?: number; // For monthly (1-31)
  dayOfWeek?: number; // For weekly (0-6, 0=Sunday)
  monthOfYear?: number; // For yearly (1-12)
  
  // Entry details
  lines: {
    accountCode: string;
    accountName: string;
    description?: string;
    debitAmount: number;
    creditAmount: number;
  }[];
  
  // Schedule
  startDate: Date;
  endDate?: Date;
  nextRunDate: Date;
  lastRunDate?: Date;
  
  // Options
  isActive: boolean;
  autoPost: boolean; // Auto-post or create as draft
  notifyOnCreate: boolean;
  
  // Stats
  totalRuns: number;
  createdAt: Date;
  updatedAt: Date;
}

// Predefined templates for common recurring entries
export const PREDEFINED_TEMPLATES: Partial<RecurringEntryTemplate>[] = [
  {
    name: 'Amortissement équipement',
    description: 'Amortissement mensuel des immobilisations',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    lines: [
      { accountCode: '6800', accountName: 'Amortissement', debitAmount: 125, creditAmount: 0 },
      { accountCode: '1590', accountName: 'Amortissement cumulé', debitAmount: 0, creditAmount: 125 },
    ],
    autoPost: true,
  },
  {
    name: 'Hébergement Azure',
    description: 'Frais mensuels Azure App Service',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    lines: [
      { accountCode: '6310', accountName: 'Hébergement Azure', debitAmount: 150, creditAmount: 0 },
      { accountCode: '2000', accountName: 'Comptes fournisseurs', debitAmount: 0, creditAmount: 150 },
    ],
    autoPost: false,
  },
  {
    name: 'Domaines & SSL',
    description: 'Frais annuels domaines et certificats',
    frequency: 'YEARLY',
    monthOfYear: 1,
    dayOfMonth: 15,
    lines: [
      { accountCode: '6320', accountName: 'Domaines & SSL', debitAmount: 200, creditAmount: 0 },
      { accountCode: '1010', accountName: 'Compte bancaire', debitAmount: 0, creditAmount: 200 },
    ],
    autoPost: false,
  },
  {
    name: 'Provision créances douteuses',
    description: 'Provision mensuelle pour créances douteuses (1% des ventes)',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    lines: [
      { accountCode: '6900', accountName: 'Provision créances douteuses', debitAmount: 0, creditAmount: 0 }, // Calculated
      { accountCode: '1190', accountName: 'Provision pour créances douteuses', debitAmount: 0, creditAmount: 0 },
    ],
    autoPost: false,
  },
];

/**
 * Get all recurring entry templates from the database
 */
export async function getRecurringTemplates(): Promise<RecurringEntryTemplate[]> {
  const dbTemplates = await prisma.recurringEntryTemplate.findMany({
    where: { isActive: true },
    orderBy: { nextRunDate: 'asc' },
  });

  return dbTemplates.map((t) => {
    const data = t.templateData as {
      lines?: { accountCode: string; accountName: string; description?: string; debitAmount: number; creditAmount: number }[];
      autoPost?: boolean;
      notifyOnCreate?: boolean;
      startDate?: string;
      endDate?: string;
      monthOfYear?: number;
      totalRuns?: number;
    };
    return {
      id: t.id,
      name: t.name,
      description: t.description || '',
      frequency: t.frequency as RecurringEntryTemplate['frequency'],
      dayOfMonth: t.dayOfMonth ?? undefined,
      dayOfWeek: t.dayOfWeek ?? undefined,
      monthOfYear: data.monthOfYear,
      lines: data.lines || [],
      startDate: data.startDate ? new Date(data.startDate) : t.createdAt,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      nextRunDate: t.nextRunDate,
      lastRunDate: t.lastRunDate ?? undefined,
      isActive: t.isActive,
      autoPost: data.autoPost ?? false,
      notifyOnCreate: data.notifyOnCreate ?? true,
      totalRuns: data.totalRuns ?? 0,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  });
}

/**
 * Create a new recurring entry template (persisted to database)
 */
export async function createRecurringTemplate(
  template: Omit<RecurringEntryTemplate, 'id' | 'createdAt' | 'updatedAt' | 'totalRuns' | 'lastRunDate'>
): Promise<RecurringEntryTemplate> {
  const dbTemplate = await prisma.recurringEntryTemplate.create({
    data: {
      name: template.name,
      description: template.description,
      frequency: template.frequency,
      dayOfMonth: template.dayOfMonth,
      dayOfWeek: template.dayOfWeek,
      nextRunDate: template.nextRunDate,
      isActive: template.isActive,
      createdBy: 'admin',
      templateData: {
        lines: template.lines,
        autoPost: template.autoPost,
        notifyOnCreate: template.notifyOnCreate,
        startDate: template.startDate.toISOString(),
        endDate: template.endDate?.toISOString(),
        monthOfYear: template.monthOfYear,
        totalRuns: 0,
      },
    },
  });

  return {
    ...template,
    id: dbTemplate.id,
    totalRuns: 0,
    createdAt: dbTemplate.createdAt,
    updatedAt: dbTemplate.updatedAt,
  };
}

/**
 * Calculate next run date based on frequency
 */
export function calculateNextRunDate(
  frequency: RecurringEntryTemplate['frequency'],
  lastRunDate: Date,
  dayOfMonth?: number,
  dayOfWeek?: number,
  monthOfYear?: number
): Date {
  const next = new Date(lastRunDate);

  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      // FIX: F091 - Fix time to 00:00:00 UTC to prevent temporal drift on daily entries
      next.setUTCHours(0, 0, 0, 0);
      break;

    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      if (dayOfWeek !== undefined) {
        // Adjust to specific day of week
        const currentDay = next.getDay();
        const diff = dayOfWeek - currentDay;
        next.setDate(next.getDate() + (diff >= 0 ? diff : diff + 7));
      }
      break;

    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) {
        // Handle months with fewer days
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, maxDay));
      }
      break;

    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      if (dayOfMonth) {
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, maxDay));
      }
      break;

    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      if (monthOfYear) {
        next.setMonth(monthOfYear - 1);
      }
      if (dayOfMonth) {
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, maxDay));
      }
      break;
  }

  return next;
}

/**
 * #95 Helper: retry an async operation with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES,
  baseDelayMs: number = RETRY_CONFIG.BASE_DELAY_MS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn('[Recurring] Retry attempt failed', { attempt, maxRetries, label, delayMs: delay, error: error instanceof Error ? error.message : String(error) });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Process due recurring entries
 * #95 Enhanced with retry logic for transient failures
 */
export async function processDueRecurringEntries(): Promise<{
  processed: number;
  created: string[];
  errors: string[];
  retried: number;
}> {
  const result = {
    processed: 0,
    created: [] as string[],
    errors: [] as string[],
    retried: 0, // #95 Track how many entries needed retries
  };

  const templates = await getRecurringTemplates();
  const now = new Date();

  for (const template of templates) {
    if (!template.isActive) continue;
    if (template.endDate && template.endDate < now) continue;
    if (template.nextRunDate > now) continue;

    try {
      // #95 Wrap the entire entry creation in retry logic
      const entry = await withRetry(async () => {
        const year = now.getFullYear();
        const prefix = `JV-${year}-`;

        // Resolve account IDs before the transaction
        const resolvedLines = await Promise.all(template.lines.map(async (line) => {
          const account = await prisma.chartOfAccount.findUnique({
            where: { code: line.accountCode },
          });
          if (!account) {
            throw new Error(`Compte ${line.accountCode} introuvable pour "${template.name}"`);
          }
          return {
            accountId: account.id,
            description: line.description || template.name,
            debit: line.debitAmount,
            credit: line.creditAmount,
          };
        }));

        // Generate entry number inside a transaction with row-level lock
        // to prevent duplicate numbers under concurrent processing
        return prisma.$transaction(async (tx) => {
          const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
            SELECT MAX("entryNumber") as max_num
            FROM "JournalEntry"
            WHERE "entryNumber" LIKE ${prefix + '%'}
            FOR UPDATE
          `;

          let nextNum = 1;
          if (maxRow?.max_num) {
            const parsed = parseInt(maxRow.max_num.split('-').pop() || '0');
            if (!isNaN(parsed)) nextNum = parsed + 1;
          }
          // F063 FIX: Use padStart(5) for consistent entry number format
          const entryNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;

          return tx.journalEntry.create({
            data: {
              entryNumber,
              date: now,
              description: `${template.name} - Récurrent`,
              type: 'RECURRING',
              status: template.autoPost ? 'POSTED' : 'DRAFT',
              reference: `REC-${template.id}`,
              createdBy: 'Système (récurrent)',
              postedBy: template.autoPost ? 'Système' : null,
              postedAt: template.autoPost ? now : null,
              lines: {
                create: resolvedLines,
              },
            },
          });
        });
      }, template.name);

      result.created.push(entry.entryNumber);
      result.processed++;

      // Log audit trail for each recurring entry creation
      logAuditTrail({
        entityType: 'JOURNAL_ENTRY',
        entityId: entry.id,
        action: 'CREATE',
        field: 'recurring',
        oldValue: null,
        newValue: JSON.stringify({
          entryNumber: entry.entryNumber,
          templateId: template.id,
          templateName: template.name,
          frequency: template.frequency,
        }),
        userId: 'system',
        userName: 'Syst\u00e8me (r\u00e9current)',
        metadata: { source: 'processRecurringEntries', templateId: template.id },
      }).catch(() => {
        // Audit logging must never break recurring processing
      });

      // Persist nextRunDate and lastRunDate to database
      const nextRun = calculateNextRunDate(
        template.frequency,
        now,
        template.dayOfMonth,
        template.dayOfWeek,
        template.monthOfYear
      );

      // FIX (F042): Read existing templateData and merge with new values
      // instead of rebuilding a partial object that loses existing fields
      const existingTemplateData = typeof template.templateData === 'object' && template.templateData !== null
        ? (template.templateData as Record<string, unknown>)
        : {};

      await prisma.recurringEntryTemplate.update({
        where: { id: template.id },
        data: {
          lastRunDate: now,
          nextRunDate: nextRun,
          templateData: {
            ...existingTemplateData,
            lines: template.lines,
            autoPost: template.autoPost,
            notifyOnCreate: template.notifyOnCreate,
            totalRuns: template.totalRuns + 1,
          },
        },
      });

      template.lastRunDate = now;
      template.nextRunDate = nextRun;
      template.totalRuns++;

    } catch (error) {
      // #95 All retries exhausted - log final failure
      result.errors.push(
        `Erreur pour ${template.name} (après ${RETRY_CONFIG.MAX_RETRIES} tentatives): ${error}`
      );
      result.retried++;
    }
  }

  return result;
}

/**
 * Preview next N occurrences of a recurring entry
 */
export function previewRecurringSchedule(
  template: RecurringEntryTemplate,
  count: number = 12
): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(template.nextRunDate);

  for (let i = 0; i < count; i++) {
    if (template.endDate && currentDate > template.endDate) break;
    
    dates.push(new Date(currentDate));
    currentDate = calculateNextRunDate(
      template.frequency,
      currentDate,
      template.dayOfMonth,
      template.dayOfWeek,
      template.monthOfYear
    );
  }

  return dates;
}

/**
 * Get frequency label in French
 */
export function getFrequencyLabel(frequency: RecurringEntryTemplate['frequency']): string {
  const labels = {
    DAILY: 'Quotidien',
    WEEKLY: 'Hebdomadaire',
    MONTHLY: 'Mensuel',
    QUARTERLY: 'Trimestriel',
    YEARLY: 'Annuel',
  };
  return labels[frequency];
}

/**
 * Phase 8: processRecurringEntries
 * Convenience wrapper around processDueRecurringEntries.
 * Queries active templates where nextRunDate <= now, creates journal entries,
 * updates nextRunDate, and logs to audit trail.
 */
export async function processRecurringEntries(): Promise<{
  processed: number;
  created: string[];
  errors: string[];
  retried: number;
}> {
  return processDueRecurringEntries();
}
