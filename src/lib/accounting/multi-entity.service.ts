/**
 * Multi-Entity / Multi-Company Service
 * Manages legal entities, intercompany transactions, and consolidated reporting.
 *
 * Phase 11 - Multi-Entity Accounting
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateEntityInput {
  name: string;
  code: string;
  legalName?: string;
  taxNumber?: string;
  gstNumber?: string;
  qstNumber?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  currency?: string;
  fiscalYearStart?: number;
  parentEntityId?: string | null;
  isActive?: boolean;
}

export interface UpdateEntityInput {
  name?: string;
  legalName?: string;
  taxNumber?: string;
  gstNumber?: string;
  qstNumber?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  currency?: string;
  fiscalYearStart?: number;
  parentEntityId?: string | null;
  isActive?: boolean;
}

export interface EntityTreeNode {
  id: string;
  name: string;
  code: string;
  legalName: string | null;
  isActive: boolean;
  isDefault: boolean;
  currency: string;
  country: string;
  children: EntityTreeNode[];
}

export interface EntityFinancials {
  entityId: string;
  entityName: string;
  entityCode: string;
  startDate: string;
  endDate: string;
  incomeStatement: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingIncome: number;
    otherIncomeExpense: number;
    netIncome: number;
  };
  balanceSheet: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
}

export interface IntercoBalance {
  fromEntityId: string;
  fromEntityName: string;
  fromEntityCode: string;
  toEntityId: string;
  toEntityName: string;
  toEntityCode: string;
  pendingAmount: number;
  postedAmount: number;
  eliminatedAmount: number;
  netBalance: number;
  transactionCount: number;
}

export interface ConsolidatedReport {
  startDate: string;
  endDate: string;
  entityIds: string[];
  entityNames: string[];
  incomeStatement: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingIncome: number;
    otherIncomeExpense: number;
    netIncome: number;
  };
  balanceSheet: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  eliminations: {
    totalEliminated: number;
    transactionCount: number;
    details: Array<{
      id: string;
      fromEntity: string;
      toEntity: string;
      type: string;
      amount: number;
      description: string;
    }>;
  };
}

export interface EntityComparison {
  startDate: string;
  endDate: string;
  entities: Array<{
    entityId: string;
    entityName: string;
    entityCode: string;
    revenue: number;
    expenses: number;
    netIncome: number;
    totalAssets: number;
    totalLiabilities: number;
    grossMargin: number;
    netMargin: number;
  }>;
}

export type IntercoTransactionType =
  | 'SALE'
  | 'PURCHASE'
  | 'LOAN'
  | 'PAYMENT'
  | 'EXPENSE_ALLOCATION'
  | 'MANAGEMENT_FEE';

export type IntercoTransactionStatus = 'PENDING' | 'POSTED' | 'ELIMINATED' | 'CANCELLED';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

interface AggRow {
  account_type: string;
  code_prefix: string;
  total_debit: number;
  total_credit: number;
}

/**
 * Execute a GROUP BY query that aggregates journal line totals
 * by account type and 2-character code prefix for a given date range.
 * This mirrors the pattern used in kpi.service.ts but is independent
 * to avoid coupling the multi-entity module to the KPI service.
 */
