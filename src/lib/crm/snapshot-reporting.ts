/**
 * Historical Snapshot Reporting (J21 - Snapshot Reporting)
 * Captures point-in-time snapshots of pipeline state, deal values,
 * and lead counts for historical comparison. Enables trend analysis
 * by comparing snapshots across different time periods.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SnapshotConfig {
  name: string;
  entities: string[]; // e.g., ['pipeline', 'leads', 'deals', 'revenue']
  description?: string;
}

export interface SnapshotData {
  pipeline?: {
    stages: { id: string; name: string; dealCount: number; totalValue: number; probability: number }[];
    totalDeals: number;
    totalValue: number;
    weightedValue: number;
  };
  leads?: {
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    newThisMonth: number;
    convertedThisMonth: number;
    avgScore: number;
  };
  deals?: {
    total: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    avgDealValue: number;
    avgDealAge: number;
    winRate: number;
  };
  revenue?: {
    monthlyRevenue: number;
    quarterlyRevenue: number;
    yearToDate: number;
    avgOrderValue: number;
    orderCount: number;
  };
  activities?: {
    total: number;
    byType: Record<string, number>;
    avgPerUser: number;
  };
  customers?: {
    total: number;
    newThisMonth: number;
    activeThisMonth: number;
  };
}

export interface Snapshot {
  id: string;
  name: string;
  description: string | null;
  entities: string[];
  data: SnapshotData;
  takenAt: string;
  takenBy: string | null;
  isAutomatic: boolean;
}

export interface SnapshotDiff {
  snapshotId1: string;
  snapshotId2: string;
  snapshot1Date: string;
  snapshot2Date: string;
  changes: {
    entity: string;
    field: string;
    oldValue: number;
    newValue: number;
    change: number;
    changePercent: number;
  }[];
  summary: {
    improved: number;
    declined: number;
    unchanged: number;
  };
}

export interface SnapshotTrendPoint {
  date: string;
  value: number;
  snapshotId: string;
}

export interface AutoSnapshotConfig {
  id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  entities: string[];
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Capture a snapshot of the current state of selected entities.
 */
export async function takeSnapshot(
  config: SnapshotConfig,
  userId?: string,
): Promise<Snapshot> {
  // N+1 FIX: Capture all entity states in parallel instead of sequentially
  // Each capture is independent and can run concurrently
  const entityCaptureFns: Record<string, () => Promise<unknown>> = {
    pipeline: capturePipelineState,
    leads: captureLeadState,
    deals: captureDealState,
    revenue: captureRevenueState,
    activities: captureActivityState,
    customers: captureCustomerState,
  };

  const validEntities = config.entities.filter(e => {
    if (!entityCaptureFns[e]) {
      logger.warn('[SnapshotReporting] Unknown entity for snapshot', { entity: e });
      return false;
    }
    return true;
  });

  const captureResults = await Promise.all(
    validEntities.map(async (entity) => {
      const result = await entityCaptureFns[entity]();
      return { entity, result };
    })
  );

  const data: SnapshotData = {};
  for (const { entity, result } of captureResults) {
    (data as Record<string, unknown>)[entity] = result;
  }

  // Store snapshot as CrmScheduledReport with reportType='SNAPSHOT'
  const report = await prisma.crmScheduledReport.create({
    data: {
      name: config.name,
      reportType: 'SNAPSHOT',
      schedule: '', // one-off
      recipients: [],
      isActive: false,
      config: {
        entities: config.entities,
        description: config.description || null,
        data,
        takenBy: userId || null,
        isAutomatic: !userId,
      } as unknown as Prisma.InputJsonValue,
      createdById: userId || 'system',
    },
  });

  logger.info('[SnapshotReporting] Snapshot taken', {
    snapshotId: report.id,
    name: config.name,
    entities: config.entities,
  });

  return {
    id: report.id,
    name: config.name,
    description: config.description || null,
    entities: config.entities,
    data,
    takenAt: report.createdAt.toISOString(),
    takenBy: userId || null,
    isAutomatic: !userId,
  };
}

/**
 * Retrieve a historical snapshot by ID.
 */
export async function getSnapshot(snapshotId: string): Promise<Snapshot | null> {
  const report = await prisma.crmScheduledReport.findUnique({
    where: { id: snapshotId },
  });

  if (!report || report.reportType !== 'SNAPSHOT') return null;

  const config = (report.config || {}) as Record<string, unknown>;

  return {
    id: report.id,
    name: report.name,
    description: (config.description as string) || null,
    entities: (config.entities as string[]) || [],
    data: (config.data as SnapshotData) || {},
    takenAt: report.createdAt.toISOString(),
    takenBy: (config.takenBy as string) || null,
    isAutomatic: (config.isAutomatic as boolean) || false,
  };
}

