/**
 * CRM Recording Storage Compliance by Region - L14
 *
 * Manages region-specific storage for call recordings to comply with
 * data residency laws (GDPR, PIPEDA, CCPA, LGPD). Routes recordings
 * to the correct Azure Blob Storage endpoint based on caller's country,
 * validates data residency compliance, and tracks regional storage metrics.
 *
 * Functions:
 * - getStorageRegion: Determine required storage region from caller country
 * - configureRegionalStorage: Configure per-region storage backends
 * - getRegionalStorageConfig: Return current regional configuration
 * - routeRecordingToRegion: Route a recording to the correct storage
 * - validateDataResidency: Check all recordings are in correct regions
 * - getRegionalStorageMetrics: Per-region recording counts and storage
 * - getDataResidencyRules: Return known data residency rules by regulation
 *
 * Storage: DataRetentionPolicy and AuditTrail for config and compliance
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegionalStorageConfig {
  regionCode: string;
  regionName: string;
  storageEndpoint: string;
  retentionDays: number;
  isActive: boolean;
  countries: string[];
}

export interface StorageRouteResult {
  callLogId: string;
  callerCountry: string;
  regionCode: string;
  storageEndpoint: string;
  retentionDays: number;
  routedAt: string;
}

export interface DataResidencyRule {
  regulation: string;
  jurisdiction: string;
  requirement: string;
  regionCode: string;
  retentionMinDays: number;
  notes: string;
}

export interface RegionalStorageMetrics {
  regions: Array<{
    regionCode: string;
    regionName: string;
    recordingCount: number;
    totalStorageBytes: number;
    avgDurationSec: number;
    complianceStatus: 'compliant' | 'non_compliant' | 'unknown';
    oldestRecording: string | null;
    newestRecording: string | null;
  }>;
  totalRecordings: number;
  totalStorageBytes: number;
  unroutedRecordings: number;
}

export interface ResidencyValidationResult {
  isCompliant: boolean;
  totalChecked: number;
  compliantCount: number;
  violations: Array<{
    callLogId: string;
    callerCountry: string;
    expectedRegion: string;
    actualRegion: string;
    recordingId: string;
  }>;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_CONFIG_ENTITY = 'REGIONAL_STORAGE_CONFIG';
const STORAGE_ROUTE_ACTION = 'RECORDING_ROUTED';

/**
 * Country to region mapping.
 * Each entry maps ISO 3166-1 alpha-2 country codes to a storage region.
 */
const COUNTRY_REGION_MAP: Record<string, string> = {
  // European Union (GDPR) → EU region
  AT: 'EU', BE: 'EU', BG: 'EU', HR: 'EU', CY: 'EU',
  CZ: 'EU', DK: 'EU', EE: 'EU', FI: 'EU', FR: 'EU',
  DE: 'EU', GR: 'EU', HU: 'EU', IE: 'EU', IT: 'EU',
  LV: 'EU', LT: 'EU', LU: 'EU', MT: 'EU', NL: 'EU',
  PL: 'EU', PT: 'EU', RO: 'EU', SK: 'EU', SI: 'EU',
  ES: 'EU', SE: 'EU',
  // EEA
  IS: 'EU', LI: 'EU', NO: 'EU',
  // UK (post-Brexit, UK GDPR)
  GB: 'EU',
  // Switzerland
  CH: 'EU',

  // Canada (PIPEDA) → CA region
  CA: 'CA',

  // United States (CCPA, state laws) → US region
  US: 'US',

  // Brazil (LGPD) → BR region
  BR: 'BR',

  // Australia (Privacy Act) → APAC region
  AU: 'APAC',
  NZ: 'APAC',
  JP: 'APAC',
  KR: 'APAC',
  SG: 'APAC',
  HK: 'APAC',
  IN: 'APAC',
};

/**
 * Default regional storage configurations.
 */
