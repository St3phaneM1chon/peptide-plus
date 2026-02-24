/**
 * Audit Trail Service
 * Complete logging of all accounting changes for compliance
 */

// FIX (F043): Standardize import to use 'prisma' directly
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  entityNumber?: string;
  userId: string;
  userName: string;
  ipAddress?: string;
  userAgent?: string;
  changes: ChangeDetail[];
  metadata?: Record<string, unknown>;
}

export type AuditAction = 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'POST'
  | 'VOID'
  | 'APPROVE'
  | 'REJECT'
  | 'EXPORT'
  | 'IMPORT'
  | 'RECONCILE'
  | 'CLOSE_PERIOD'
  | 'REOPEN_PERIOD'
  | 'LOGIN'
  | 'LOGOUT';

export type EntityType =
  | 'JOURNAL_ENTRY'
  | 'CUSTOMER_INVOICE'
  | 'SUPPLIER_INVOICE'
  | 'BANK_TRANSACTION'
  | 'BANK_ACCOUNT'
  | 'CHART_OF_ACCOUNT'
  | 'TAX_REPORT'
  | 'BUDGET'
  | 'PERIOD'
  | 'SETTINGS'
  | 'USER'
  | 'RECONCILIATION';

export interface ChangeDetail {
  field: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'ADD' | 'MODIFY' | 'REMOVE';
}

/**
 * Log an audit entry to AuditLog table.
 *
 * FIX (F044): NOTE - This service has TWO logging systems:
 *   1. logAuditEntry() -> writes to AuditLog table (this function)
 *   2. logAuditTrail() -> writes to AuditTrail table (below)
 * Routes inconsistently use one or the other. The recommended approach is:
 *   - Use logAuditTrail() for all new code (it supports per-field tracking)
 *   - logAuditEntry() is kept for backward compatibility
 * TODO: Migrate all logAuditEntry() callers to logAuditTrail() and deprecate this.
 * @deprecated Use logAuditTrail() instead for new code
 */
