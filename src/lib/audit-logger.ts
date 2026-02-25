/**
 * Hash-Chained Audit Logger
 * Every admin action logged with SHA-256 chain for tamper evidence
 */

import { createHash } from 'crypto';

export interface AuditEntry {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  ipAddress?: string;
  userAgent?: string;
}

function computeHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function buildHashChain(
  entry: AuditEntry,
  previousHash: string | null
): { currentHash: string; previousHash: string | null } {
  const payload = JSON.stringify({
    ...entry,
    previousHash,
    timestamp: new Date().toISOString(),
  });
  const currentHash = computeHash(payload);
  return { currentHash, previousHash };
}

export function verifyChain(
  entries: Array<{ currentHash: string; previousHash: string | null }>
): { valid: boolean; brokenAt?: number } {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].previousHash !== entries[i - 1].currentHash) {
      return { valid: false, brokenAt: i };
    }
  }
  return { valid: true };
}

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN'
  | 'EXPORT' | 'IMPORT' | 'BULK_UPDATE'
  | 'SETTINGS_CHANGE' | 'PERMISSION_CHANGE'
  | 'REFUND' | 'VOID' | 'APPROVE' | 'REJECT';

export function formatAuditAction(action: string): string {
  const labels: Record<string, string> = {
    CREATE: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
    LOGIN: 'Connexion',
    LOGOUT: 'Déconnexion',
    FAILED_LOGIN: 'Tentative de connexion échouée',
    EXPORT: 'Export',
    IMPORT: 'Import',
    BULK_UPDATE: 'Mise à jour en lot',
    SETTINGS_CHANGE: 'Modification paramètres',
    PERMISSION_CHANGE: 'Modification permissions',
    REFUND: 'Remboursement',
    VOID: 'Annulation',
    APPROVE: 'Approbation',
    REJECT: 'Rejet',
  };
  return labels[action] || action;
}

export function formatEntityType(type: string): string {
  const labels: Record<string, string> = {
    product: 'Produit',
    order: 'Commande',
    user: 'Utilisateur',
    category: 'Catégorie',
    discount: 'Réduction',
    promo_code: 'Code promo',
    journal_entry: 'Écriture comptable',
    settings: 'Paramètres',
    permission: 'Permission',
    email: 'Email',
    page: 'Page',
    media: 'Média',
  };
  return labels[type] || type;
}
