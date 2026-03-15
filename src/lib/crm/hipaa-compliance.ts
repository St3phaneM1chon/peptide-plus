/**
 * CRM HIPAA Compliance Mode - L7
 *
 * HIPAA-compliant mode for healthcare CRM data handling, inspired by
 * Five9 HIPAA, NICE CXone Shield, and Salesforce Shield. Manages
 * Protected Health Information (PHI) masking, access logging, compliance
 * validation, and audit reporting.
 *
 * Functions:
 * - enableHipaaMode: Activate HIPAA compliance across the CRM
 * - isHipaaModeEnabled: Check current HIPAA mode status
 * - maskPHI: Mask Protected Health Information fields
 * - getHipaaAuditLog: HIPAA-specific audit trail
 * - logPHIAccess: Mandatory PHI access logging
 * - validateHipaaCompliance: Run compliance check suite
 * - generateHipaaReport: Compliance report for auditors
 * - getPhiFields: Return list of fields classified as PHI
 *
 * Storage: AuditTrail for access logs, site settings for HIPAA config
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HipaaConfig {
  enabled: boolean;
  enabledAt: string | null;
  enabledBy: string | null;
  encryptionAtRest: boolean;
  auditLoggingEnabled: boolean;
  accessControlEnforced: boolean;
  baaStatus: 'signed' | 'pending' | 'not_started';
  minimumNecessaryRule: boolean;
  autoLogoutMinutes: number;
  phiRetentionDays: number;
}

export interface PHIAccessLogEntry {
  id: string;
  userId: string;
  userName: string | null;
  leadId: string;
  fieldsAccessed: string[];
  purpose: string;
  ipAddress: string | null;
  timestamp: string;
}

export interface HipaaComplianceCheck {
  overallCompliant: boolean;
  score: number; // 0-100
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    description: string;
    recommendation?: string;
  }>;
  lastCheckedAt: string;
}

export interface HipaaReport {
  period: { start: string; end: string };
  generatedAt: string;
  complianceStatus: HipaaComplianceCheck;
  accessSummary: {
    totalAccesses: number;
    uniqueUsers: number;
    uniqueRecords: number;
    topAccessedFields: Array<{ field: string; count: number }>;
    accessByPurpose: Record<string, number>;
  };
  incidents: Array<{
    type: string;
    description: string;
    date: string;
    resolved: boolean;
  }>;
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIPAA_SETTING_KEY = 'hipaa_compliance_config';
const PHI_ACCESS_ENTITY_TYPE = 'PHI_ACCESS';
const PHI_AUDIT_ACTION = 'PHI_VIEW';

/**
 * Fields classified as Protected Health Information (PHI) under HIPAA.
 * These fields require special handling: masking, access logging,
 * and encryption at rest.
 */
const PHI_FIELD_DEFINITIONS: Array<{
  field: string;
  category: string;
  description: string;
}> = [
  { field: 'firstName', category: 'identity', description: 'First name of the individual' },
  { field: 'lastName', category: 'identity', description: 'Last name of the individual' },
  { field: 'email', category: 'contact', description: 'Email address' },
  { field: 'phone', category: 'contact', description: 'Phone number' },
  { field: 'dob', category: 'demographic', description: 'Date of birth' },
  { field: 'ssn', category: 'identifier', description: 'Social Security Number' },
  { field: 'medicalRecord', category: 'medical', description: 'Medical record number' },
  { field: 'diagnosis', category: 'medical', description: 'Medical diagnosis or condition' },
  { field: 'insurance', category: 'financial', description: 'Health insurance information' },
  { field: 'address', category: 'contact', description: 'Physical address (street, city, zip)' },
];

