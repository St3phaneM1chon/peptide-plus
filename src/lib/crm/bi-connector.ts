/**
 * BI Connector Service (J14 - PowerBI / Tableau Connector)
 * Export API for BI tools (PowerBI, Tableau, Looker, etc.).
 * Provides dataset export in CSV/JSON/Parquet options,
 * OData-compatible endpoints, scheduled exports, and data dictionary.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportableDataset {
  name: string;
  displayName: string;
  description: string;
  model: string;
  recordCount?: number;
  fields: DatasetField[];
}

export interface DatasetField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json';
  nullable: boolean;
  description: string;
}

export type ExportFormat = 'csv' | 'json' | 'parquet';

export interface ExportFilters {
  dateRange?: { start: string; end: string };
  fields?: string[];
  limit?: number;
  offset?: number;
}

export interface ExportResult {
  id: string;
  dataset: string;
  format: ExportFormat;
  recordCount: number;
  data: string; // CSV string or JSON string
  sizeBytes: number;
  exportedAt: string;
  exportedBy?: string;
}

export interface ExportHistoryEntry {
  id: string;
  dataset: string;
  format: ExportFormat;
  recordCount: number;
  sizeBytes: number;
  exportedAt: string;
  exportedBy: string | null;
  filters: ExportFilters | null;
}

export interface ScheduledExportConfig {
  id: string;
  dataset: string;
  format: ExportFormat;
  schedule: string; // cron expression
  destination: 'email' | 'webhook' | 'storage';
  destinationConfig: Record<string, unknown>;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface ODataEndpoint {
  url: string;
  dataset: string;
  entitySet: string;
  metadataUrl: string;
}

// ---------------------------------------------------------------------------
// Dataset Registry
// ---------------------------------------------------------------------------

const DATASET_DEFINITIONS: Omit<ExportableDataset, 'recordCount'>[] = [
  {
    name: 'leads',
    displayName: 'CRM Leads',
    description: 'All leads in the CRM pipeline',
    model: 'crmLead',
    fields: [
      { name: 'id', type: 'string', nullable: false, description: 'Unique lead identifier' },
      { name: 'contactName', type: 'string', nullable: false, description: 'Contact name' },
      { name: 'email', type: 'string', nullable: true, description: 'Email address' },
      { name: 'phone', type: 'string', nullable: true, description: 'Phone number' },
      { name: 'companyName', type: 'string', nullable: true, description: 'Company name' },
      { name: 'status', type: 'string', nullable: false, description: 'Lead status' },
      { name: 'source', type: 'string', nullable: true, description: 'Lead source' },
      { name: 'score', type: 'number', nullable: true, description: 'Lead score' },
      { name: 'createdAt', type: 'date', nullable: false, description: 'Creation date' },
      { name: 'updatedAt', type: 'date', nullable: false, description: 'Last update date' },
    ],
  },
  {
    name: 'deals',
    displayName: 'CRM Deals',
    description: 'All deals in the pipeline',
    model: 'crmDeal',
    fields: [
      { name: 'id', type: 'string', nullable: false, description: 'Unique deal identifier' },
      { name: 'title', type: 'string', nullable: false, description: 'Deal title' },
      { name: 'value', type: 'number', nullable: false, description: 'Deal value' },
      { name: 'currency', type: 'string', nullable: false, description: 'Currency code' },
      { name: 'stageId', type: 'string', nullable: false, description: 'Pipeline stage ID' },
      { name: 'expectedCloseDate', type: 'date', nullable: true, description: 'Expected close date' },
      { name: 'actualCloseDate', type: 'date', nullable: true, description: 'Actual close date' },
      { name: 'createdAt', type: 'date', nullable: false, description: 'Creation date' },
      { name: 'updatedAt', type: 'date', nullable: false, description: 'Last update date' },
    ],
  },
  {
    name: 'activities',
    displayName: 'CRM Activities',
    description: 'All CRM activities (calls, emails, meetings, tasks)',
    model: 'crmActivity',
    fields: [
      { name: 'id', type: 'string', nullable: false, description: 'Activity ID' },
      { name: 'type', type: 'string', nullable: false, description: 'Activity type' },
      { name: 'title', type: 'string', nullable: false, description: 'Activity title' },
      { name: 'description', type: 'string', nullable: true, description: 'Activity description' },
      { name: 'performedById', type: 'string', nullable: true, description: 'User who performed it' },
      { name: 'leadId', type: 'string', nullable: true, description: 'Related lead ID' },
      { name: 'dealId', type: 'string', nullable: true, description: 'Related deal ID' },
      { name: 'createdAt', type: 'date', nullable: false, description: 'Creation date' },
    ],
  },
  {
    name: 'campaigns',
    displayName: 'Marketing Campaigns',
    description: 'Email and SMS marketing campaigns',
    model: 'crmCampaign',
    fields: [
      { name: 'id', type: 'string', nullable: false, description: 'Campaign ID' },
      { name: 'name', type: 'string', nullable: false, description: 'Campaign name' },
      { name: 'type', type: 'string', nullable: false, description: 'Campaign type' },
      { name: 'status', type: 'string', nullable: false, description: 'Campaign status' },
      { name: 'sentCount', type: 'number', nullable: true, description: 'Total sent' },
      { name: 'openCount', type: 'number', nullable: true, description: 'Total opened' },
      { name: 'clickCount', type: 'number', nullable: true, description: 'Total clicked' },
      { name: 'createdAt', type: 'date', nullable: false, description: 'Creation date' },
    ],
  },
  {
    name: 'tickets',
    displayName: 'Support Tickets',
    description: 'Customer support tickets',
    model: 'crmTicket',
    fields: [
      { name: 'id', type: 'string', nullable: false, description: 'Ticket ID' },
      { name: 'subject', type: 'string', nullable: false, description: 'Ticket subject' },
      { name: 'status', type: 'string', nullable: false, description: 'Ticket status' },
      { name: 'priority', type: 'string', nullable: false, description: 'Ticket priority' },
      { name: 'assignedToId', type: 'string', nullable: true, description: 'Assigned agent ID' },
      { name: 'contactId', type: 'string', nullable: true, description: 'Contact ID' },
      { name: 'createdAt', type: 'date', nullable: false, description: 'Creation date' },
      { name: 'resolvedAt', type: 'date', nullable: true, description: 'Resolution date' },
    ],
  },
  {
    name: 'orders',
    displayName: 'Orders',
    description: 'E-commerce orders',
    model: 'order',
    fields: [
      { name: 'id', type: 'string', nullable: false, description: 'Order ID' },
      { name: 'orderNumber', type: 'string', nullable: false, description: 'Order number' },
      { name: 'status', type: 'string', nullable: false, description: 'Order status' },
      { name: 'total', type: 'number', nullable: false, description: 'Order total' },
      { name: 'userId', type: 'string', nullable: false, description: 'Customer ID' },
      { name: 'createdAt', type: 'date', nullable: false, description: 'Creation date' },
    ],
  },
  {
    name: 'customers',
    displayName: 'Customers',
    description: 'Customer user accounts',
    model: 'user',
    fields: [
      { name: 'id', type: 'string', nullable: false, description: 'User ID' },
      { name: 'name', type: 'string', nullable: true, description: 'Full name' },
      { name: 'email', type: 'string', nullable: false, description: 'Email address' },
      { name: 'role', type: 'string', nullable: false, description: 'User role' },
      { name: 'createdAt', type: 'date', nullable: false, description: 'Registration date' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * List all available datasets with record counts.
 */
