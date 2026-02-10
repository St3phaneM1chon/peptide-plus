/**
 * Recurring Entries Service
 * Manages automatic recurring journal entries (subscriptions, depreciation, etc.)
 */

import { db as prisma } from '@/lib/db';

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
 * Get all recurring entry templates
 */
export async function getRecurringTemplates(): Promise<RecurringEntryTemplate[]> {
  // In production, fetch from database
  // For now, return mock data
  const templates: RecurringEntryTemplate[] = [
    {
      id: 'rec-1',
      name: 'Amortissement équipement',
      description: 'Amortissement mensuel des immobilisations',
      frequency: 'MONTHLY',
      dayOfMonth: 1,
      lines: [
        { accountCode: '6800', accountName: 'Amortissement', debitAmount: 125, creditAmount: 0 },
        { accountCode: '1590', accountName: 'Amortissement cumulé', debitAmount: 0, creditAmount: 125 },
      ],
      startDate: new Date('2026-01-01'),
      nextRunDate: new Date('2026-02-01'),
      lastRunDate: new Date('2026-01-01'),
      isActive: true,
      autoPost: true,
      notifyOnCreate: false,
      totalRuns: 1,
      createdAt: new Date('2025-12-15'),
      updatedAt: new Date('2026-01-01'),
    },
    {
      id: 'rec-2',
      name: 'Hébergement Azure',
      description: 'Frais mensuels Azure App Service + PostgreSQL',
      frequency: 'MONTHLY',
      dayOfMonth: 5,
      lines: [
        { accountCode: '6310', accountName: 'Hébergement Azure', debitAmount: 185.50, creditAmount: 0 },
        { accountCode: '2000', accountName: 'Comptes fournisseurs', debitAmount: 0, creditAmount: 185.50 },
      ],
      startDate: new Date('2026-01-01'),
      nextRunDate: new Date('2026-02-05'),
      lastRunDate: new Date('2026-01-05'),
      isActive: true,
      autoPost: false,
      notifyOnCreate: true,
      totalRuns: 1,
      createdAt: new Date('2025-12-20'),
      updatedAt: new Date('2026-01-05'),
    },
    {
      id: 'rec-3',
      name: 'Abonnement OpenAI API',
      description: 'Frais mensuels API ChatGPT pour chatbot',
      frequency: 'MONTHLY',
      dayOfMonth: 1,
      lines: [
        { accountCode: '6330', accountName: 'Services SaaS', debitAmount: 50, creditAmount: 0 },
        { accountCode: '1010', accountName: 'Compte bancaire', debitAmount: 0, creditAmount: 50 },
      ],
      startDate: new Date('2026-01-01'),
      nextRunDate: new Date('2026-02-01'),
      lastRunDate: new Date('2026-01-01'),
      isActive: true,
      autoPost: true,
      notifyOnCreate: false,
      totalRuns: 1,
      createdAt: new Date('2025-12-25'),
      updatedAt: new Date('2026-01-01'),
    },
  ];

  return templates;
}

/**
 * Create a new recurring entry template
 */
export async function createRecurringTemplate(
  template: Omit<RecurringEntryTemplate, 'id' | 'createdAt' | 'updatedAt' | 'totalRuns' | 'lastRunDate'>
): Promise<RecurringEntryTemplate> {
  const now = new Date();
  const newTemplate: RecurringEntryTemplate = {
    ...template,
    id: `rec-${Date.now()}`,
    totalRuns: 0,
    createdAt: now,
    updatedAt: now,
  };

  // In production, save to database
  return newTemplate;
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
 * Process due recurring entries
 */
export async function processDueRecurringEntries(): Promise<{
  processed: number;
  created: string[];
  errors: string[];
}> {
  const result = {
    processed: 0,
    created: [] as string[],
    errors: [] as string[],
  };

  const templates = await getRecurringTemplates();
  const now = new Date();

  for (const template of templates) {
    if (!template.isActive) continue;
    if (template.endDate && template.endDate < now) continue;
    if (template.nextRunDate > now) continue;

    try {
      // Generate entry number
      const year = now.getFullYear();
      const count = await prisma.journalEntry.count({
        where: { entryNumber: { startsWith: `JV-${year}` } },
      });
      const entryNumber = `JV-${year}-${String(count + 1).padStart(4, '0')}`;

      // Create journal entry
      const entry = await prisma.journalEntry.create({
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
            create: await Promise.all(template.lines.map(async (line) => {
              const account = await prisma.chartOfAccount.findUnique({
                where: { code: line.accountCode },
              });
              return {
                accountId: account?.id || '',
                description: line.description || template.name,
                debit: line.debitAmount,
                credit: line.creditAmount,
              };
            })),
          },
        },
      });

      result.created.push(entry.entryNumber);
      result.processed++;

      // Update template (in production, save to database)
      template.lastRunDate = now;
      template.nextRunDate = calculateNextRunDate(
        template.frequency,
        now,
        template.dayOfMonth,
        template.dayOfWeek,
        template.monthOfYear
      );
      template.totalRuns++;

    } catch (error) {
      result.errors.push(`Erreur pour ${template.name}: ${error}`);
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
