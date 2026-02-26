/**
 * Revenue Recognition Service (ASC 606 / IFRS 15)
 *
 * Handles deferred revenue tracking for subscription products.
 * Uses JournalEntry model with special reference prefixes and types
 * to track revenue schedules without modifying the Prisma schema.
 *
 * Recognition Methods:
 *   POINT_OF_SALE  - Immediate recognition at delivery
 *   STRAIGHT_LINE  - Ratably over subscription period
 *   MILESTONE      - At specific milestones
 *
 * Data Storage Strategy:
 *   Revenue schedules are stored as JournalEntry records with:
 *   - reference: 'REVSCHED-{orderId}' for the schedule header
 *   - reference: 'REVRECOG-{scheduleRef}-{date}' for recognition events
 *   - type: ADJUSTMENT (for deferred revenue movements)
 *   - description: Contains JSON metadata in a structured prefix
 */

import { prisma } from '@/lib/db';
import { ACCOUNT_CODES } from './types';
import { logger } from '@/lib/logger';
import { assertJournalBalance } from './validation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecognitionMethod = 'POINT_OF_SALE' | 'STRAIGHT_LINE' | 'MILESTONE';

export type RevenueScheduleStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface RevenueScheduleItem {
  description: string;
  amount: number;
  recognitionMethod: RecognitionMethod;
  /** For STRAIGHT_LINE: number of months */
  periodMonths?: number;
  /** For MILESTONE: list of milestone dates and percentages */
  milestones?: { date: string; percentage: number }[];
}

export interface RevenueSchedule {
  id: string;
  orderId: string;
  reference: string;
  totalAmount: number;
  recognizedAmount: number;
  deferredAmount: number;
  status: RevenueScheduleStatus;
  method: RecognitionMethod;
  startDate: string;
  endDate?: string;
  periodMonths?: number;
  milestones?: { date: string; percentage: number }[];
  createdAt: string;
  items: RevenueScheduleItem[];
}

export interface RecognitionEvent {
  scheduleReference: string;
  date: string;
  amount: number;
  entryNumber: string;
  description: string;
}

export interface RevenueByType {
  pointOfSale: number;
  subscription: number;
  milestone: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEDULE_REF_PREFIX = 'REVSCHED-';
const RECOGNITION_REF_PREFIX = 'REVRECOG-';
const SCHEDULE_DESCRIPTION_PREFIX = '[REVSCHED]';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseScheduleMetadata(description: string): Record<string, unknown> | null {
  if (!description.startsWith(SCHEDULE_DESCRIPTION_PREFIX)) return null;
  try {
    const jsonPart = description.slice(SCHEDULE_DESCRIPTION_PREFIX.length).trim();
    // The JSON metadata is between the first { and the last }
    const startIdx = jsonPart.indexOf('{');
    const endIdx = jsonPart.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) return null;
    return JSON.parse(jsonPart.slice(startIdx, endIdx + 1));
  } catch {
    return null;
  }
}

function buildScheduleDescription(metadata: Record<string, unknown>, humanReadable: string): string {
  return `${SCHEDULE_DESCRIPTION_PREFIX} ${JSON.stringify(metadata)} | ${humanReadable}`;
}