/**
 * List all snapshots within a time period.
 */
export async function listSnapshots(
  period?: { start: string; end: string },
): Promise<Omit<Snapshot, 'data'>[]> {
  const where: Prisma.CrmScheduledReportWhereInput = {
    reportType: 'SNAPSHOT',
    ...(period
      ? {
          createdAt: {
            gte: new Date(period.start),
            lte: new Date(period.end),
          },
        }
      : {}),
  };

  const reports = await prisma.crmScheduledReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return reports.map((r) => {
    const config = (r.config || {}) as Record<string, unknown>;
    return {
      id: r.id,
      name: r.name,
      description: (config.description as string) || null,
      entities: (config.entities as string[]) || [],
      takenAt: r.createdAt.toISOString(),
      takenBy: (config.takenBy as string) || null,
      isAutomatic: (config.isAutomatic as boolean) || false,
    };
  });
}

/**
 * Compare two snapshots and return the differences.
 */
export async function compareSnapshots(
  snapshotId1: string,
  snapshotId2: string,
): Promise<SnapshotDiff> {
  const snap1 = await getSnapshot(snapshotId1);
  const snap2 = await getSnapshot(snapshotId2);

  if (!snap1) throw new Error(`Snapshot ${snapshotId1} not found`);
  if (!snap2) throw new Error(`Snapshot ${snapshotId2} not found`);

  const changes: SnapshotDiff['changes'] = [];

  // Compare pipeline
  if (snap1.data.pipeline && snap2.data.pipeline) {
    addChange(changes, 'pipeline', 'totalDeals', snap1.data.pipeline.totalDeals, snap2.data.pipeline.totalDeals);
    addChange(changes, 'pipeline', 'totalValue', snap1.data.pipeline.totalValue, snap2.data.pipeline.totalValue);
    addChange(changes, 'pipeline', 'weightedValue', snap1.data.pipeline.weightedValue, snap2.data.pipeline.weightedValue);
  }

  // Compare leads
  if (snap1.data.leads && snap2.data.leads) {
    addChange(changes, 'leads', 'total', snap1.data.leads.total, snap2.data.leads.total);
    addChange(changes, 'leads', 'newThisMonth', snap1.data.leads.newThisMonth, snap2.data.leads.newThisMonth);
    addChange(changes, 'leads', 'avgScore', snap1.data.leads.avgScore, snap2.data.leads.avgScore);
  }

  // Compare deals
  if (snap1.data.deals && snap2.data.deals) {
    addChange(changes, 'deals', 'total', snap1.data.deals.total, snap2.data.deals.total);
    addChange(changes, 'deals', 'wonDeals', snap1.data.deals.wonDeals, snap2.data.deals.wonDeals);
    addChange(changes, 'deals', 'winRate', snap1.data.deals.winRate, snap2.data.deals.winRate);
    addChange(changes, 'deals', 'avgDealValue', snap1.data.deals.avgDealValue, snap2.data.deals.avgDealValue);
  }

  // Compare revenue
  if (snap1.data.revenue && snap2.data.revenue) {
    addChange(changes, 'revenue', 'monthlyRevenue', snap1.data.revenue.monthlyRevenue, snap2.data.revenue.monthlyRevenue);
    addChange(changes, 'revenue', 'avgOrderValue', snap1.data.revenue.avgOrderValue, snap2.data.revenue.avgOrderValue);
    addChange(changes, 'revenue', 'orderCount', snap1.data.revenue.orderCount, snap2.data.revenue.orderCount);
  }

  // Compare customers
  if (snap1.data.customers && snap2.data.customers) {
    addChange(changes, 'customers', 'total', snap1.data.customers.total, snap2.data.customers.total);
    addChange(changes, 'customers', 'newThisMonth', snap1.data.customers.newThisMonth, snap2.data.customers.newThisMonth);
  }

  const improved = changes.filter((c) => c.change > 0).length;
  const declined = changes.filter((c) => c.change < 0).length;
  const unchanged = changes.filter((c) => c.change === 0).length;

  return {
    snapshotId1,
    snapshotId2,
    snapshot1Date: snap1.takenAt,
    snapshot2Date: snap2.takenAt,
    changes,
    summary: { improved, declined, unchanged },
  };
}