export async function getExportableDatasets(): Promise<ExportableDataset[]> {
  const datasets: ExportableDataset[] = [];

  for (const def of DATASET_DEFINITIONS) {
    let recordCount = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (prisma as any)[def.model];
      if (model) {
        recordCount = await model.count();
      }
    } catch {
      // Model might not exist in schema
    }

    datasets.push({ ...def, recordCount });
  }

  return datasets;
}

/**
 * Export a dataset in the requested format with optional filters.
 */
export async function exportDataset(
  dataset: string,
  format: ExportFormat,
  filters?: ExportFilters,
  exportedBy?: string,
): Promise<ExportResult> {
  const definition = DATASET_DEFINITIONS.find((d) => d.name === dataset);
  if (!definition) {
    throw new Error(`Dataset "${dataset}" not found. Available: ${DATASET_DEFINITIONS.map((d) => d.name).join(', ')}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[definition.model];
  if (!model) {
    throw new Error(`Prisma model "${definition.model}" not found`);
  }

  // Build query
  const where: Record<string, unknown> = {};
  if (filters?.dateRange) {
    where.createdAt = {
      gte: new Date(filters.dateRange.start),
      lte: new Date(filters.dateRange.end),
    };
  }

  // Select only requested fields
  const requestedFields = filters?.fields || definition.fields.map((f) => f.name);
  const select: Record<string, boolean> = {};
  for (const field of requestedFields) {
    if (definition.fields.some((f) => f.name === field)) {
      select[field] = true;
    }
  }

  const records = await model.findMany({
    where,
    select: Object.keys(select).length > 0 ? select : undefined,
    take: filters?.limit || 10000,
    skip: filters?.offset || 0,
    orderBy: { createdAt: 'desc' },
  });

  const exportId = `export-${dataset}-${Date.now()}`;
  let data: string;

  if (format === 'csv') {
    data = convertToCSV(records, requestedFields);
  } else if (format === 'json') {
    data = JSON.stringify(records, null, 2);
  } else {
    // Parquet: return JSON with a note that Parquet conversion should happen client-side
    data = JSON.stringify({ format: 'parquet_placeholder', records }, null, 2);
    logger.warn('[BIConnector] Parquet format requested; returning JSON placeholder. Use a Parquet library for conversion.');
  }

  const sizeBytes = Buffer.byteLength(data, 'utf-8');

  // Log export to activity for audit trail
  await prisma.crmActivity.create({
    data: {
      type: 'NOTE',
      title: `BI Export: ${definition.displayName}`,
      description: `Exported ${records.length} records as ${format.toUpperCase()} (${formatBytes(sizeBytes)})`,
      performedById: exportedBy || undefined,
      metadata: {
        source: 'data_export',
        exportId,
        dataset,
        format,
        recordCount: records.length,
        sizeBytes,
        filters: filters || null,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[BIConnector] Dataset exported', { dataset, format, records: records.length, sizeBytes });

  return {
    id: exportId,
    dataset,
    format,
    recordCount: records.length,
    data,
    sizeBytes,
    exportedAt: new Date().toISOString(),
    exportedBy,
  };
}

/**
 * Generate an OData-compatible endpoint URL for PowerBI direct connect.
 */
export function generateODataEndpoint(dataset: string): ODataEndpoint {
  const definition = DATASET_DEFINITIONS.find((d) => d.name === dataset);
  if (!definition) {
    throw new Error(`Dataset "${dataset}" not found`);
  }

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';
  const entitySet = dataset.charAt(0).toUpperCase() + dataset.slice(1);

  return {
    url: `${baseUrl}/api/admin/crm/odata/${dataset}`,
    dataset,
    entitySet,
    metadataUrl: `${baseUrl}/api/admin/crm/odata/$metadata`,
  };
}

/**
 * Get history of recent exports.
 */
export async function getExportHistory(limit: number = 50): Promise<ExportHistoryEntry[]> {
  const activities = await prisma.crmActivity.findMany({
    where: {
      type: 'NOTE',
      metadata: {
        path: ['source'],
        equals: 'data_export',
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      performedBy: { select: { name: true, email: true } },
    },
  });

  return activities.map((a) => {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    return {
      id: (meta.exportId as string) || a.id,
      dataset: (meta.dataset as string) || 'unknown',
      format: (meta.format as ExportFormat) || 'json',
      recordCount: (meta.recordCount as number) || 0,
      sizeBytes: (meta.sizeBytes as number) || 0,
      exportedAt: a.createdAt.toISOString(),
      exportedBy: a.performedBy?.name || a.performedBy?.email || null,
      filters: (meta.filters as ExportFilters) || null,
    };
  });
}

/**
 * Schedule a recurring data export.
 * Stores the configuration as a CrmScheduledReport record.
 */
export async function scheduleExport(config: {
  dataset: string;
  format: ExportFormat;
  schedule: string; // e.g., '0 8 * * 1' (every Monday at 8am)
  destination: 'email' | 'webhook' | 'storage';
  destinationConfig?: Record<string, unknown>;
  userId: string;
}): Promise<ScheduledExportConfig> {
  const definition = DATASET_DEFINITIONS.find((d) => d.name === config.dataset);
  if (!definition) {
    throw new Error(`Dataset "${config.dataset}" not found`);
  }

  const scheduleId = `scheduled-export-${config.dataset}-${Date.now()}`;

  // Store as a scheduled report
  await prisma.crmScheduledReport.create({
    data: {
      name: `BI Export: ${definition.displayName} (${config.format.toUpperCase()})`,
      reportType: 'custom',
      schedule: config.schedule,
      recipients: [],
      isActive: true,
      config: {
        dataset: config.dataset,
        format: config.format,
        destination: config.destination,
        destinationConfig: config.destinationConfig || {},
      } as unknown as Prisma.InputJsonValue,
      createdById: config.userId,
    },
  });

  logger.info('[BIConnector] Export scheduled', {
    scheduleId,
    dataset: config.dataset,
    schedule: config.schedule,
    destination: config.destination,
  });

  return {
    id: scheduleId,
    dataset: config.dataset,
    format: config.format,
    schedule: config.schedule,
    destination: config.destination,
    destinationConfig: config.destinationConfig || {},
    enabled: true,
    lastRunAt: null,
    nextRunAt: null,
  };
}

/**
 * Return field definitions for all exportable datasets.
 * Used by BI tools for schema mapping and auto-configuration.
 */
export function getDataDictionary(): Record<string, DatasetField[]> {
  const dictionary: Record<string, DatasetField[]> = {};

  for (const def of DATASET_DEFINITIONS) {
    dictionary[def.name] = def.fields;
  }

  return dictionary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function convertToCSV(records: Record<string, unknown>[], fields: string[]): string {
  if (records.length === 0) return '';

  const header = fields.join(',');

  const rows = records.map((record) =>
    fields
      .map((field) => {
        const val = record[field];
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'object') return escapeCsvField(JSON.stringify(val));
        const str = String(val);
        return escapeCsvField(str);
      })
      .join(','),
  );

  return [header, ...rows].join('\n');
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