async function bulkSumByAccountType(
  startDate?: Date,
  endDate?: Date,
): Promise<AggRow[]> {
  try {
    const conditions = [
      Prisma.sql`je.status = 'POSTED'`,
      Prisma.sql`je."deletedAt" IS NULL`,
      Prisma.sql`ca."isActive" = true`,
    ];

    if (startDate) {
      conditions.push(Prisma.sql`je.date >= ${startDate}::timestamp`);
    }
    if (endDate) {
      conditions.push(Prisma.sql`je.date <= ${endDate}::timestamp`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    const rows = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
      SELECT ca.type AS account_type,
             LEFT(ca.code, 2) AS code_prefix,
             COALESCE(SUM(jl.debit), 0)::float AS total_debit,
             COALESCE(SUM(jl.credit), 0)::float AS total_credit
      FROM "JournalLine" jl
      JOIN "ChartOfAccount" ca ON jl."accountId" = ca.id
      JOIN "JournalEntry" je ON jl."entryId" = je.id
      WHERE ${whereClause}
      GROUP BY ca.type, LEFT(ca.code, 2)
    `);

    return rows;
  } catch (error) {
    logger.error('[MultiEntityService] bulkSumByAccountType query failed', {
      startDate,
      endDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function extractSum(rows: AggRow[], accountType: string, codePrefix?: string): number {
  const filtered = rows.filter((r) => {
    if (r.account_type !== accountType) return false;
    if (codePrefix) return r.code_prefix.startsWith(codePrefix);
    return true;
  });

  let totalDebit = 0;
  let totalCredit = 0;
  for (const r of filtered) {
    totalDebit += r.total_debit;
    totalCredit += r.total_credit;
  }

  if (accountType === 'ASSET' || accountType === 'EXPENSE') {
    return totalDebit - totalCredit;
  }
  return totalCredit - totalDebit;
}

/**
 * Build financials from pre-aggregated rows.
 */
function buildFinancialsFromRows(
  balanceRows: AggRow[],
  incomeRows: AggRow[],
): { incomeStatement: EntityFinancials['incomeStatement']; balanceSheet: EntityFinancials['balanceSheet'] } {
  const revenue = extractSum(incomeRows, 'REVENUE');
  const cogs = extractSum(incomeRows, 'EXPENSE', '5');
  const grossProfit = round2(revenue - cogs);
  const operatingExpenses = extractSum(incomeRows, 'EXPENSE', '6');
  const operatingIncome = round2(grossProfit - operatingExpenses);
  const otherIncomeExpense = extractSum(incomeRows, 'EXPENSE', '7');
  const netIncome = round2(operatingIncome - otherIncomeExpense);

  const totalAssets = extractSum(balanceRows, 'ASSET');
  const totalLiabilities = extractSum(balanceRows, 'LIABILITY');
  const totalEquity = extractSum(balanceRows, 'EQUITY');

  return {
    incomeStatement: {
      revenue: round2(revenue),
      cogs: round2(cogs),
      grossProfit,
      operatingExpenses: round2(operatingExpenses),
      operatingIncome,
      otherIncomeExpense: round2(otherIncomeExpense),
      netIncome,
    },
    balanceSheet: {
      totalAssets: round2(totalAssets),
      totalLiabilities: round2(totalLiabilities),
      totalEquity: round2(totalEquity),
    },
  };
}

// ---------------------------------------------------------------------------
// Entity CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new legal entity.
 */
export async function createEntity(data: CreateEntityInput) {
  // Check code uniqueness
  const existing = await prisma.legalEntity.findUnique({
    where: { code: data.code },
  });
  if (existing) {
    throw new Error(`Entity with code "${data.code}" already exists`);
  }

  // Validate parent entity if provided
  if (data.parentEntityId) {
    const parent = await prisma.legalEntity.findUnique({
      where: { id: data.parentEntityId },
    });
    if (!parent) {
      throw new Error(`Parent entity not found: ${data.parentEntityId}`);
    }
  }

  const entity = await prisma.legalEntity.create({
    data: {
      name: data.name,
      code: data.code,
      legalName: data.legalName,
      taxNumber: data.taxNumber,
      gstNumber: data.gstNumber,
      qstNumber: data.qstNumber,
      address: data.address,
      city: data.city,
      province: data.province,
      postalCode: data.postalCode,
      country: data.country ?? 'CA',
      currency: data.currency ?? 'CAD',
      fiscalYearStart: data.fiscalYearStart ?? 1,
      parentEntityId: data.parentEntityId ?? null,
      isActive: data.isActive ?? true,
    },
    include: {
      parentEntity: { select: { id: true, name: true, code: true } },
      childEntities: { select: { id: true, name: true, code: true } },
    },
  });

  logger.info('[MultiEntityService] Entity created', {
    entityId: entity.id,
    code: entity.code,
    name: entity.name,
  });

  return entity;
}

/**
 * List all entities with optional hierarchy.
 */
export async function getEntities(includeInactive = false) {
  const where: Prisma.LegalEntityWhereInput = {
    deletedAt: null,
    ...(includeInactive ? {} : { isActive: true }),
  };

  const entities = await prisma.legalEntity.findMany({
    where,
    include: {
      parentEntity: { select: { id: true, name: true, code: true } },
      childEntities: {
        where: { deletedAt: null },
        select: { id: true, name: true, code: true, isActive: true },
      },
      _count: {
        select: {
          intercoTransactions: true,
          intercoReceived: true,
        },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  return entities;
}

/**
 * Get entities as a hierarchical tree.
 */
export async function getEntityTree(): Promise<EntityTreeNode[]> {
  const entities = await prisma.legalEntity.findMany({
    where: { deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      legalName: true,
      isActive: true,
      isDefault: true,
      currency: true,
      country: true,
      parentEntityId: true,
    },
    orderBy: { name: 'asc' },
  });

  // Build a map of id -> entity
  const entityMap = new Map<string, typeof entities[number]>();
  for (const e of entities) {
    entityMap.set(e.id, e);
  }

  // Build tree
  const roots: EntityTreeNode[] = [];
  const childMap = new Map<string, EntityTreeNode[]>();

  for (const e of entities) {
    const node: EntityTreeNode = {
      id: e.id,
      name: e.name,
      code: e.code,
      legalName: e.legalName,
      isActive: e.isActive,
      isDefault: e.isDefault,
      currency: e.currency,
      country: e.country,
      children: [],
    };

    if (!e.parentEntityId) {
      roots.push(node);
    } else {
      const siblings = childMap.get(e.parentEntityId) || [];
      siblings.push(node);
      childMap.set(e.parentEntityId, siblings);
    }

    // Set children reference for later assignment
    const existingChildren = childMap.get(e.id);
    if (existingChildren) {
      node.children = existingChildren;
    }
  }

  // Second pass: assign children to parents
  function assignChildren(nodes: EntityTreeNode[]): void {
    for (const node of nodes) {
      const children = childMap.get(node.id);
      if (children) {
        node.children = children;
        assignChildren(children);
      }
    }
  }

  assignChildren(roots);

  return roots;
}

/**
 * Get a single entity by ID.
 */
export async function getEntityById(id: string) {
  const entity = await prisma.legalEntity.findFirst({
    where: { id, deletedAt: null },
    include: {
      parentEntity: { select: { id: true, name: true, code: true } },
      childEntities: {
        where: { deletedAt: null },
        select: { id: true, name: true, code: true, isActive: true },
      },
      _count: {
        select: {
          intercoTransactions: true,
          intercoReceived: true,
        },
      },
    },
  });

  if (!entity) {
    throw new Error(`Entity not found: ${id}`);
  }

  return entity;
}

/**
 * Update an existing entity.
 */
export async function updateEntity(id: string, data: UpdateEntityInput) {
  const existing = await prisma.legalEntity.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    throw new Error(`Entity not found: ${id}`);
  }

  // Validate parent entity if changed
  if (data.parentEntityId !== undefined && data.parentEntityId !== null) {
    if (data.parentEntityId === id) {
      throw new Error('An entity cannot be its own parent');
    }
    const parent = await prisma.legalEntity.findUnique({
      where: { id: data.parentEntityId },
    });
    if (!parent) {
      throw new Error(`Parent entity not found: ${data.parentEntityId}`);
    }
    // Prevent circular hierarchy
    let current: string | null = data.parentEntityId;
    const visited = new Set<string>([id]);
    while (current) {
      if (visited.has(current)) {
        throw new Error('Circular entity hierarchy detected');
      }
      visited.add(current);
      const parentEntity: { parentEntityId: string | null } | null = await prisma.legalEntity.findUnique({
        where: { id: current },
        select: { parentEntityId: true },
      });
      current = parentEntity?.parentEntityId ?? null;
    }
  }

  const updated = await prisma.legalEntity.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.legalName !== undefined && { legalName: data.legalName }),
      ...(data.taxNumber !== undefined && { taxNumber: data.taxNumber }),
      ...(data.gstNumber !== undefined && { gstNumber: data.gstNumber }),
      ...(data.qstNumber !== undefined && { qstNumber: data.qstNumber }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.province !== undefined && { province: data.province }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
      ...(data.country !== undefined && { country: data.country }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.fiscalYearStart !== undefined && { fiscalYearStart: data.fiscalYearStart }),
      ...(data.parentEntityId !== undefined && { parentEntityId: data.parentEntityId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: {
      parentEntity: { select: { id: true, name: true, code: true } },
      childEntities: {
        where: { deletedAt: null },
        select: { id: true, name: true, code: true, isActive: true },
      },
    },
  });

  logger.info('[MultiEntityService] Entity updated', {
    entityId: id,
    changes: Object.keys(data),
  });

  return updated;
}

/**
 * Set an entity as the default (unsets any previous default).
 */
export async function setDefaultEntity(id: string) {
  const entity = await prisma.legalEntity.findFirst({
    where: { id, deletedAt: null },
  });

  if (!entity) {
    throw new Error(`Entity not found: ${id}`);
  }

  await prisma.$transaction([
    prisma.legalEntity.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    }),
    prisma.legalEntity.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);

  logger.info('[MultiEntityService] Default entity set', {
    entityId: id,
    code: entity.code,
  });

  return { ...entity, isDefault: true };
}

/**
 * Soft-delete an entity.
 */
export async function deleteEntity(id: string) {
  const entity = await prisma.legalEntity.findFirst({
    where: { id, deletedAt: null },
  });

  if (!entity) {
    throw new Error(`Entity not found: ${id}`);
  }

  // Prevent deletion if entity has pending interco transactions
  const pendingCount = await prisma.intercompanyTransaction.count({
    where: {
      OR: [{ fromEntityId: id }, { toEntityId: id }],
      status: { in: ['PENDING', 'POSTED'] },
    },
  });

  if (pendingCount > 0) {
    throw new Error(
      `Cannot delete entity with ${pendingCount} pending/posted intercompany transactions`,
    );
  }

  // Prevent deletion if entity has children
  const childCount = await prisma.legalEntity.count({
    where: { parentEntityId: id, deletedAt: null },
  });

  if (childCount > 0) {
    throw new Error(`Cannot delete entity with ${childCount} child entities`);
  }

  await prisma.legalEntity.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false, isDefault: false },
  });

  logger.info('[MultiEntityService] Entity deleted', {
    entityId: id,
    code: entity.code,
  });
}

// ---------------------------------------------------------------------------
// Entity Financials
// ---------------------------------------------------------------------------

/**
 * Get P&L and balance sheet for a single entity.
 * Note: In a full multi-entity system, each entity would have its own chart of accounts.
 * For the initial implementation, we use the shared chart of accounts and tag entries
 * by entity. The aggregation still queries all POSTED entries in the date range.
 */
export async function getEntityFinancials(
  entityId: string,
  startDate: Date,
  endDate: Date,
): Promise<EntityFinancials> {
  const entity = await prisma.legalEntity.findFirst({
    where: { id: entityId, deletedAt: null },
  });

  if (!entity) {
    throw new Error(`Entity not found: ${entityId}`);
  }

  const [balanceRows, incomeRows] = await Promise.all([
    bulkSumByAccountType(undefined, endDate),
    bulkSumByAccountType(startDate, endDate),
  ]);

  const { incomeStatement, balanceSheet } = buildFinancialsFromRows(balanceRows, incomeRows);

  return {
    entityId: entity.id,
    entityName: entity.name,
    entityCode: entity.code,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    incomeStatement,
    balanceSheet,
  };
}

// ---------------------------------------------------------------------------
// Intercompany Transactions
// ---------------------------------------------------------------------------

/**
 * Generate a unique transaction number: ICT-YYYY-NNNNN
 */
async function generateIntercoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ICT-${year}-`;

  const [maxRow] = await prisma.$queryRaw<{ max_num: string | null }[]>`
    SELECT MAX("transactionNumber") as max_num
    FROM "IntercompanyTransaction"
    WHERE "transactionNumber" LIKE ${prefix + '%'}
  `;

  let nextNum = 1;
  if (maxRow?.max_num) {
    const parsed = parseInt(maxRow.max_num.split('-').pop() || '0');
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

/**
 * Create an intercompany transaction.
 */
export async function createIntercoTransaction(
  fromEntityId: string,
  toEntityId: string,
  type: IntercoTransactionType,
  amount: number,
  description: string,
  createdBy?: string,
) {
  if (fromEntityId === toEntityId) {
    throw new Error('Intercompany transaction must be between different entities');
  }

  if (amount <= 0) {
    throw new Error('Intercompany transaction amount must be positive');
  }

  // Validate both entities exist
  const [fromEntity, toEntity] = await Promise.all([
    prisma.legalEntity.findFirst({ where: { id: fromEntityId, deletedAt: null } }),
    prisma.legalEntity.findFirst({ where: { id: toEntityId, deletedAt: null } }),
  ]);

  if (!fromEntity) throw new Error(`Source entity not found: ${fromEntityId}`);
  if (!toEntity) throw new Error(`Target entity not found: ${toEntityId}`);

  const transactionNumber = await generateIntercoNumber();

  const transaction = await prisma.intercompanyTransaction.create({
    data: {
      transactionNumber,
      fromEntityId,
      toEntityId,
      type,
      description,
      amount: new Prisma.Decimal(amount.toFixed(2)),
      currency: fromEntity.currency,
      status: 'PENDING',
      createdBy: createdBy ?? null,
    },
    include: {
      fromEntity: { select: { id: true, name: true, code: true } },
      toEntity: { select: { id: true, name: true, code: true } },
    },
  });

  logger.info('[MultiEntityService] Interco transaction created', {
    transactionId: transaction.id,
    number: transaction.transactionNumber,
    from: fromEntity.code,
    to: toEntity.code,
    type,
    amount,
  });

  return transaction;
}

/**
 * Get intercompany transactions with filters.
 */
export async function getIntercoTransactions(options?: {
  entityId?: string;
  status?: IntercoTransactionStatus;
  type?: IntercoTransactionType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const page = options?.page ?? 1;
  const limit = Math.min(options?.limit ?? 50, 200);

  const where: Prisma.IntercompanyTransactionWhereInput = {};

  if (options?.entityId) {
    where.OR = [
      { fromEntityId: options.entityId },
      { toEntityId: options.entityId },
    ];
  }
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.type) {
    where.type = options.type;
  }
  if (options?.startDate || options?.endDate) {
    where.createdAt = {
      ...(options.startDate ? { gte: options.startDate } : {}),
      ...(options.endDate ? { lte: options.endDate } : {}),
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.intercompanyTransaction.findMany({
      where,
      include: {
        fromEntity: { select: { id: true, name: true, code: true } },
        toEntity: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.intercompanyTransaction.count({ where }),
  ]);

  return {
    data: transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
    })),
    pagination: {
      page,
      pageSize: limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update an intercompany transaction.
 */
export async function updateIntercoTransaction(
  id: string,
  data: {
    status?: IntercoTransactionStatus;
    description?: string;
    journalEntryRef?: string;
    matchingRef?: string;
  },
) {
  const existing = await prisma.intercompanyTransaction.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error(`Intercompany transaction not found: ${id}`);
  }

  if (existing.status === 'ELIMINATED') {
    throw new Error('Cannot modify an eliminated transaction');
  }
  if (existing.status === 'CANCELLED') {
    throw new Error('Cannot modify a cancelled transaction');
  }

  const updated = await prisma.intercompanyTransaction.update({
    where: { id },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.journalEntryRef !== undefined && { journalEntryRef: data.journalEntryRef }),
      ...(data.matchingRef !== undefined && { matchingRef: data.matchingRef }),
    },
    include: {
      fromEntity: { select: { id: true, name: true, code: true } },
      toEntity: { select: { id: true, name: true, code: true } },
    },
  });

  return { ...updated, amount: Number(updated.amount) };
}

/**
 * Auto-match pending intercompany transactions.
 * Matches are found when there are reciprocal transactions between two entities
 * (e.g., Entity A -> SALE to Entity B and Entity B -> PURCHASE from Entity A
 * with the same amount).
 */
export async function matchIntercoTransactions(): Promise<{
  matched: number;
  pairs: Array<{ sourceId: string; matchId: string; amount: number }>;
}> {
  // Get all pending transactions
  const pending = await prisma.intercompanyTransaction.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });

  // Complementary type pairs
  const complementaryTypes: Record<string, string> = {
    SALE: 'PURCHASE',
    PURCHASE: 'SALE',
    LOAN: 'PAYMENT',
    PAYMENT: 'LOAN',
    EXPENSE_ALLOCATION: 'EXPENSE_ALLOCATION',
    MANAGEMENT_FEE: 'MANAGEMENT_FEE',
  };

  const matchedPairs: Array<{ sourceId: string; matchId: string; amount: number }> = [];
  const alreadyMatched = new Set<string>();

  for (const txn of pending) {
    if (alreadyMatched.has(txn.id)) continue;

    const complementType = complementaryTypes[txn.type];
    if (!complementType) continue;

    // Find a matching reciprocal transaction
    const match = pending.find(
      (other) =>
        !alreadyMatched.has(other.id) &&
        other.id !== txn.id &&
        other.fromEntityId === txn.toEntityId &&
        other.toEntityId === txn.fromEntityId &&
        other.type === complementType &&
        Number(other.amount).toFixed(2) === Number(txn.amount).toFixed(2),
    );

    if (match) {
      alreadyMatched.add(txn.id);
      alreadyMatched.add(match.id);
      matchedPairs.push({
        sourceId: txn.id,
        matchId: match.id,
        amount: Number(txn.amount),
      });
    }
  }

  // Update matched transactions in a single transaction
  if (matchedPairs.length > 0) {
    await prisma.$transaction(
      matchedPairs.flatMap((pair) => [
        prisma.intercompanyTransaction.update({
          where: { id: pair.sourceId },
          data: { status: 'POSTED', matchingRef: pair.matchId },
        }),
        prisma.intercompanyTransaction.update({
          where: { id: pair.matchId },
          data: { status: 'POSTED', matchingRef: pair.sourceId },
        }),
      ]),
    );
  }

  logger.info('[MultiEntityService] Interco matching completed', {
    matchedPairs: matchedPairs.length,
    totalPending: pending.length,
  });

  return {
    matched: matchedPairs.length,
    pairs: matchedPairs,
  };
}

/**
 * Eliminate matched (POSTED) intercompany transactions for consolidation.
 * Only eliminates transactions within the specified date range.
 */
export async function eliminateIntercoTransactions(
  startDate: Date,
  endDate: Date,
): Promise<{ eliminated: number; totalAmount: number }> {
  const posted = await prisma.intercompanyTransaction.findMany({
    where: {
      status: 'POSTED',
      matchingRef: { not: null },
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  if (posted.length === 0) {
    return { eliminated: 0, totalAmount: 0 };
  }

  const now = new Date();
  await prisma.intercompanyTransaction.updateMany({
    where: {
      id: { in: posted.map((t) => t.id) },
    },
    data: {
      status: 'ELIMINATED',
      eliminatedAt: now,
    },
  });

  const totalAmount = round2(posted.reduce((sum, t) => sum + Number(t.amount), 0));

  logger.info('[MultiEntityService] Interco transactions eliminated', {
    eliminated: posted.length,
    totalAmount,
    dateRange: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`,
  });

  return {
    eliminated: posted.length,
    totalAmount,
  };
}

// ---------------------------------------------------------------------------
// Intercompany Balances
// ---------------------------------------------------------------------------

/**
 * Get outstanding interco balances per entity pair.
 */
export async function getIntercoBalances(): Promise<IntercoBalance[]> {
  const transactions = await prisma.intercompanyTransaction.findMany({
    where: {
      status: { in: ['PENDING', 'POSTED', 'ELIMINATED'] },
    },
    include: {
      fromEntity: { select: { id: true, name: true, code: true } },
      toEntity: { select: { id: true, name: true, code: true } },
    },
  });

  // Aggregate by entity pair (ordered by fromEntityId < toEntityId for consistency)
  const pairMap = new Map<
    string,
    {
      fromEntity: { id: string; name: string; code: string };
      toEntity: { id: string; name: string; code: string };
      pending: number;
      posted: number;
      eliminated: number;
      count: number;
    }
  >();

  for (const txn of transactions) {
    const key = `${txn.fromEntityId}::${txn.toEntityId}`;
    const reverseKey = `${txn.toEntityId}::${txn.fromEntityId}`;

    // Check if we already have the reverse pair
    let pairKey = key;
    let isReverse = false;
    if (pairMap.has(reverseKey) && !pairMap.has(key)) {
      pairKey = reverseKey;
      isReverse = true;
    }

    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, {
        fromEntity: txn.fromEntity,
        toEntity: txn.toEntity,
        pending: 0,
        posted: 0,
        eliminated: 0,
        count: 0,
      });
    }

    const pair = pairMap.get(pairKey)!;
    const amount = Number(txn.amount);
    const signedAmount = isReverse ? -amount : amount;

    if (txn.status === 'PENDING') pair.pending += signedAmount;
    else if (txn.status === 'POSTED') pair.posted += signedAmount;
    else if (txn.status === 'ELIMINATED') pair.eliminated += signedAmount;
    pair.count++;
  }

  const balances: IntercoBalance[] = [];
  for (const [, pair] of pairMap) {
    balances.push({
      fromEntityId: pair.fromEntity.id,
      fromEntityName: pair.fromEntity.name,
      fromEntityCode: pair.fromEntity.code,
      toEntityId: pair.toEntity.id,
      toEntityName: pair.toEntity.name,
      toEntityCode: pair.toEntity.code,
      pendingAmount: round2(pair.pending),
      postedAmount: round2(pair.posted),
      eliminatedAmount: round2(pair.eliminated),
      netBalance: round2(pair.pending + pair.posted),
      transactionCount: pair.count,
    });
  }

  return balances;
}

// ---------------------------------------------------------------------------
// Consolidated Reporting
// ---------------------------------------------------------------------------

/**
 * Generate a consolidated financial report across multiple entities
 * with intercompany elimination.
 */
export async function getConsolidatedReport(
  startDate: Date,
  endDate: Date,
  entityIds?: string[],
): Promise<ConsolidatedReport> {
  // If no entityIds provided, use all active entities
  let entities: Array<{ id: string; name: string; code: string }>;
  if (entityIds && entityIds.length > 0) {
    entities = await prisma.legalEntity.findMany({
      where: { id: { in: entityIds }, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
  } else {
    entities = await prisma.legalEntity.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, code: true },
    });
  }

  // Get aggregated financial data across all entities
  const [balanceRows, incomeRows] = await Promise.all([
    bulkSumByAccountType(undefined, endDate),
    bulkSumByAccountType(startDate, endDate),
  ]);

  const { incomeStatement, balanceSheet } = buildFinancialsFromRows(balanceRows, incomeRows);

  // Get eliminated interco transactions for the period
  const eliminatedTransactions = await prisma.intercompanyTransaction.findMany({
    where: {
      status: 'ELIMINATED',
      createdAt: { gte: startDate, lte: endDate },
      ...(entityIds && entityIds.length > 0
        ? {
            OR: [
              { fromEntityId: { in: entityIds } },
              { toEntityId: { in: entityIds } },
            ],
          }
        : {}),
    },
    include: {
      fromEntity: { select: { code: true } },
      toEntity: { select: { code: true } },
    },
  });

  const totalEliminated = round2(
    eliminatedTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
  );

  // Apply elimination adjustments to consolidated financials
  // Intercompany sales/purchases eliminate from both revenue and COGS
  const eliminatedSales = eliminatedTransactions
    .filter((t) => t.type === 'SALE' || t.type === 'PURCHASE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const adjustedRevenue = round2(incomeStatement.revenue - eliminatedSales / 2);
  const adjustedCogs = round2(incomeStatement.cogs - eliminatedSales / 2);
  const adjustedGrossProfit = round2(adjustedRevenue - adjustedCogs);

  // Management fees and expense allocations eliminate from opex
  const eliminatedFees = eliminatedTransactions
    .filter((t) => t.type === 'MANAGEMENT_FEE' || t.type === 'EXPENSE_ALLOCATION')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const adjustedOperatingExpenses = round2(incomeStatement.operatingExpenses - eliminatedFees / 2);
  const adjustedOperatingIncome = round2(adjustedGrossProfit - adjustedOperatingExpenses);
  const adjustedNetIncome = round2(adjustedOperatingIncome - incomeStatement.otherIncomeExpense);

  // Loans/payments eliminate from intercompany receivables/payables on balance sheet
  const eliminatedLoans = eliminatedTransactions
    .filter((t) => t.type === 'LOAN' || t.type === 'PAYMENT')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const adjustedAssets = round2(balanceSheet.totalAssets - eliminatedLoans / 2);
  const adjustedLiabilities = round2(balanceSheet.totalLiabilities - eliminatedLoans / 2);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    entityIds: entities.map((e) => e.id),
    entityNames: entities.map((e) => `${e.code} - ${e.name}`),
    incomeStatement: {
      revenue: adjustedRevenue,
      cogs: adjustedCogs,
      grossProfit: adjustedGrossProfit,
      operatingExpenses: adjustedOperatingExpenses,
      operatingIncome: adjustedOperatingIncome,
      otherIncomeExpense: round2(incomeStatement.otherIncomeExpense),
      netIncome: adjustedNetIncome,
    },
    balanceSheet: {
      totalAssets: adjustedAssets,
      totalLiabilities: adjustedLiabilities,
      totalEquity: round2(balanceSheet.totalEquity),
    },
    eliminations: {
      totalEliminated,
      transactionCount: eliminatedTransactions.length,
      details: eliminatedTransactions.map((t) => ({
        id: t.id,
        fromEntity: t.fromEntity.code,
        toEntity: t.toEntity.code,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Entity Comparison
// ---------------------------------------------------------------------------

/**
 * Side-by-side comparison of financial metrics for multiple entities.
 */
export async function getEntityComparison(
  entityIds: string[],
  startDate: Date,
  endDate: Date,
): Promise<EntityComparison> {
  if (entityIds.length === 0) {
    throw new Error('At least one entity ID is required for comparison');
  }

  const entities = await prisma.legalEntity.findMany({
    where: { id: { in: entityIds }, deletedAt: null },
    select: { id: true, name: true, code: true },
  });

  if (entities.length === 0) {
    throw new Error('No valid entities found');
  }

  // Since all entities currently share the same chart of accounts,
  // we get the aggregate financials and present them for each entity.
  // In a production multi-entity system, each entity would have isolated books.
  const [balanceRows, incomeRows] = await Promise.all([
    bulkSumByAccountType(undefined, endDate),
    bulkSumByAccountType(startDate, endDate),
  ]);

  const { incomeStatement, balanceSheet } = buildFinancialsFromRows(balanceRows, incomeRows);

  const entitiesData = entities.map((entity) => {
    const revenue = incomeStatement.revenue;
    const expenses =
      incomeStatement.cogs +
      incomeStatement.operatingExpenses +
      incomeStatement.otherIncomeExpense;
    const netIncome = incomeStatement.netIncome;
    const grossMargin = revenue > 0 ? round2((incomeStatement.grossProfit / revenue) * 100) : 0;
    const netMarginPct = revenue > 0 ? round2((netIncome / revenue) * 100) : 0;

    return {
      entityId: entity.id,
      entityName: entity.name,
      entityCode: entity.code,
      revenue: round2(revenue),
      expenses: round2(expenses),
      netIncome: round2(netIncome),
      totalAssets: round2(balanceSheet.totalAssets),
      totalLiabilities: round2(balanceSheet.totalLiabilities),
      grossMargin,
      netMargin: netMarginPct,
    };
  });

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    entities: entitiesData,
  };
}
