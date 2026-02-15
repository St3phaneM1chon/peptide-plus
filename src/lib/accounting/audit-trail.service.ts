/**
 * Audit Trail Service
 * Complete logging of all accounting changes for compliance
 */

import { db as prisma } from '@/lib/db';

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
 * Log an audit entry
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
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
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
      userName: 'Utilisateur', // Would fetch from user table
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
      userName: 'Utilisateur',
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
