/**
 * ADMIN AUDIT LOGGING
 *
 * Logs all admin actions with before/after state for compliance.
 * Stores in the existing AuditLog Prisma model.
 *
 * The AuditLog model has:
 *   id, userId, action, entityType, entityId, details (JSON string), ipAddress, userAgent, createdAt
 *
 * We use the `details` field to store a JSON object with:
 *   { previousValue, newValue, metadata }
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminAuditParams {
  /** ID of the admin performing the action */
  adminUserId: string;
  /** Action performed (e.g., 'UPDATE_ORDER_STATUS', 'DELETE_USER') */
  action: string;
  /** Type of entity being acted on (e.g., 'Order', 'User', 'Product') */
  targetType: string;
  /** ID of the entity being acted on */
  targetId: string;
  /** State before the action (optional) */
  previousValue?: unknown;
  /** State after the action (optional) */
  newValue?: unknown;
  /** IP address of the admin */
  ipAddress?: string;
  /** User agent of the admin */
  userAgent?: string;
  /** Extra metadata */
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: {
    previousValue?: unknown;
    newValue?: unknown;
    metadata?: Record<string, unknown>;
  } | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogFilter {
  action?: string;
  targetType?: string;
  adminUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginatedAuditLogs {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Log an admin action to the AuditLog table.
 * This should be called from admin API routes after performing actions.
 */
export async function logAdminAction(params: AdminAuditParams): Promise<void> {
  const {
    adminUserId,
    action,
    targetType,
    targetId,
    previousValue,
    newValue,
    ipAddress,
    userAgent,
    metadata,
  } = params;

  try {
    const details: Record<string, unknown> = {};
    if (previousValue !== undefined) details.previousValue = previousValue;
    if (newValue !== undefined) details.newValue = newValue;
    if (metadata) details.metadata = metadata;

    const id = generateAuditId();

    await prisma.auditLog.create({
      data: {
        id,
        userId: adminUserId,
        action,
        entityType: targetType,
        entityId: targetId,
        details: Object.keys(details).length > 0 ? JSON.stringify(details) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    logger.info('[admin-audit] Action logged', {
      auditId: id,
      adminUserId,
      action,
      targetType,
      targetId,
    });
  } catch (error) {
    // Audit logging should never break the main flow
    logger.error('[admin-audit] Failed to log action', {
      error: error instanceof Error ? error.message : String(error),
      adminUserId,
      action,
      targetType,
      targetId,
    });
  }
}

// ---------------------------------------------------------------------------
// Query function
// ---------------------------------------------------------------------------

/**
 * Query audit logs with filters and pagination.
 * Used by the admin audit log API endpoint.
 */
export async function queryAuditLogs(
  filters: AuditLogFilter,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedAuditLogs> {
  const where: Record<string, unknown> = {};

  if (filters.action) {
    where.action = filters.action;
  }
  if (filters.targetType) {
    where.entityType = filters.targetType;
  }
  if (filters.adminUserId) {
    where.userId = filters.adminUserId;
  }
  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
    if (filters.dateTo) dateFilter.lte = filters.dateTo;
    where.createdAt = dateFilter;
  }

  const [total, rawEntries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const entries: AuditLogEntry[] = rawEntries.map((entry) => ({
    id: entry.id,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    details: parseDetails(entry.details),
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    createdAt: entry.createdAt,
  }));

  return {
    entries,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `audit_${timestamp}_${random}`;
}

function parseDetails(details: string | null): AuditLogEntry['details'] {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper to extract IP from Next.js request
// ---------------------------------------------------------------------------

export function getClientIpFromRequest(request: Request): string {
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}