async function getNextEntryNumber(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], date: Date): Promise<string> {
  const year = date.getFullYear();
  const prefix = `JV-${year}-`;
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
  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

async function getAccountIdByCode(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], code: string): Promise<string> {
  const account = await tx.chartOfAccount.findFirst({
    where: { code },
    select: { id: true },
  });
  if (!account) throw new Error(`Account code ${code} not found in chart of accounts`);
  return account.id;
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Create a revenue recognition schedule for an order.
 *
 * For POINT_OF_SALE: Recognizes revenue immediately (Debit AR/Bank, Credit Revenue)
 * For STRAIGHT_LINE: Creates deferred revenue entry and schedules monthly recognition
 * For MILESTONE: Creates deferred revenue entry with milestone-based recognition
 */
export async function createRevenueSchedule(
  orderId: string,
  items: RevenueScheduleItem[],
  recognitionMethod: RecognitionMethod,
  startDate?: Date
): Promise<{ scheduleReference: string; entriesCreated: number }> {
  const effectiveStartDate = startDate || new Date();
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  if (totalAmount <= 0) {
    throw new Error('Total revenue schedule amount must be positive');
  }

  const scheduleRef = `${SCHEDULE_REF_PREFIX}${orderId}`;

  // Check for existing schedule
  const existing = await prisma.journalEntry.findFirst({
    where: { reference: scheduleRef, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`Revenue schedule already exists for order ${orderId}`);
  }

  let entriesCreated = 0;

  await prisma.$transaction(async (tx) => {
    if (recognitionMethod === 'POINT_OF_SALE') {
      // Immediate recognition: Debit AR, Credit Revenue
      const entryNumber = await getNextEntryNumber(tx, effectiveStartDate);
      const arAccountId = await getAccountIdByCode(tx, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE_CA);
      const revenueAccountId = await getAccountIdByCode(tx, ACCOUNT_CODES.SALES_CANADA);

      const metadata = {
        method: recognitionMethod,
        totalAmount,
        status: 'COMPLETED' as RevenueScheduleStatus,
        orderId,
        items: items.map(i => ({ description: i.description, amount: i.amount })),
      };

      const linesToCreate = [
        { accountId: arAccountId, description: `Vente ${orderId}`, debit: totalAmount, credit: 0 },
        { accountId: revenueAccountId, description: `Revenu reconnu ${orderId}`, debit: 0, credit: totalAmount },
      ];
      assertJournalBalance(linesToCreate, `revenue-schedule ${scheduleRef}`);

      await tx.journalEntry.create({
        data: {
          entryNumber,
          date: effectiveStartDate,
          description: buildScheduleDescription(metadata, `Reconnaissance de revenu - Commande ${orderId}`),
          type: 'AUTO_SALE',
          status: 'POSTED',
          reference: scheduleRef,
          orderId,
          createdBy: 'Revenue Recognition',
          postedBy: 'Revenue Recognition',
          postedAt: new Date(),
          lines: { create: linesToCreate },
        },
      });
      entriesCreated = 1;

    } else if (recognitionMethod === 'STRAIGHT_LINE') {
      // Deferred revenue: Debit AR, Credit Deferred Revenue
      const periodMonths = items[0]?.periodMonths || 12;
      const entryNumber = await getNextEntryNumber(tx, effectiveStartDate);
      const arAccountId = await getAccountIdByCode(tx, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE_CA);
      const deferredAccountId = await getAccountIdByCode(tx, ACCOUNT_CODES.DEFERRED_REVENUE);

      const endDate = new Date(effectiveStartDate);
      endDate.setMonth(endDate.getMonth() + periodMonths);

      const metadata = {
        method: recognitionMethod,
        totalAmount,
        recognizedAmount: 0,
        status: 'ACTIVE' as RevenueScheduleStatus,
        orderId,
        periodMonths,
        startDate: effectiveStartDate.toISOString(),
        endDate: endDate.toISOString(),
        items: items.map(i => ({
          description: i.description,
          amount: i.amount,
          periodMonths: i.periodMonths || periodMonths,
        })),
      };

      const linesToCreate = [
        { accountId: arAccountId, description: `Vente abonnement ${orderId}`, debit: totalAmount, credit: 0 },
        { accountId: deferredAccountId, description: `Revenu différé ${orderId}`, debit: 0, credit: totalAmount },
      ];
      assertJournalBalance(linesToCreate, `revenue-schedule ${scheduleRef}`);

      await tx.journalEntry.create({
        data: {
          entryNumber,
          date: effectiveStartDate,
          description: buildScheduleDescription(metadata, `Revenu différé - Abonnement ${orderId} (${periodMonths} mois)`),
          type: 'ADJUSTMENT',
          status: 'POSTED',
          reference: scheduleRef,
          orderId,
          createdBy: 'Revenue Recognition',
          postedBy: 'Revenue Recognition',
          postedAt: new Date(),
          lines: { create: linesToCreate },
        },
      });
      entriesCreated = 1;

    } else if (recognitionMethod === 'MILESTONE') {
      // Deferred revenue with milestone-based recognition
      const milestones = items[0]?.milestones || [];
      if (milestones.length === 0) {
        throw new Error('MILESTONE recognition requires at least one milestone');
      }

      const totalPct = milestones.reduce((sum, m) => sum + m.percentage, 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error(`Milestone percentages must sum to 100% (got ${totalPct}%)`);
      }

      const entryNumber = await getNextEntryNumber(tx, effectiveStartDate);
      const arAccountId = await getAccountIdByCode(tx, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE_CA);
      const deferredAccountId = await getAccountIdByCode(tx, ACCOUNT_CODES.DEFERRED_REVENUE);

      const metadata = {
        method: recognitionMethod,
        totalAmount,
        recognizedAmount: 0,
        status: 'ACTIVE' as RevenueScheduleStatus,
        orderId,
        milestones,
        startDate: effectiveStartDate.toISOString(),
        items: items.map(i => ({
          description: i.description,
          amount: i.amount,
          milestones: i.milestones,
        })),
      };

      const linesToCreate = [
        { accountId: arAccountId, description: `Vente jalonnée ${orderId}`, debit: totalAmount, credit: 0 },
        { accountId: deferredAccountId, description: `Revenu différé jalons ${orderId}`, debit: 0, credit: totalAmount },
      ];
      assertJournalBalance(linesToCreate, `revenue-schedule ${scheduleRef}`);

      await tx.journalEntry.create({
        data: {
          entryNumber,
          date: effectiveStartDate,
          description: buildScheduleDescription(metadata, `Revenu différé par jalons - Commande ${orderId}`),
          type: 'ADJUSTMENT',
          status: 'POSTED',
          reference: scheduleRef,
          orderId,
          createdBy: 'Revenue Recognition',
          postedBy: 'Revenue Recognition',
          postedAt: new Date(),
          lines: { create: linesToCreate },
        },
      });
      entriesCreated = 1;
    }
  });

  return { scheduleReference: scheduleRef, entriesCreated };
}

/**
 * Process all pending revenue recognitions up to the given date.
 *
 * For STRAIGHT_LINE: Calculates monthly pro-rata amount and creates entries.
 * For MILESTONE: Checks if any milestones are due and creates entries.
 *
 * Creates journal entries: Debit Deferred Revenue, Credit Revenue
 */
export async function recognizeRevenue(
  asOfDate: Date
): Promise<{ processed: number; entriesCreated: number; errors: string[] }> {
  const result = { processed: 0, entriesCreated: 0, errors: [] as string[] };

  // Find all active revenue schedules
  const schedules = await prisma.journalEntry.findMany({
    where: {
      reference: { startsWith: SCHEDULE_REF_PREFIX },
      deletedAt: null,
      status: 'POSTED',
      description: { startsWith: SCHEDULE_DESCRIPTION_PREFIX },
    },
    select: { id: true, reference: true, description: true, date: true },
  });

  for (const schedule of schedules) {
    try {
      const metadata = parseScheduleMetadata(schedule.description);
      if (!metadata) continue;
      if (metadata.status !== 'ACTIVE') continue;
      if (metadata.method === 'POINT_OF_SALE') continue; // Already recognized

      const totalAmount = metadata.totalAmount as number;
      const recognizedSoFar = metadata.recognizedAmount as number || 0;
      const remaining = totalAmount - recognizedSoFar;

      if (remaining <= 0.01) continue; // Already fully recognized

      let amountToRecognize = 0;
      const scheduleRef = schedule.reference!;

      if (metadata.method === 'STRAIGHT_LINE') {
        const periodMonths = metadata.periodMonths as number || 12;
        const startDate = new Date(metadata.startDate as string);
        const endDate = new Date(metadata.endDate as string);

        if (asOfDate < startDate) continue; // Not started yet

        // Calculate how many months have elapsed
        const monthsElapsed = Math.min(
          periodMonths,
          Math.max(0,
            (asOfDate.getFullYear() - startDate.getFullYear()) * 12 +
            (asOfDate.getMonth() - startDate.getMonth()) + 1
          )
        );

        const targetRecognized = Math.min(totalAmount, (totalAmount / periodMonths) * monthsElapsed);
        amountToRecognize = Math.max(0, targetRecognized - recognizedSoFar);

        // Check if schedule should be completed
        if (asOfDate >= endDate) {
          amountToRecognize = remaining; // Recognize all remaining
        }

      } else if (metadata.method === 'MILESTONE') {
        const milestones = metadata.milestones as { date: string; percentage: number }[] || [];

        // Find milestones that are due (date <= asOfDate) and haven't been recognized yet
        // Check which milestones already have recognition entries
        const existingRecognitions = await prisma.journalEntry.findMany({
          where: {
            reference: { startsWith: `${RECOGNITION_REF_PREFIX}${scheduleRef}-` },
            deletedAt: null,
          },
          select: { reference: true },
        });
        const recognizedDates = new Set(
          existingRecognitions.map(r => r.reference!.split('-').pop())
        );

        for (const milestone of milestones) {
          const milestoneDate = new Date(milestone.date);
          const milestoneKey = milestone.date.replace(/[^0-9]/g, '');
          if (milestoneDate <= asOfDate && !recognizedDates.has(milestoneKey)) {
            amountToRecognize += (totalAmount * milestone.percentage) / 100;
          }
        }
      }

      // Round to 2 decimals
      amountToRecognize = Math.round(amountToRecognize * 100) / 100;

      if (amountToRecognize <= 0) continue;
      // Cap at remaining deferred amount
      amountToRecognize = Math.min(amountToRecognize, remaining);

      // Create recognition journal entry
      await prisma.$transaction(async (tx) => {
        const dateStr = asOfDate.toISOString().split('T')[0].replace(/-/g, '');
        const recognitionRef = `${RECOGNITION_REF_PREFIX}${scheduleRef}-${dateStr}`;

        // Check idempotency
        const existingRecog = await tx.journalEntry.findFirst({
          where: { reference: recognitionRef, deletedAt: null },
          select: { id: true },
        });
        if (existingRecog) return; // Already processed

        const entryNumber = await getNextEntryNumber(tx, asOfDate);
        const deferredAccountId = await getAccountIdByCode(tx, ACCOUNT_CODES.DEFERRED_REVENUE);
        const revenueAccountId = await getAccountIdByCode(tx, ACCOUNT_CODES.SALES_CANADA);

        const orderId = metadata.orderId as string;
        const linesToCreate = [
          { accountId: deferredAccountId, description: `Reconnaissance revenu ${orderId}`, debit: amountToRecognize, credit: 0 },
          { accountId: revenueAccountId, description: `Revenu reconnu ${orderId}`, debit: 0, credit: amountToRecognize },
        ];
        assertJournalBalance(linesToCreate, `revenue-recognition ${recognitionRef}`);

        await tx.journalEntry.create({
          data: {
            entryNumber,
            date: asOfDate,
            description: `Reconnaissance de revenu - ${scheduleRef} (${amountToRecognize.toFixed(2)} CAD)`,
            type: 'ADJUSTMENT',
            status: 'POSTED',
            reference: recognitionRef,
            orderId: orderId || undefined,
            createdBy: 'Revenue Recognition Cron',
            postedBy: 'Revenue Recognition Cron',
            postedAt: new Date(),
            lines: { create: linesToCreate },
          },
        });

        // Update the schedule metadata with new recognized amount
        const newRecognizedAmount = recognizedSoFar + amountToRecognize;
        const isComplete = Math.abs(newRecognizedAmount - totalAmount) < 0.01;
        const updatedMetadata = {
          ...metadata,
          recognizedAmount: Math.round(newRecognizedAmount * 100) / 100,
          status: isComplete ? 'COMPLETED' : 'ACTIVE',
        };

        const currentDesc = schedule.description;
        const pipeIdx = currentDesc.indexOf('|');
        const humanPart = pipeIdx !== -1 ? currentDesc.slice(pipeIdx + 1).trim() : '';
        const newDescription = buildScheduleDescription(updatedMetadata, humanPart);

        await tx.journalEntry.update({
          where: { id: schedule.id },
          data: { description: newDescription },
        });

        result.entriesCreated++;
      });

      result.processed++;
    } catch (err) {
      const msg = `Error processing schedule ${schedule.reference}: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(msg);
      result.errors.push(msg);
    }
  }

  return result;
}

/**
 * Get the current deferred revenue balance as of a specific date.
 * Sums credits minus debits on the Deferred Revenue account (2300) for posted entries.
 */
export async function getDeferredRevenueBalance(
  asOfDate: Date
): Promise<{ balance: number; scheduleCount: number; details: { orderId: string; deferred: number; recognized: number; total: number; method: string; status: string }[] }> {
  // Get aggregate deferred revenue from journal lines
  const deferredLines = await prisma.journalLine.aggregate({
    where: {
      account: { code: ACCOUNT_CODES.DEFERRED_REVENUE },
      entry: {
        status: 'POSTED',
        deletedAt: null,
        date: { lte: asOfDate },
      },
    },
    _sum: { credit: true, debit: true },
  });

  const balance = Number(deferredLines._sum.credit || 0) - Number(deferredLines._sum.debit || 0);

  // Get schedule details
  const schedules = await prisma.journalEntry.findMany({
    where: {
      reference: { startsWith: SCHEDULE_REF_PREFIX },
      deletedAt: null,
      status: 'POSTED',
      description: { startsWith: SCHEDULE_DESCRIPTION_PREFIX },
    },
    select: { reference: true, description: true },
    orderBy: { date: 'desc' },
  });

  const details = schedules
    .map(s => {
      const meta = parseScheduleMetadata(s.description);
      if (!meta) return null;
      return {
        orderId: (meta.orderId as string) || '',
        deferred: ((meta.totalAmount as number) || 0) - ((meta.recognizedAmount as number) || 0),
        recognized: (meta.recognizedAmount as number) || 0,
        total: (meta.totalAmount as number) || 0,
        method: (meta.method as string) || 'UNKNOWN',
        status: (meta.status as string) || 'UNKNOWN',
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  return {
    balance: Math.round(balance * 100) / 100,
    scheduleCount: details.length,
    details,
  };
}

/**
 * Get revenue breakdown by type for a date range.
 * Point-of-sale = immediate revenue (AUTO_SALE entries)
 * Subscription = recognized from deferred (REVRECOG entries)
 * Milestone = recognized from milestone schedules
 */
export async function getRevenueByType(
  dateFrom: Date,
  dateTo: Date
): Promise<RevenueByType> {
  // Point of sale: revenue from AUTO_SALE entries (not from revenue schedules)
  const posLines = await prisma.journalLine.aggregate({
    where: {
      account: { code: { startsWith: '4' } }, // Revenue accounts
      entry: {
        status: 'POSTED',
        deletedAt: null,
        date: { gte: dateFrom, lte: dateTo },
        type: 'AUTO_SALE',
        reference: { not: { startsWith: SCHEDULE_REF_PREFIX } },
      },
    },
    _sum: { credit: true, debit: true },
  });
  const pointOfSale = Number(posLines._sum.credit || 0) - Number(posLines._sum.debit || 0);

  // Subscription revenue: from REVRECOG entries for STRAIGHT_LINE schedules
  const recognitionEntries = await prisma.journalEntry.findMany({
    where: {
      reference: { startsWith: RECOGNITION_REF_PREFIX },
      deletedAt: null,
      status: 'POSTED',
      date: { gte: dateFrom, lte: dateTo },
    },
    include: {
      lines: {
        where: { account: { code: { startsWith: '4' } } },
        select: { credit: true, debit: true },
      },
    },
  });

  let subscriptionRevenue = 0;
  let milestoneRevenue = 0;

  for (const entry of recognitionEntries) {
    const lineTotal = entry.lines.reduce((sum, l) => sum + Number(l.credit) - Number(l.debit), 0);

    // Determine the schedule method from the original schedule
    const scheduleRefMatch = entry.reference?.match(/REVRECOG-(REVSCHED-[^-]+(?:-[^-]+)*)-\d+/);
    if (scheduleRefMatch) {
      const scheduleRef = scheduleRefMatch[1];
      const schedule = await prisma.journalEntry.findFirst({
        where: { reference: scheduleRef, deletedAt: null },
        select: { description: true },
      });
      if (schedule) {
        const meta = parseScheduleMetadata(schedule.description);
        if (meta?.method === 'MILESTONE') {
          milestoneRevenue += lineTotal;
        } else {
          subscriptionRevenue += lineTotal;
        }
      } else {
        subscriptionRevenue += lineTotal; // Default to subscription
      }
    }
  }

  // Also include POINT_OF_SALE schedule revenue
  const posScheduleLines = await prisma.journalLine.aggregate({
    where: {
      account: { code: { startsWith: '4' } },
      entry: {
        status: 'POSTED',
        deletedAt: null,
        date: { gte: dateFrom, lte: dateTo },
        reference: { startsWith: SCHEDULE_REF_PREFIX },
        type: 'AUTO_SALE',
      },
    },
    _sum: { credit: true, debit: true },
  });
  const posScheduleRevenue = Number(posScheduleLines._sum.credit || 0) - Number(posScheduleLines._sum.debit || 0);

  return {
    pointOfSale: Math.round((pointOfSale + posScheduleRevenue) * 100) / 100,
    subscription: Math.round(subscriptionRevenue * 100) / 100,
    milestone: Math.round(milestoneRevenue * 100) / 100,
    total: Math.round((pointOfSale + posScheduleRevenue + subscriptionRevenue + milestoneRevenue) * 100) / 100,
  };
}

/**
 * List all revenue schedules with optional status filter.
 */
export async function listRevenueSchedules(options?: {
  status?: RevenueScheduleStatus;
  page?: number;
  limit?: number;
}): Promise<{ schedules: RevenueSchedule[]; total: number }> {
  const page = options?.page || 1;
  const limit = Math.min(options?.limit || 50, 200);

  const where: Record<string, unknown> = {
    reference: { startsWith: SCHEDULE_REF_PREFIX },
    deletedAt: null,
    status: 'POSTED',
    description: { startsWith: SCHEDULE_DESCRIPTION_PREFIX },
  };

  const entries = await prisma.journalEntry.findMany({
    where,
    select: {
      id: true,
      reference: true,
      description: true,
      date: true,
      orderId: true,
      createdAt: true,
    },
    orderBy: { date: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.journalEntry.count({ where });

  const schedules: RevenueSchedule[] = entries
    .map(entry => {
      const meta = parseScheduleMetadata(entry.description);
      if (!meta) return null;

      // Filter by status if specified
      if (options?.status && meta.status !== options.status) return null;

      const totalAmt = (meta.totalAmount as number) || 0;
      const recognizedAmt = (meta.recognizedAmount as number) || 0;

      return {
        id: entry.id,
        orderId: (meta.orderId as string) || entry.orderId || '',
        reference: entry.reference || '',
        totalAmount: totalAmt,
        recognizedAmount: recognizedAmt,
        deferredAmount: Math.round((totalAmt - recognizedAmt) * 100) / 100,
        status: (meta.status as RevenueScheduleStatus) || 'ACTIVE',
        method: (meta.method as RecognitionMethod) || 'POINT_OF_SALE',
        startDate: (meta.startDate as string) || entry.date.toISOString(),
        endDate: meta.endDate as string | undefined,
        periodMonths: meta.periodMonths as number | undefined,
        milestones: meta.milestones as { date: string; percentage: number }[] | undefined,
        createdAt: entry.createdAt.toISOString(),
        items: (meta.items as RevenueScheduleItem[]) || [],
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return { schedules, total };
}