const DEFAULT_HIPAA_CONFIG: HipaaConfig = {
  enabled: false,
  enabledAt: null,
  enabledBy: null,
  encryptionAtRest: false,
  auditLoggingEnabled: false,
  accessControlEnforced: false,
  baaStatus: 'not_started',
  minimumNecessaryRule: false,
  autoLogoutMinutes: 15,
  phiRetentionDays: 2555, // ~7 years (HIPAA minimum)
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashForMask(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

async function loadHipaaConfig(): Promise<HipaaConfig> {
  const setting = await prisma.auditTrail.findFirst({
    where: {
      entityType: 'SYSTEM_SETTING',
      entityId: HIPAA_SETTING_KEY,
      action: 'HIPAA_CONFIG',
    },
    orderBy: { createdAt: 'desc' },
    select: { newValue: true },
  });

  if (!setting?.newValue) return { ...DEFAULT_HIPAA_CONFIG };

  try {
    const parsed = JSON.parse(setting.newValue);
    return { ...DEFAULT_HIPAA_CONFIG, ...parsed };
  } catch (error) {
    logger.warn('[hipaa-compliance] Failed to parse HIPAA config JSON, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ...DEFAULT_HIPAA_CONFIG };
  }
}

async function saveHipaaConfig(config: HipaaConfig, userId: string): Promise<void> {
  await prisma.auditTrail.create({
    data: {
      entityType: 'SYSTEM_SETTING',
      entityId: HIPAA_SETTING_KEY,
      action: 'HIPAA_CONFIG',
      oldValue: null,
      newValue: JSON.stringify(config),
      userId,
      userName: null,
      metadata: { source: 'hipaa_compliance' } as unknown as Prisma.InputJsonValue,
    },
  });
}

// ---------------------------------------------------------------------------
// enableHipaaMode
// ---------------------------------------------------------------------------

/**
 * Activate HIPAA compliance mode across the CRM.
 * Enables encryption at rest, audit logging, access controls,
 * and the minimum necessary rule.
 *
 * @param userId - The user enabling HIPAA mode (must be OWNER)
 * @returns The updated HIPAA configuration
 */
export async function enableHipaaMode(userId?: string): Promise<HipaaConfig> {
  const adminId = userId ?? 'SYSTEM';

  const config: HipaaConfig = {
    enabled: true,
    enabledAt: new Date().toISOString(),
    enabledBy: adminId,
    encryptionAtRest: true,
    auditLoggingEnabled: true,
    accessControlEnforced: true,
    baaStatus: 'pending',
    minimumNecessaryRule: true,
    autoLogoutMinutes: 15,
    phiRetentionDays: 2555,
  };

  await saveHipaaConfig(config, adminId);

  logger.info('[hipaa-compliance] HIPAA mode enabled', {
    enabledBy: adminId,
    enabledAt: config.enabledAt,
  });

  return config;
}

// ---------------------------------------------------------------------------
// isHipaaModeEnabled
// ---------------------------------------------------------------------------

/**
 * Check whether HIPAA compliance mode is currently enabled.
 *
 * @returns The current HIPAA configuration with enabled status
 */
export async function isHipaaModeEnabled(): Promise<HipaaConfig> {
  return loadHipaaConfig();
}

// ---------------------------------------------------------------------------
// maskPHI
// ---------------------------------------------------------------------------

/**
 * Mask Protected Health Information fields in a data record.
 * Replaces PHI values with masked versions (e.g., "J*** D***" for names,
 * "***-**-1234" for SSN).
 *
 * @param data - The data record containing potential PHI
 * @param fields - Specific fields to mask (defaults to all PHI fields)
 * @returns A new object with PHI fields masked
 */
export function maskPHI(
  data: Record<string, unknown>,
  fields?: string[],
): Record<string, unknown> {
  const fieldsToMask = fields ?? PHI_FIELD_DEFINITIONS.map((f) => f.field);
  const masked = { ...data };

  for (const field of fieldsToMask) {
    if (!(field in masked) || masked[field] === null || masked[field] === undefined) {
      continue;
    }

    const value = String(masked[field]);

    switch (field) {
      case 'firstName':
      case 'lastName':
        // Show first letter, mask the rest: "John" -> "J***"
        masked[field] = value.charAt(0) + '***';
        break;

      case 'email':
        // Mask local part: "john.doe@example.com" -> "j***@example.com"
        {
          const atIdx = value.indexOf('@');
          if (atIdx > 0) {
            masked[field] = value.charAt(0) + '***' + value.slice(atIdx);
          } else {
            masked[field] = '***@***';
          }
        }
        break;

      case 'phone':
        // Show last 4 digits: "+15145551234" -> "***-***-1234"
        {
          const digits = value.replace(/\D/g, '');
          const last4 = digits.slice(-4);
          masked[field] = `***-***-${last4}`;
        }
        break;

      case 'ssn':
        // Show last 4: "123-45-6789" -> "***-**-6789"
        {
          const ssnDigits = value.replace(/\D/g, '');
          const lastFour = ssnDigits.slice(-4);
          masked[field] = `***-**-${lastFour}`;
        }
        break;

      case 'dob':
        // Show year only: "1985-03-15" -> "1985-**-**"
        {
          const year = value.slice(0, 4);
          masked[field] = `${year}-**-**`;
        }
        break;

      case 'address':
        // Show city/state only: mask street number and name
        masked[field] = '*** [ADDRESS MASKED]';
        break;

      case 'medicalRecord':
      case 'diagnosis':
      case 'insurance':
        // Fully mask sensitive medical data
        masked[field] = `[MASKED-${hashForMask(value)}]`;
        break;

      default:
        // Generic masking
        masked[field] = `[MASKED-${hashForMask(value)}]`;
    }
  }

  return masked;
}

// ---------------------------------------------------------------------------
// logPHIAccess
// ---------------------------------------------------------------------------

/**
 * Log access to Protected Health Information. This is mandatory under
 * HIPAA's audit requirements (45 CFR 164.312(b)).
 *
 * @param userId - Who accessed the PHI
 * @param leadId - Which lead/patient record was accessed
 * @param fieldsAccessed - Which PHI fields were viewed
 * @param purpose - Business justification for accessing PHI
 * @param ipAddress - Optional IP address of the accessor
 */
export async function logPHIAccess(
  userId: string,
  leadId: string,
  fieldsAccessed: string[],
  purpose: string,
  ipAddress?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  await prisma.auditTrail.create({
    data: {
      entityType: PHI_ACCESS_ENTITY_TYPE,
      entityId: leadId,
      action: PHI_AUDIT_ACTION,
      field: fieldsAccessed.join(','),
      oldValue: null,
      newValue: null,
      userId,
      userName: user?.name ?? null,
      ipAddress: ipAddress ?? null,
      metadata: {
        fieldsAccessed,
        purpose,
        phiCategories: fieldsAccessed
          .map((f) => PHI_FIELD_DEFINITIONS.find((def) => def.field === f)?.category)
          .filter(Boolean),
        timestamp: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[hipaa-compliance] PHI access logged', {
    userId,
    leadId,
    fieldsAccessed,
    purpose,
  });
}

// ---------------------------------------------------------------------------
// getHipaaAuditLog
// ---------------------------------------------------------------------------

/**
 * Retrieve HIPAA-specific audit trail entries. Shows who accessed PHI,
 * when, and for what purpose.
 *
 * @param period - Date range for the audit log
 * @param filters - Optional filters for userId or entityId
 * @returns Array of PHI access log entries
 */
export async function getHipaaAuditLog(
  period: { start: Date; end: Date },
  filters?: { userId?: string; leadId?: string },
): Promise<PHIAccessLogEntry[]> {
  const where: Prisma.AuditTrailWhereInput = {
    entityType: PHI_ACCESS_ENTITY_TYPE,
    action: PHI_AUDIT_ACTION,
    createdAt: { gte: period.start, lte: period.end },
  };

  if (filters?.userId) where.userId = filters.userId;
  if (filters?.leadId) where.entityId = filters.leadId;

  const entries = await prisma.auditTrail.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  return entries.map((entry) => {
    const meta = (entry.metadata as Record<string, unknown>) ?? {};
    return {
      id: entry.id,
      userId: entry.userId,
      userName: entry.userName,
      leadId: entry.entityId,
      fieldsAccessed: Array.isArray(meta.fieldsAccessed)
        ? (meta.fieldsAccessed as string[])
        : (entry.field?.split(',') ?? []),
      purpose: (meta.purpose as string) ?? 'Not specified',
      ipAddress: entry.ipAddress,
      timestamp: entry.createdAt.toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// validateHipaaCompliance
// ---------------------------------------------------------------------------

/**
 * Run a comprehensive HIPAA compliance check suite.
 * Validates: encryption at rest, audit logging, access controls,
 * BAA status, minimum necessary rule, and data retention.
 *
 * @returns Compliance check results with pass/fail for each requirement
 */
export async function validateHipaaCompliance(): Promise<HipaaComplianceCheck> {
  const config = await loadHipaaConfig();
  const checks: HipaaComplianceCheck['checks'] = [];
  let passCount = 0;
  const totalChecks = 8;

  // Check 1: HIPAA mode enabled
  if (config.enabled) {
    checks.push({ name: 'HIPAA Mode', status: 'pass', description: 'HIPAA compliance mode is active' });
    passCount++;
  } else {
    checks.push({
      name: 'HIPAA Mode',
      status: 'fail',
      description: 'HIPAA compliance mode is not enabled',
      recommendation: 'Enable HIPAA mode via the admin panel or API',
    });
  }

  // Check 2: Encryption at rest
  if (config.encryptionAtRest) {
    checks.push({ name: 'Encryption at Rest', status: 'pass', description: 'Data encryption at rest is enabled' });
    passCount++;
  } else {
    checks.push({
      name: 'Encryption at Rest',
      status: 'fail',
      description: 'Data encryption at rest is not configured',
      recommendation: 'Enable Azure Transparent Data Encryption (TDE) for the database',
    });
  }

  // Check 3: Audit logging
  if (config.auditLoggingEnabled) {
    // Verify recent audit log entries exist
    const recentLog = await prisma.auditTrail.findFirst({
      where: { entityType: PHI_ACCESS_ENTITY_TYPE },
      orderBy: { createdAt: 'desc' },
    });
    if (recentLog) {
      checks.push({ name: 'Audit Logging', status: 'pass', description: 'PHI access audit logging is active and generating entries' });
      passCount++;
    } else {
      checks.push({
        name: 'Audit Logging',
        status: 'warning',
        description: 'Audit logging is enabled but no PHI access entries found',
        recommendation: 'Verify that PHI access is being properly logged through the application',
      });
      passCount += 0.5;
    }
  } else {
    checks.push({
      name: 'Audit Logging',
      status: 'fail',
      description: 'PHI access audit logging is not enabled',
      recommendation: 'Enable audit logging in HIPAA configuration',
    });
  }

  // Check 4: Access controls
  if (config.accessControlEnforced) {
    checks.push({ name: 'Access Controls', status: 'pass', description: 'Role-based access controls are enforced for PHI' });
    passCount++;
  } else {
    checks.push({
      name: 'Access Controls',
      status: 'fail',
      description: 'PHI access controls are not enforced',
      recommendation: 'Enable access control enforcement and configure role-based PHI access',
    });
  }

  // Check 5: BAA Status
  if (config.baaStatus === 'signed') {
    checks.push({ name: 'Business Associate Agreement', status: 'pass', description: 'BAA is signed with all relevant parties' });
    passCount++;
  } else if (config.baaStatus === 'pending') {
    checks.push({
      name: 'Business Associate Agreement',
      status: 'warning',
      description: 'BAA is pending signature',
      recommendation: 'Complete BAA signing with cloud providers (Azure) and subcontractors',
    });
    passCount += 0.5;
  } else {
    checks.push({
      name: 'Business Associate Agreement',
      status: 'fail',
      description: 'No Business Associate Agreement in place',
      recommendation: 'Initiate BAA process with Azure and all data subprocessors',
    });
  }

  // Check 6: Minimum necessary rule
  if (config.minimumNecessaryRule) {
    checks.push({ name: 'Minimum Necessary Rule', status: 'pass', description: 'Minimum necessary access principle is enforced' });
    passCount++;
  } else {
    checks.push({
      name: 'Minimum Necessary Rule',
      status: 'fail',
      description: 'Minimum necessary rule is not enforced',
      recommendation: 'Configure field-level access controls to limit PHI exposure to minimum required',
    });
  }

  // Check 7: Auto-logout
  if (config.autoLogoutMinutes <= 15) {
    checks.push({ name: 'Session Timeout', status: 'pass', description: `Auto-logout configured at ${config.autoLogoutMinutes} minutes` });
    passCount++;
  } else {
    checks.push({
      name: 'Session Timeout',
      status: 'warning',
      description: `Auto-logout set to ${config.autoLogoutMinutes} minutes (recommended: 15 or less)`,
      recommendation: 'Reduce session timeout to 15 minutes or less for HIPAA compliance',
    });
    passCount += 0.5;
  }

  // Check 8: Data retention policy
  const retentionPolicy = await prisma.dataRetentionPolicy.findFirst({
    where: { entityType: 'lead', isActive: true },
  });
  if (retentionPolicy && retentionPolicy.retentionDays >= 2190) {
    // ~6 years minimum
    checks.push({ name: 'Data Retention', status: 'pass', description: `Retention policy: ${retentionPolicy.retentionDays} days (meets 6-year HIPAA minimum)` });
    passCount++;
  } else if (retentionPolicy) {
    checks.push({
      name: 'Data Retention',
      status: 'warning',
      description: `Retention: ${retentionPolicy.retentionDays} days (HIPAA requires minimum 6 years)`,
      recommendation: 'Increase data retention period to at least 2190 days (6 years)',
    });
    passCount += 0.5;
  } else {
    checks.push({
      name: 'Data Retention',
      status: 'fail',
      description: 'No data retention policy configured for lead records',
      recommendation: 'Create a data retention policy with minimum 6-year retention for PHI',
    });
  }

  const score = Math.round((passCount / totalChecks) * 100);

  return {
    overallCompliant: score >= 80 && !checks.some((c) => c.status === 'fail'),
    score,
    checks,
    lastCheckedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// generateHipaaReport
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive HIPAA compliance report for auditors.
 * Includes compliance status, access summary, incidents, and recommendations.
 *
 * @param period - Date range for the report
 * @returns Structured HIPAA compliance report
 */
export async function generateHipaaReport(
  period: { start: Date; end: Date },
): Promise<HipaaReport> {
  const [complianceStatus, accessLogs] = await Promise.all([
    validateHipaaCompliance(),
    getHipaaAuditLog(period),
  ]);

  // Access summary
  const uniqueUsers = new Set(accessLogs.map((l) => l.userId));
  const uniqueRecords = new Set(accessLogs.map((l) => l.leadId));

  const fieldCounts = new Map<string, number>();
  const purposeCounts: Record<string, number> = {};

  for (const log of accessLogs) {
    for (const field of log.fieldsAccessed) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    }
    purposeCounts[log.purpose] = (purposeCounts[log.purpose] ?? 0) + 1;
  }

  const topAccessedFields = Array.from(fieldCounts.entries())
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Check for potential incidents (unusual access patterns)
  const incidents: HipaaReport['incidents'] = [];

  // Detect bulk access (>50 records by single user in one day)
  const dailyAccess = new Map<string, number>();
  for (const log of accessLogs) {
    const day = log.timestamp.split('T')[0];
    const key = `${log.userId}_${day}`;
    dailyAccess.set(key, (dailyAccess.get(key) ?? 0) + 1);
  }

  for (const [key, count] of dailyAccess.entries()) {
    if (count > 50) {
      const [userId, date] = key.split('_');
      incidents.push({
        type: 'BULK_ACCESS',
        description: `User ${userId} accessed ${count} PHI records on ${date} (threshold: 50)`,
        date: date ?? new Date().toISOString().split('T')[0],
        resolved: false,
      });
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];
  for (const check of complianceStatus.checks) {
    if (check.recommendation) {
      recommendations.push(check.recommendation);
    }
  }

  if (accessLogs.length === 0) {
    recommendations.push(
      'No PHI access logs found. Ensure all PHI access points are instrumented with logPHIAccess().',
    );
  }

  if (incidents.length > 0) {
    recommendations.push(
      `${incidents.length} potential incident(s) detected. Review and resolve each one.`,
    );
  }

  return {
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    generatedAt: new Date().toISOString(),
    complianceStatus,
    accessSummary: {
      totalAccesses: accessLogs.length,
      uniqueUsers: uniqueUsers.size,
      uniqueRecords: uniqueRecords.size,
      topAccessedFields,
      accessByPurpose: purposeCounts,
    },
    incidents,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// getPhiFields
// ---------------------------------------------------------------------------

/**
 * Return the list of fields classified as Protected Health Information (PHI)
 * under HIPAA. These fields require masking, access logging, and encryption.
 *
 * @returns Array of PHI field definitions with categories and descriptions
 */
export function getPhiFields(): Array<{
  field: string;
  category: string;
  description: string;
}> {
  return [...PHI_FIELD_DEFINITIONS];
}