/**
 * Schedule automatic snapshots at a given frequency.
 */
export async function scheduleAutoSnapshot(config: {
  frequency: 'daily' | 'weekly' | 'monthly';
  entities: string[];
  userId: string;
}): Promise<AutoSnapshotConfig> {
  const cronMap: Record<string, string> = {
    daily: '0 0 * * *',
    weekly: '0 0 * * 1',
    monthly: '0 0 1 * *',
  };

  const report = await prisma.crmScheduledReport.create({
    data: {
      name: `Auto Snapshot (${config.frequency})`,
      reportType: 'AUTO_SNAPSHOT',
      schedule: cronMap[config.frequency],
      recipients: [],
      isActive: true,
      config: {
        frequency: config.frequency,
        entities: config.entities,
      } as unknown as Prisma.InputJsonValue,
      createdById: config.userId,
    },
  });

  const nextRun = getNextRunDate(config.frequency);

  logger.info('[SnapshotReporting] Auto-snapshot scheduled', {
    id: report.id,
    frequency: config.frequency,
    entities: config.entities,
  });

  return {
    id: report.id,
    frequency: config.frequency,
    entities: config.entities,
    enabled: true,
    lastRunAt: null,
    nextRunAt: nextRun.toISOString(),
  };
}

/**
 * Get trend data for a specific metric across multiple snapshots.
 */
export async function getSnapshotTrend(
  entity: string,
  metric: string,
  period?: { start: string; end: string },
): Promise<SnapshotTrendPoint[]> {
  const snapshots = await listSnapshots(period);
  const trend: SnapshotTrendPoint[] = [];

  for (const snapMeta of snapshots) {
    if (!snapMeta.entities.includes(entity)) continue;

    const fullSnap = await getSnapshot(snapMeta.id);
    if (!fullSnap) continue;

    const entityData = fullSnap.data[entity as keyof SnapshotData] as Record<string, unknown> | undefined;
    if (!entityData) continue;

    const value = entityData[metric];
    if (typeof value !== 'number') continue;

    trend.push({
      date: fullSnap.takenAt,
      value,
      snapshotId: fullSnap.id,
    });
  }

  trend.sort((a, b) => a.date.localeCompare(b.date));

  return trend;
}

// ---------------------------------------------------------------------------
// State Capture Helpers
// ---------------------------------------------------------------------------

async function capturePipelineState(): Promise<SnapshotData['pipeline']> {
  const stages = await prisma.crmPipelineStage.findMany({
    select: {
      id: true,
      name: true,
      probability: true,
      _count: { select: { deals: true } },
    },
  });

  const stageData = await Promise.all(
    stages.map(async (stage) => {
      const agg = await prisma.crmDeal.aggregate({
        where: { stageId: stage.id },
        _sum: { value: true },
      });
      return {
        id: stage.id,
        name: stage.name,
        dealCount: stage._count.deals,
        totalValue: Number(agg._sum.value || 0),
        probability: stage.probability,
      };
    }),
  );

  const totalDeals = stageData.reduce((s, st) => s + st.dealCount, 0);
  const totalValue = stageData.reduce((s, st) => s + st.totalValue, 0);
  const weightedValue = stageData.reduce((s, st) => s + st.totalValue * st.probability, 0);

  return { stages: stageData, totalDeals, totalValue, weightedValue: Math.round(weightedValue * 100) / 100 };
}