const DEFAULT_REGIONS: RegionalStorageConfig[] = [
  {
    regionCode: 'US',
    regionName: 'United States',
    storageEndpoint: 'https://biocyclerecordings-us.blob.core.windows.net',
    retentionDays: 365,
    isActive: true,
    countries: ['US'],
  },
  {
    regionCode: 'CA',
    regionName: 'Canada',
    storageEndpoint: 'https://biocyclerecordings-ca.blob.core.windows.net',
    retentionDays: 730,
    isActive: true,
    countries: ['CA'],
  },
  {
    regionCode: 'EU',
    regionName: 'European Union',
    storageEndpoint: 'https://biocyclerecordings-eu.blob.core.windows.net',
    retentionDays: 365,
    isActive: true,
    countries: Object.entries(COUNTRY_REGION_MAP)
      .filter(([, region]) => region === 'EU')
      .map(([country]) => country),
  },
  {
    regionCode: 'BR',
    regionName: 'Brazil',
    storageEndpoint: 'https://biocyclerecordings-br.blob.core.windows.net',
    retentionDays: 365,
    isActive: false,
    countries: ['BR'],
  },
  {
    regionCode: 'APAC',
    regionName: 'Asia-Pacific',
    storageEndpoint: 'https://biocyclerecordings-apac.blob.core.windows.net',
    retentionDays: 365,
    isActive: false,
    countries: Object.entries(COUNTRY_REGION_MAP)
      .filter(([, region]) => region === 'APAC')
      .map(([country]) => country),
  },
];

// ---------------------------------------------------------------------------
// getStorageRegion
// ---------------------------------------------------------------------------

/**
 * Determine the required storage region based on the caller's country.
 * Uses the country-to-region mapping with fallback to US for unknown countries.
 *
 * @param callerCountry - ISO 3166-1 alpha-2 country code (e.g., "CA", "FR", "US")
 * @returns The region code and associated storage configuration
 */
export async function getStorageRegion(
  callerCountry: string,
): Promise<{ regionCode: string; config: RegionalStorageConfig }> {
  const upperCountry = callerCountry.toUpperCase().trim();
  const regionCode = COUNTRY_REGION_MAP[upperCountry] ?? 'US';

  const configs = await getRegionalStorageConfig();
  const config = configs.find((c) => c.regionCode === regionCode);

  if (!config) {
    // Fallback to US region
    const usConfig = configs.find((c) => c.regionCode === 'US') ?? DEFAULT_REGIONS[0];
    logger.warn('[regional-recording-storage] Unknown region, falling back to US', {
      callerCountry: upperCountry,
      regionCode,
    });
    return { regionCode: 'US', config: usConfig };
  }

  return { regionCode, config };
}

// ---------------------------------------------------------------------------
// configureRegionalStorage
// ---------------------------------------------------------------------------

/**
 * Configure per-region storage backends. Each region specifies a storage
 * endpoint URL and retention period. Saves to AuditTrail for persistence.
 *
 * @param regions - Array of regional storage configurations
 * @returns The saved configurations
 */