export async function logAuditEntry(
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  userId: string,
  userName: string,
  changes: ChangeDetail[],
  options: {
    entityNumber?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`,
    timestamp: new Date(),
    action,
    entityType,
    entityId,
    entityNumber: options.entityNumber,
    userId,
    userName,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    changes,
    metadata: options.metadata,
  };

  // Save to database
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      details: JSON.stringify({
        entityNumber: options.entityNumber,
        changes,
        metadata: options.metadata,
      }),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    },
  });

  return entry;
}

/**
 * Compare two objects and generate change details
 */
export function generateChanges<T extends Record<string, unknown>>(
  oldObj: T | null,
  newObj: T | null,
  fieldLabels: Record<string, string> = {}
): ChangeDetail[] {
  const changes: ChangeDetail[] = [];

  if (!oldObj && newObj) {
    // Creation
    for (const [key, value] of Object.entries(newObj)) {
      if (value !== undefined && value !== null && !key.startsWith('_')) {
        changes.push({
          field: key,
          fieldLabel: fieldLabels[key] || key,
          oldValue: null,
          newValue: value,
          changeType: 'ADD',
        });
      }
    }
  } else if (oldObj && !newObj) {
    // Deletion
    for (const [key, value] of Object.entries(oldObj)) {
      if (value !== undefined && value !== null && !key.startsWith('_')) {
        changes.push({
          field: key,
          fieldLabel: fieldLabels[key] || key,
          oldValue: value,
          newValue: null,
          changeType: 'REMOVE',
        });
      }
    }
  } else if (oldObj && newObj) {
    // Modification
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    
    for (const key of allKeys) {
      if (key.startsWith('_') || key === 'updatedAt') continue;
      
      const oldValue = oldObj[key];
      const newValue = newObj[key];
      
      if (!deepEqual(oldValue, newValue)) {
        changes.push({
          field: key,
          fieldLabel: fieldLabels[key] || key,
          oldValue,
          newValue,
          changeType: oldValue === undefined || oldValue === null ? 'ADD' :
                      newValue === undefined || newValue === null ? 'REMOVE' : 'MODIFY',
        });
      }
    }
  }

  return changes;
}

/**
 * Deep equality check
 * FIX: F088 - Added explicit Array handling (element-by-element, order-sensitive)
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  // FIX: F088 - Handle arrays explicitly (order-sensitive comparison)
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => deepEqual(objA[key], objB[key]));
}

/**
 * Get audit history for an entity
 */
export async function getAuditHistory(
  entityType: EntityType,
  entityId: string,
  options: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<AuditEntry[]> {
  const { limit = 100, startDate, endDate } = options;

  const where: Record<string, unknown> = {
    entityType,
    entityId,
  };

  if (startDate || endDate) {
    const createdAt: Record<string, Date> = {};
    if (startDate) createdAt.gte = startDate;
    if (endDate) createdAt.lte = endDate;
    where.createdAt = createdAt;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // FIX (F045): Fetch real user names instead of hardcoding 'Utilisateur'
  const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))] as string[];
  const userMap = new Map<string, string>();

  if (userIds.length > 0) {
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });
      for (const user of users) {
        userMap.set(user.id, user.name || user.email || 'Utilisateur');
      }
    } catch (error) {
      console.error('[AuditTrail] Failed to fetch user names for audit log enrichment:', error);
    }
  }

  return logs.map(log => {
    const details = log.details ? JSON.parse(log.details as string) : {};
    return {
      id: log.id,
      timestamp: log.createdAt,
      action: log.action as AuditAction,
      entityType: log.entityType as EntityType,
      entityId: log.entityId || '',
      entityNumber: details.entityNumber,
      userId: log.userId || 'system',
      userName: log.userId ? (userMap.get(log.userId) || 'Utilisateur') : 'Système',
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      changes: details.changes || [],
      metadata: details.metadata,
    };
  });
}

/**
 * Generate audit report for a period
 */
export async function generateAuditReport(
  startDate: Date,
  endDate: Date,
  options: {
    entityTypes?: EntityType[];
    actions?: AuditAction[];
    userIds?: string[];
  } = {}
): Promise<{
  summary: {
    totalActions: number;
    byAction: Record<string, number>;
    byEntity: Record<string, number>;
    byUser: Record<string, number>;
  };
  entries: AuditEntry[];
}> {
  const where: Record<string, unknown> = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (options.entityTypes) {
    where.entityType = { in: options.entityTypes };
  }
  if (options.actions) {
    where.action = { in: options.actions };
  }
  if (options.userIds) {
    where.userId = { in: options.userIds };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Calculate summary
  const byAction: Record<string, number> = {};
  const byEntity: Record<string, number> = {};
  const byUser: Record<string, number> = {};

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    byEntity[log.entityType] = (byEntity[log.entityType] || 0) + 1;
    byUser[log.userId || 'unknown'] = (byUser[log.userId || 'unknown'] || 0) + 1;
  }

  // FIX (F045): Fetch real user names for audit report too
  const reportUserIds = [...new Set(logs.map(l => l.userId).filter(Boolean))] as string[];
  const reportUserMap = new Map<string, string>();
  if (reportUserIds.length > 0) {
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: reportUserIds } },
        select: { id: true, name: true, email: true },
      });
      for (const user of users) {
        reportUserMap.set(user.id, user.name || user.email || 'Utilisateur');
      }
    } catch (error) {
      console.error('[AuditTrail] Failed to fetch user names for report enrichment:', error);
    }
  }

  const entries = logs.map(log => {
    const details = log.details ? JSON.parse(log.details as string) : {};
    return {
      id: log.id,
      timestamp: log.createdAt,
      action: log.action as AuditAction,
      entityType: log.entityType as EntityType,
      entityId: log.entityId || '',
      entityNumber: details.entityNumber,
      userId: log.userId || 'system',
      userName: log.userId ? (reportUserMap.get(log.userId) || 'Utilisateur') : 'Système',
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      changes: details.changes || [],
      metadata: details.metadata,
    };
  });

  return {
    summary: {
      totalActions: logs.length,
      byAction,
      byEntity,
      byUser,
    },
    entries,
  };
}

/**
 * Export audit trail to CSV
 */
export function exportAuditToCSV(entries: AuditEntry[]): string {
  const headers = [
    'Date/Heure',
    'Action',
    'Type',
    'N° Document',
    'Utilisateur',
    'Adresse IP',
    'Modifications',
  ];

  const rows = entries.map(entry => [
    entry.timestamp.toISOString(),
    entry.action,
    entry.entityType,
    entry.entityNumber || entry.entityId,
    entry.userName,
    entry.ipAddress || '',
    entry.changes.map(c => `${c.fieldLabel}: ${c.oldValue} → ${c.newValue}`).join('; '),
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
}

/**
 * Get action label in French
 */
export function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    CREATE: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
    POST: 'Validation',
    VOID: 'Annulation',
    APPROVE: 'Approbation',
    REJECT: 'Rejet',
    EXPORT: 'Exportation',
    IMPORT: 'Importation',
    RECONCILE: 'Rapprochement',
    CLOSE_PERIOD: 'Clôture période',
    REOPEN_PERIOD: 'Réouverture période',
    LOGIN: 'Connexion',
    LOGOUT: 'Déconnexion',
  };
  return labels[action] || action;
}

/**
 * Get entity type label in French
 */
export function getEntityLabel(entityType: EntityType): string {
  const labels: Record<EntityType, string> = {
    JOURNAL_ENTRY: 'Écriture de journal',
    CUSTOMER_INVOICE: 'Facture client',
    SUPPLIER_INVOICE: 'Facture fournisseur',
    BANK_TRANSACTION: 'Transaction bancaire',
    BANK_ACCOUNT: 'Compte bancaire',
    CHART_OF_ACCOUNT: 'Plan comptable',
    TAX_REPORT: 'Déclaration fiscale',
    BUDGET: 'Budget',
    PERIOD: 'Période comptable',
    SETTINGS: 'Paramètres',
    USER: 'Utilisateur',
    RECONCILIATION: 'Rapprochement',
  };
  return labels[entityType] || entityType;
}


// =====================================================
// PHASE 4 COMPLIANCE: Granular AuditTrail logging
// Uses the new AuditTrail model for per-field change tracking
// =====================================================

interface AuditTrailInput {
  entityType: string;
  entityId: string;
  action: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  userId: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit trail entry. Fire-and-forget by default to avoid
 * slowing down the main operation.
 */
export async function logAuditTrail(entry: AuditTrailInput): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        field: entry.field || null,
        oldValue: entry.oldValue || null,
        newValue: entry.newValue || null,
        userId: entry.userId,
        userName: entry.userName || null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        metadata: entry.metadata ? (entry.metadata as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    // Audit logging must never break the main operation
    logger.error('Failed to log audit trail', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Log multiple field changes in a single batch (for updates).
 */
export async function logAuditTrailBatch(
  entityType: string,
  entityId: string,
  changes: Array<{ field: string; oldValue: string | null; newValue: string | null }>,
  userId: string,
  userName?: string
): Promise<void> {
  try {
    await prisma.auditTrail.createMany({
      data: changes.map((c) => ({
        entityType,
        entityId,
        action: 'UPDATE',
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        userId,
        userName: userName || null,
      })),
    });
  } catch (error) {
    logger.error('Failed to log audit trail batch', { error: error instanceof Error ? error.message : String(error) });
  }
}