async function captureLeadState(): Promise<SnapshotData['leads']> {
  const total = await prisma.crmLead.count();

  const byStatusRaw = await prisma.crmLead.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  const byStatus: Record<string, number> = {};
  for (const s of byStatusRaw) {
    byStatus[s.status] = s._count.id;
  }

  const bySourceRaw = await prisma.crmLead.groupBy({
    by: ['source'],
    _count: { id: true },
  });
  const bySource: Record<string, number> = {};
  for (const s of bySourceRaw) {
    bySource[s.source || 'Unknown'] = s._count.id;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const newThisMonth = await prisma.crmLead.count({
    where: { createdAt: { gte: monthStart } },
  });

  const convertedThisMonth = await prisma.crmLead.count({
    where: {
      convertedDealId: { not: null },
      updatedAt: { gte: monthStart },
    },
  });

  const scoreAgg = await prisma.crmLead.aggregate({
    _avg: { score: true },
  });

  return {
    total,
    byStatus,
    bySource,
    newThisMonth,
    convertedThisMonth,
    avgScore: Math.round((scoreAgg._avg.score || 0) * 10) / 10,
  };
}

async function captureDealState(): Promise<SnapshotData['deals']> {
  const total = await prisma.crmDeal.count();
  const openDeals = await prisma.crmDeal.count({ where: { stage: { isWon: false, isLost: false } } });
  const wonDeals = await prisma.crmDeal.count({ where: { stage: { isWon: true } } });
  const lostDeals = await prisma.crmDeal.count({ where: { stage: { isLost: true } } });

  const valueAgg = await prisma.crmDeal.aggregate({
    _avg: { value: true },
  });

  const closedDeals = wonDeals + lostDeals;
  const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;

  // Average deal age in days
  const allDeals = await prisma.crmDeal.findMany({
    where: { stage: { isWon: false, isLost: false } },
    select: { createdAt: true },
  });
  const now = new Date();
  const totalAge = allDeals.reduce(
    (sum, d) => sum + (now.getTime() - d.createdAt.getTime()) / 86400000,
    0,
  );
  const avgDealAge = allDeals.length > 0 ? Math.round(totalAge / allDeals.length) : 0;

  return {
    total,
    openDeals,
    wonDeals,
    lostDeals,
    avgDealValue: Math.round(Number(valueAgg._avg.value || 0) * 100) / 100,
    avgDealAge,
    winRate,
  };
}

async function captureRevenueState(): Promise<SnapshotData['revenue']> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [monthlyOrders, quarterlyOrders, yearOrders] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } },
      select: { total: true },
    }),
    prisma.order.findMany({
      where: { status: { not: 'CANCELLED' }, createdAt: { gte: quarterStart } },
      select: { total: true },
    }),
    prisma.order.findMany({
      where: { status: { not: 'CANCELLED' }, createdAt: { gte: yearStart } },
      select: { total: true },
    }),
  ]);

  const monthlyRevenue = monthlyOrders.reduce((s, o) => s + Number(o.total), 0);
  const quarterlyRevenue = quarterlyOrders.reduce((s, o) => s + Number(o.total), 0);
  const yearToDate = yearOrders.reduce((s, o) => s + Number(o.total), 0);

  return {
    monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
    quarterlyRevenue: Math.round(quarterlyRevenue * 100) / 100,
    yearToDate: Math.round(yearToDate * 100) / 100,
    avgOrderValue: monthlyOrders.length > 0
      ? Math.round((monthlyRevenue / monthlyOrders.length) * 100) / 100
      : 0,
    orderCount: monthlyOrders.length,
  };
}

async function captureActivityState(): Promise<SnapshotData['activities']> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const total = await prisma.crmActivity.count({
    where: { createdAt: { gte: monthStart } },
  });

  const byTypeRaw = await prisma.crmActivity.groupBy({
    by: ['type'],
    where: { createdAt: { gte: monthStart } },
    _count: { _all: true },
  });
  const byType: Record<string, number> = {};
  for (const t of byTypeRaw) {
    byType[t.type] = t._count._all;
  }

  const uniqueUsers = await prisma.crmActivity.findMany({
    where: { createdAt: { gte: monthStart }, performedById: { not: null } },
    distinct: ['performedById'],
    select: { performedById: true },
  });

  return {
    total,
    byType,
    avgPerUser: uniqueUsers.length > 0 ? Math.round(total / uniqueUsers.length) : 0,
  };
}

async function captureCustomerState(): Promise<SnapshotData['customers']> {
  const total = await prisma.user.count({ where: { role: 'CUSTOMER' } });

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const newThisMonth = await prisma.user.count({
    where: { role: 'CUSTOMER', createdAt: { gte: monthStart } },
  });

  const activeThisMonth = await prisma.order.findMany({
    where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
    distinct: ['userId'],
    select: { userId: true },
  });

  return {
    total,
    newThisMonth,
    activeThisMonth: activeThisMonth.length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addChange(
  changes: SnapshotDiff['changes'],
  entity: string,
  field: string,
  oldValue: number,
  newValue: number,
): void {
  const change = Math.round((newValue - oldValue) * 100) / 100;
  const changePercent = oldValue !== 0 ? Math.round((change / oldValue) * 10000) / 100 : 0;
  changes.push({ entity, field, oldValue, newValue, change, changePercent });
}

function getNextRunDate(frequency: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date();
  const next = new Date(now);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 - next.getDay() + 1));
      next.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
      break;
  }

  return next;
}