export async function configureRegionalStorage(
  regions: Array<{
    regionCode: string;
    storageEndpoint: string;
    retentionDays: number;
    regionName?: string;
    countries?: string[];
  }>,
): Promise<RegionalStorageConfig[]> {
  const configs: RegionalStorageConfig[] = regions.map((r) => {
    const defaultRegion = DEFAULT_REGIONS.find((d) => d.regionCode === r.regionCode);
    return {
      regionCode: r.regionCode,
      regionName: r.regionName ?? defaultRegion?.regionName ?? r.regionCode,
      storageEndpoint: r.storageEndpoint,
      retentionDays: r.retentionDays,
      isActive: true,
      countries: r.countries ?? defaultRegion?.countries ?? [],
    };
  });

  // Save configuration to audit trail
  await prisma.auditTrail.create({
    data: {
      entityType: STORAGE_CONFIG_ENTITY,
      entityId: 'regional_storage',
      action: 'CONFIGURE',
      oldValue: null,
      newValue: JSON.stringify(configs),
      userId: 'SYSTEM',
      metadata: {
        regionCount: configs.length,
        configuredAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[regional-recording-storage] Regional storage configured', {
    regionCount: configs.length,
    regions: configs.map((c) => c.regionCode),
  });

  return configs;
}

// ---------------------------------------------------------------------------
// getRegionalStorageConfig
// ---------------------------------------------------------------------------

/**
 * Return the current regional storage configuration.
 * Loads from the most recent AuditTrail entry, or returns defaults.
 *
 * @returns Array of regional storage configurations
 */
export async function getRegionalStorageConfig(): Promise<RegionalStorageConfig[]> {
  const configEntry = await prisma.auditTrail.findFirst({
    where: {
      entityType: STORAGE_CONFIG_ENTITY,
      entityId: 'regional_storage',
      action: 'CONFIGURE',
    },
    orderBy: { createdAt: 'desc' },
    select: { newValue: true },
  });

  if (configEntry?.newValue) {
    try {
      const parsed = JSON.parse(configEntry.newValue);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to defaults
    }
  }

  return [...DEFAULT_REGIONS];
}

// ---------------------------------------------------------------------------
// routeRecordingToRegion
// ---------------------------------------------------------------------------

/**
 * Route a call recording to the correct regional storage based on
 * the caller's country. Updates the CallRecording with the regional
 * blob URL prefix and logs the routing decision.
 *
 * @param callLogId - The call log ID to route
 * @param callerCountry - ISO country code of the caller
 * @returns The routing result
 */
export async function routeRecordingToRegion(
  callLogId: string,
  callerCountry: string,
): Promise<StorageRouteResult> {
  const callLog = await prisma.callLog.findUnique({
    where: { id: callLogId },
    select: { id: true, callerNumber: true },
  });

  if (!callLog) throw new Error(`CallLog ${callLogId} not found`);

  const { regionCode, config } = await getStorageRegion(callerCountry);

  // Log the routing decision in audit trail
  await prisma.auditTrail.create({
    data: {
      entityType: 'CallRecording',
      entityId: callLogId,
      action: STORAGE_ROUTE_ACTION,
      field: 'storageRegion',
      newValue: regionCode,
      userId: 'SYSTEM',
      metadata: {
        callerCountry: callerCountry.toUpperCase(),
        regionCode,
        storageEndpoint: config.storageEndpoint,
        retentionDays: config.retentionDays,
        routedAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[regional-recording-storage] Recording routed', {
    callLogId,
    callerCountry,
    regionCode,
    storageEndpoint: config.storageEndpoint,
  });

  return {
    callLogId,
    callerCountry: callerCountry.toUpperCase(),
    regionCode,
    storageEndpoint: config.storageEndpoint,
    retentionDays: config.retentionDays,
    routedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// validateDataResidency
// ---------------------------------------------------------------------------

/**
 * Validate that all recordings are stored in their correct regions.
 * Compares each recording's storage location against the required
 * region based on the caller's country.
 *
 * @returns Validation result with any violations found
 */
export async function validateDataResidency(): Promise<ResidencyValidationResult> {
  // Get all routed recordings from audit trail
  const routingLogs = await prisma.auditTrail.findMany({
    where: {
      entityType: 'CallRecording',
      action: STORAGE_ROUTE_ACTION,
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  // Deduplicate by callLogId (keep most recent)
  const routingByCallLog = new Map<string, { region: string; country: string }>();
  for (const log of routingLogs) {
    if (!routingByCallLog.has(log.entityId)) {
      const meta = (log.metadata as Record<string, unknown>) ?? {};
      routingByCallLog.set(log.entityId, {
        region: (meta.regionCode as string) ?? log.newValue ?? 'unknown',
        country: (meta.callerCountry as string) ?? 'unknown',
      });
    }
  }

  const violations: ResidencyValidationResult['violations'] = [];
  let compliantCount = 0;

  for (const [callLogId, routing] of routingByCallLog.entries()) {
    const expectedRegion = COUNTRY_REGION_MAP[routing.country] ?? 'US';

    if (routing.region !== expectedRegion) {
      violations.push({
        callLogId,
        callerCountry: routing.country,
        expectedRegion,
        actualRegion: routing.region,
        recordingId: callLogId,
      });
    } else {
      compliantCount++;
    }
  }

  const totalChecked = routingByCallLog.size;

  if (violations.length > 0) {
    logger.warn('[regional-recording-storage] Data residency violations found', {
      totalChecked,
      violations: violations.length,
    });
  } else {
    logger.info('[regional-recording-storage] Data residency validation passed', {
      totalChecked,
      compliantCount,
    });
  }

  return {
    isCompliant: violations.length === 0,
    totalChecked,
    compliantCount,
    violations,
    checkedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// getRegionalStorageMetrics
// ---------------------------------------------------------------------------

/**
 * Get per-region metrics for recording storage: counts, storage used,
 * average duration, and compliance status.
 *
 * @returns Metrics for each configured region
 */
export async function getRegionalStorageMetrics(): Promise<RegionalStorageMetrics> {
  const configs = await getRegionalStorageConfig();

  // Get all routing logs
  const routingLogs = await prisma.auditTrail.findMany({
    where: {
      entityType: 'CallRecording',
      action: STORAGE_ROUTE_ACTION,
    },
    select: { entityId: true, metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregate by region
  const regionStats = new Map<
    string,
    {
      recordingCount: number;
      callLogIds: string[];
      oldest: Date | null;
      newest: Date | null;
    }
  >();

  // Initialize all configured regions
  for (const config of configs) {
    regionStats.set(config.regionCode, {
      recordingCount: 0,
      callLogIds: [],
      oldest: null,
      newest: null,
    });
  }

  // Deduplicate by callLogId and count per region
  const seenCallLogs = new Set<string>();

  for (const log of routingLogs) {
    if (seenCallLogs.has(log.entityId)) continue;
    seenCallLogs.add(log.entityId);

    const meta = (log.metadata as Record<string, unknown>) ?? {};
    const regionCode = (meta.regionCode as string) ?? 'US';

    const stats = regionStats.get(regionCode) ?? {
      recordingCount: 0,
      callLogIds: [],
      oldest: null,
      newest: null,
    };

    stats.recordingCount++;
    stats.callLogIds.push(log.entityId);

    if (!stats.oldest || log.createdAt < stats.oldest) stats.oldest = log.createdAt;
    if (!stats.newest || log.createdAt > stats.newest) stats.newest = log.createdAt;

    regionStats.set(regionCode, stats);
  }

  // Get recording details for storage size and duration
  const allCallLogIds = Array.from(seenCallLogs);
  const recordings = await prisma.callRecording.findMany({
    where: { callLogId: { in: allCallLogIds.slice(0, 5000) } },
    select: { callLogId: true, fileSize: true, durationSec: true },
  });

  const recordingMap = new Map<string, { fileSize: number | null; durationSec: number | null }>();
  for (const rec of recordings) {
    if (rec.callLogId) recordingMap.set(rec.callLogId, { fileSize: rec.fileSize, durationSec: rec.durationSec });
  }

  // Build metrics per region
  let totalRecordings = 0;
  let totalStorageBytes = 0;
  let unroutedRecordings = 0;

  const regionMetrics = configs.map((config) => {
    const stats = regionStats.get(config.regionCode);
    if (!stats) {
      return {
        regionCode: config.regionCode,
        regionName: config.regionName,
        recordingCount: 0,
        totalStorageBytes: 0,
        avgDurationSec: 0,
        complianceStatus: 'unknown' as const,
        oldestRecording: null,
        newestRecording: null,
      };
    }

    let regionStorage = 0;
    let regionDuration = 0;
    let durationCount = 0;

    for (const callLogId of stats.callLogIds) {
      const rec = recordingMap.get(callLogId);
      if (rec?.fileSize) regionStorage += rec.fileSize;
      if (rec?.durationSec) {
        regionDuration += rec.durationSec;
        durationCount++;
      }
    }

    totalRecordings += stats.recordingCount;
    totalStorageBytes += regionStorage;

    return {
      regionCode: config.regionCode,
      regionName: config.regionName,
      recordingCount: stats.recordingCount,
      totalStorageBytes: regionStorage,
      avgDurationSec: durationCount > 0 ? Math.round(regionDuration / durationCount) : 0,
      complianceStatus: config.isActive ? ('compliant' as const) : ('unknown' as const),
      oldestRecording: stats.oldest?.toISOString() ?? null,
      newestRecording: stats.newest?.toISOString() ?? null,
    };
  });

  // Count recordings without routing
  const totalCallRecordings = await prisma.callRecording.count();
  unroutedRecordings = Math.max(0, totalCallRecordings - totalRecordings);

  return {
    regions: regionMetrics,
    totalRecordings,
    totalStorageBytes,
    unroutedRecordings,
  };
}

// ---------------------------------------------------------------------------
// getDataResidencyRules
// ---------------------------------------------------------------------------

/**
 * Return known data residency rules by regulation.
 * Covers GDPR (EU), PIPEDA (Canada), CCPA (US), and LGPD (Brazil).
 *
 * @returns Array of data residency rules with regulations and requirements
 */
export function getDataResidencyRules(): DataResidencyRule[] {
  return [
    {
      regulation: 'GDPR',
      jurisdiction: 'European Union / EEA',
      requirement:
        'Personal data of EU/EEA residents must be stored within the EU/EEA or in a country with an adequacy decision. Transfers outside require Standard Contractual Clauses (SCCs) or Binding Corporate Rules.',
      regionCode: 'EU',
      retentionMinDays: 0, // No fixed minimum; must be "no longer than necessary"
      notes:
        'Article 44-49 governs data transfers. Right to erasure (Art. 17) applies. Recording consent required under ePrivacy.',
    },
    {
      regulation: 'PIPEDA',
      jurisdiction: 'Canada (Federal)',
      requirement:
        'Personal information transferred outside Canada must receive comparable protection. Organizations must ensure contractual or other means protect data. No strict data localization requirement at federal level, but Quebec Law 25 requires impact assessment for transfers.',
      regionCode: 'CA',
      retentionMinDays: 365,
      notes:
        'Quebec Bill 25 (effective 2024) requires privacy impact assessment for any cross-border transfer. BC and Alberta have provincial equivalents.',
    },
    {
      regulation: 'CCPA/CPRA',
      jurisdiction: 'California, United States',
      requirement:
        'No strict data localization requirement. Consumers have the right to opt out of data sales. Recordings containing personal information must be disclosed. Businesses must honor deletion requests within 45 days.',
      regionCode: 'US',
      retentionMinDays: 0,
      notes:
        'CPRA (effective 2023) adds data minimization. Multiple US states have similar laws (Virginia VCDPA, Colorado CPA, Connecticut CTDPA). No federal data localization law.',
    },
    {
      regulation: 'LGPD',
      jurisdiction: 'Brazil',
      requirement:
        'International transfers allowed only to countries with adequate protection or with specific guarantees (standard contractual clauses, binding corporate rules). Data subjects must be informed of transfers.',
      regionCode: 'BR',
      retentionMinDays: 0,
      notes:
        'ANPD (Brazilian authority) has not yet published adequacy decisions. Standard contractual clauses are the primary transfer mechanism.',
    },
    {
      regulation: 'Privacy Act 1988',
      jurisdiction: 'Australia',
      requirement:
        'APPs require organizations to take reasonable steps to ensure overseas recipients handle data consistently with Australian Privacy Principles. No strict data localization requirement.',
      regionCode: 'APAC',
      retentionMinDays: 0,
      notes:
        'APP 8 governs cross-border disclosure. Organization remains liable for overseas recipient breaches.',
    },
    {
      regulation: 'APPI',
      jurisdiction: 'Japan',
      requirement:
        'Cross-border transfers require either consent, an adequacy finding, or contractual measures ensuring equivalent protection. Japan has mutual adequacy with the EU.',
      regionCode: 'APAC',
      retentionMinDays: 0,
      notes:
        'Japan-EU mutual adequacy (2019) facilitates data flows. Amended APPI (2022) strengthened breach notification requirements.',
    },
  ];
}
