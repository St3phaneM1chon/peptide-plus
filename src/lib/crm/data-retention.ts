/**
 * CRM Data Retention Policies (L9)
 *
 * Auto-purge/anonymize old data based on retention policies.
 * - runRetentionPolicies: Execute all active policies
 * - anonymizeRecord: Replace PII with hashes for a specific record
 * - purgeOldRecords: Delete records older than the policy threshold
 * - getRetentionStatus: Return status of all policies and next run dates
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetentionResult {
  policyId: string;
  entityType: string;
  action: string;
  affected: number;
}

export interface RetentionStatus {
  policies: Array<{
    id: string;
    name: string;
    entityType: string;
    retentionDays: number;
    action: string;
    isActive: boolean;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
  }>;
  totalActive: number;
}

// ---------------------------------------------------------------------------
// Helper: Hash PII
// ---------------------------------------------------------------------------

function hashPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Run Retention Policies
// ---------------------------------------------------------------------------

/**
 * Execute all active retention policies. Returns summary of affected records.
 */
export async function runRetentionPolicies(): Promise<RetentionResult[]> {
  const policies = await prisma.dataRetentionPolicy.findMany({
    where: { isActive: true },
  });

  if (policies.length === 0) {
    logger.info('[data-retention] No active policies to run');
    return [];
  }

  const results: RetentionResult[] = [];

  for (const policy of policies) {
    try {
      let affected = 0;

      if (policy.action === 'anonymize') {
        affected = await anonymizeOldRecords(policy.entityType, policy.retentionDays);
      } else if (policy.action === 'delete') {
        affected = await purgeOldRecords(policy.entityType, policy.retentionDays);
      } else if (policy.action === 'archive') {
        // Archive is a soft-delete: mark records as archived
        affected = await archiveOldRecords(policy.entityType, policy.retentionDays);
      }

      // Update last run timestamp
      await prisma.dataRetentionPolicy.update({
        where: { id: policy.id },
        data: { lastRunAt: new Date() },
      });

      results.push({
        policyId: policy.id,
        entityType: policy.entityType,
        action: policy.action,
        affected,
      });

      logger.info('[data-retention] Policy executed', {
        policyId: policy.id,
        entityType: policy.entityType,
        action: policy.action,
        affected,
      });
    } catch (err) {
      logger.error('[data-retention] Policy execution failed', {
        policyId: policy.id,
        entityType: policy.entityType,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Anonymize Record
// ---------------------------------------------------------------------------

/**
 * Anonymize a specific record by replacing PII fields with hashed values.
 */
export async function anonymizeRecord(entityType: string, entityId: string): Promise<void> {
  switch (entityType) {
    case 'lead': {
      const lead = await prisma.crmLead.findUnique({ where: { id: entityId } });
      if (!lead) return;

      await prisma.crmLead.update({
        where: { id: entityId },
        data: {
          contactName: `ANON-${hashPII(lead.contactName)}`,
          email: lead.email ? `${hashPII(lead.email)}@anonymized.local` : null,
          phone: lead.phone ? `ANON-${hashPII(lead.phone)}` : null,
          companyName: lead.companyName ? `ANON-${hashPII(lead.companyName)}` : null,
          customFields: Prisma.DbNull,
        },
      });
      break;
    }
    case 'activity': {
      await prisma.crmActivity.update({
        where: { id: entityId },
        data: {
          description: '[ANONYMIZED]',
          metadata: Prisma.DbNull,
        },
      });
      break;
    }
    default:
      logger.warn('[data-retention] Unknown entity type for anonymization', { entityType, entityId });
  }
}

// ---------------------------------------------------------------------------
// Purge Old Records
// ---------------------------------------------------------------------------

/**
 * Delete records older than retentionDays for a given entity type.
 */
export async function purgeOldRecords(entityType: string, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  switch (entityType) {
    case 'activity': {
      const result = await prisma.crmActivity.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      return result.count;
    }
    case 'ticket': {
      const result = await prisma.crmTicketComment.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      // Also delete closed tickets
      const tickets = await prisma.crmTicket.deleteMany({
        where: {
          closedAt: { lt: cutoff },
          status: 'CLOSED',
        },
      });
      return result.count + tickets.count;
    }
    case 'recording': {
      const result = await prisma.callLog.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      });
      return result.count;
    }
    default:
      logger.warn('[data-retention] Unknown entity type for purge', { entityType });
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Archive Old Records (soft-delete)
// ---------------------------------------------------------------------------

async function anonymizeOldRecords(entityType: string, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  if (entityType === 'lead') {
    // Batch fetch all leads to anonymize with their PII fields
    const leads = await prisma.crmLead.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, contactName: true, email: true, phone: true, companyName: true },
    });

    // Batch anonymize using a transaction instead of N individual updates
    if (leads.length > 0) {
      await prisma.$transaction(
        leads.map((lead) =>
          prisma.crmLead.update({
            where: { id: lead.id },
            data: {
              contactName: `ANON-${hashPII(lead.contactName)}`,
              email: lead.email ? `${hashPII(lead.email)}@anonymized.local` : null,
              phone: lead.phone ? `ANON-${hashPII(lead.phone)}` : null,
              companyName: lead.companyName ? `ANON-${hashPII(lead.companyName)}` : null,
              customFields: Prisma.DbNull,
            },
          })
        ),
      );
    }

    return leads.length;
  }

  return 0;
}

async function archiveOldRecords(entityType: string, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  if (entityType === 'deal') {
    // Archive won/lost deals older than retention period
    const deals = await prisma.crmDeal.findMany({
      where: {
        actualCloseDate: { lt: cutoff },
      },
      select: { id: true },
    });

    // Batch archive using a transaction instead of N individual updates
    if (deals.length > 0) {
      await prisma.$transaction(
        deals.map((deal) =>
          prisma.crmDeal.update({
            where: { id: deal.id },
            data: {
              tags: { push: '_archived' },
            },
          })
        ),
      );
    }

    return deals.length;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Get Retention Status
// ---------------------------------------------------------------------------

/**
 * Return the status of all retention policies with next run estimates.
 */
export async function getRetentionStatus(): Promise<RetentionStatus> {
  const policies = await prisma.dataRetentionPolicy.findMany({
    orderBy: { entityType: 'asc' },
  });

  const mapped = policies.map((p) => ({
    id: p.id,
    name: p.name,
    entityType: p.entityType,
    retentionDays: p.retentionDays,
    action: p.action,
    isActive: p.isActive,
    lastRunAt: p.lastRunAt,
    nextRunAt: p.lastRunAt
      ? new Date(p.lastRunAt.getTime() + 24 * 60 * 60 * 1000) // Daily runs
      : null,
  }));

  return {
    policies: mapped,
    totalActive: mapped.filter((p) => p.isActive).length,
  };
}
