/**
 * RS&DE (Scientific Research & Experimental Development) Tax Credit Service
 *
 * Handles Canadian federal SR&ED credits and Quebec provincial CRIC credits.
 * Supports SPCC and non-SPCC calculation, T661 form preparation, and eligibility checks.
 */

import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export type RSDeProjectStatus = 'DRAFT' | 'ACTIVE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type RSDeExpenseCategory = 'SALARY' | 'MATERIALS' | 'SUBCONTRACTOR' | 'CAPITAL' | 'OVERHEAD';

export interface CreateProjectInput {
  name: string;
  description?: string;
  fiscalYear: number;
  startDate?: string;
  endDate?: string;
  technologicalUncertainty?: string;
  technologicalAdvancement?: string;
  systematicInvestigation?: string;
  isSpcc?: boolean;
}

export interface CreateExpenseInput {
  projectId: string;
  category: RSDeExpenseCategory;
  description: string;
  amount: number;
  date: string;
  employeeName?: string;
  hoursWorked?: number;
  hourlyRate?: number;
  isEligible?: boolean;
  eligibilityNotes?: string;
}

export interface CreditCalculation {
  totalEligible: number;
  federalRate: number;
  federalCredit: number;
  provincialRate: number;
  provincialCredit: number;
  totalCredit: number;
  spccLimit: number;
  isRefundable: boolean;
  byCategory: Record<RSDeExpenseCategory, number>;
}

export interface T661FormData {
  partA: { projectTitle: string; claimPeriod: string; isSpcc: boolean; };
  partB: {
    projectDescription: string;
    technologicalUncertainties: string;
    technologicalAdvancements: string;
    systematicInvestigation: string;
  };
  partC: {
    salaries: number;
    materials: number;
    subcontractors: number;
    capitalExpenditures: number;
    overhead: number;
    totalExpenditure: number;
    eligibleExpenditure: number;
  };
  partD: {
    federalRate: number;
    federalCredit: number;
    provincialRate: number;
    provincialCredit: number;
    totalCredit: number;
  };
  partE: {
    projectStartDate: string | null;
    projectEndDate: string | null;
    status: string;
  };
}

export interface DashboardSummary {
  totalProjects: number;
  activeProjects: number;
  totalEligibleExpenses: number;
  totalCreditsEarned: number;
  byFiscalYear: Array<{ year: number; eligible: number; credits: number; projects: number; }>;
  byCategory: Record<string, number>;
  recentExpenses: Array<{ id: string; description: string; amount: number; date: string; category: string; projectName: string; }>;
}

// =============================================================================
// Constants
// =============================================================================

const FEDERAL_SPCC_RATE = 0.35;
const FEDERAL_NON_SPCC_RATE = 0.15;
const SPCC_EXPENDITURE_LIMIT = 6_000_000;
const SPCC_MAX_CREDIT = 2_100_000;
const QUEBEC_CRIC_SME_RATE = 0.30;
const QUEBEC_CRIC_LARGE_RATE = 0.20;
const QUEBEC_CRIC_BONIFIED_LIMIT = 1_000_000;

const CATEGORY_LABELS: Record<RSDeExpenseCategory, string> = {
  SALARY: 'Salaires chercheurs',
  MATERIALS: 'Matériaux consommés',
  SUBCONTRACTOR: 'Sous-traitance',
  CAPITAL: 'Dépenses en capital',
  OVERHEAD: 'Frais généraux',
};

// =============================================================================
// CRUD - Projects
// =============================================================================

export async function listProjects(filters?: {
  fiscalYear?: number;
  status?: RSDeProjectStatus;
  page?: number;
  limit?: number;
}) {
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 20;
  const where: Prisma.RSDeProjectWhereInput = {};
  if (filters?.fiscalYear) where.fiscalYear = filters.fiscalYear;
  if (filters?.status) where.status = filters.status;

  const [data, total] = await Promise.all([
    prisma.rSDeProject.findMany({
      where,
      include: { expenses: { select: { amount: true, isEligible: true } }, calculations: { orderBy: { calculatedAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.rSDeProject.count({ where }),
  ]);

  return {
    data: data.map(p => ({
      ...p,
      totalExpenses: p.expenses.reduce((s, e) => s + Number(e.amount), 0),
      eligibleExpenses: p.expenses.filter(e => e.isEligible).reduce((s, e) => s + Number(e.amount), 0),
      lastCalculation: p.calculations[0] || null,
    })),
    total,
    page,
    limit,
  };
}

export async function getProject(id: string) {
  return prisma.rSDeProject.findUnique({
    where: { id },
    include: { expenses: { orderBy: { date: 'desc' } }, calculations: { orderBy: { calculatedAt: 'desc' } } },
  });
}

export async function createProject(input: CreateProjectInput) {
  return prisma.rSDeProject.create({
    data: {
      name: input.name,
      description: input.description,
      fiscalYear: input.fiscalYear,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      technologicalUncertainty: input.technologicalUncertainty,
      technologicalAdvancement: input.technologicalAdvancement,
      systematicInvestigation: input.systematicInvestigation,
      isSpcc: input.isSpcc ?? true,
    },
  });
}

export async function updateProject(id: string, input: Partial<CreateProjectInput> & { status?: RSDeProjectStatus }) {
  const data: Prisma.RSDeProjectUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.fiscalYear !== undefined) data.fiscalYear = input.fiscalYear;
  if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.endDate !== undefined) data.endDate = input.endDate ? new Date(input.endDate) : null;
  if (input.technologicalUncertainty !== undefined) data.technologicalUncertainty = input.technologicalUncertainty;
  if (input.technologicalAdvancement !== undefined) data.technologicalAdvancement = input.technologicalAdvancement;
  if (input.systematicInvestigation !== undefined) data.systematicInvestigation = input.systematicInvestigation;
  if (input.status !== undefined) data.status = input.status;
  if (input.isSpcc !== undefined) data.isSpcc = input.isSpcc;
  return prisma.rSDeProject.update({ where: { id }, data });
}

export async function deleteProject(id: string) {
  return prisma.rSDeProject.delete({ where: { id } });
}

// =============================================================================
// CRUD - Expenses
// =============================================================================

export async function listExpenses(projectId: string, filters?: { category?: RSDeExpenseCategory; page?: number; limit?: number; }) {
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 50;
  const where: Prisma.RSDeExpenseWhereInput = { projectId };
  if (filters?.category) where.category = filters.category;

  const [data, total] = await Promise.all([
    prisma.rSDeExpense.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.rSDeExpense.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function createExpense(input: CreateExpenseInput) {
  return prisma.rSDeExpense.create({
    data: {
      projectId: input.projectId,
      category: input.category,
      description: input.description,
      amount: input.amount,
      date: new Date(input.date),
      employeeName: input.employeeName,
      hoursWorked: input.hoursWorked,
      hourlyRate: input.hourlyRate,
      isEligible: input.isEligible ?? true,
      eligibilityNotes: input.eligibilityNotes,
    },
  });
}

export async function deleteExpense(id: string) {
  return prisma.rSDeExpense.delete({ where: { id } });
}

// =============================================================================
// Credit Calculation
// =============================================================================

export async function calculateCredits(projectId: string): Promise<CreditCalculation> {
  const project = await prisma.rSDeProject.findUniqueOrThrow({ where: { id: projectId }, include: { expenses: true } });

  const eligibleExpenses = project.expenses.filter(e => e.isEligible);
  const byCategory: Record<RSDeExpenseCategory, number> = { SALARY: 0, MATERIALS: 0, SUBCONTRACTOR: 0, CAPITAL: 0, OVERHEAD: 0 };
  for (const e of eligibleExpenses) byCategory[e.category] += Number(e.amount);
  const totalEligible = Object.values(byCategory).reduce((s, v) => s + v, 0);

  const isSpcc = project.isSpcc;
  const federalRate = isSpcc ? FEDERAL_SPCC_RATE : FEDERAL_NON_SPCC_RATE;
  const eligibleForSpcc = Math.min(totalEligible, SPCC_EXPENDITURE_LIMIT);
  let federalCredit: number;
  if (isSpcc) {
    federalCredit = Math.min(eligibleForSpcc * FEDERAL_SPCC_RATE, SPCC_MAX_CREDIT);
    if (totalEligible > SPCC_EXPENDITURE_LIMIT) {
      federalCredit += (totalEligible - SPCC_EXPENDITURE_LIMIT) * FEDERAL_NON_SPCC_RATE;
    }
  } else {
    federalCredit = totalEligible * FEDERAL_NON_SPCC_RATE;
  }

  const provincialEligible = Math.min(totalEligible, QUEBEC_CRIC_BONIFIED_LIMIT);
  const provincialRate = isSpcc ? QUEBEC_CRIC_SME_RATE : QUEBEC_CRIC_LARGE_RATE;
  let provincialCredit = provincialEligible * provincialRate;
  if (totalEligible > QUEBEC_CRIC_BONIFIED_LIMIT) {
    provincialCredit += (totalEligible - QUEBEC_CRIC_BONIFIED_LIMIT) * QUEBEC_CRIC_LARGE_RATE;
  }

  const totalCredit = federalCredit + provincialCredit;

  await prisma.rSDeCalculation.create({
    data: {
      projectId,
      fiscalYear: project.fiscalYear,
      totalEligible,
      federalRate,
      federalCredit,
      provincialRate,
      provincialCredit,
      totalCredit,
      spccLimit: SPCC_EXPENDITURE_LIMIT,
      isRefundable: isSpcc,
    },
  });

  return { totalEligible, federalRate, federalCredit, provincialRate, provincialCredit, totalCredit, spccLimit: SPCC_EXPENDITURE_LIMIT, isRefundable: isSpcc, byCategory };
}

// =============================================================================
// T661 Form Preparation
// =============================================================================

export async function prepareT661(projectId: string): Promise<T661FormData> {
  const project = await prisma.rSDeProject.findUniqueOrThrow({ where: { id: projectId }, include: { expenses: { where: { isEligible: true } } } });
  const calc = await calculateCredits(projectId);

  const salaries = calc.byCategory.SALARY;
  const materials = calc.byCategory.MATERIALS;
  const subcontractors = calc.byCategory.SUBCONTRACTOR;
  const capital = calc.byCategory.CAPITAL;
  const overhead = calc.byCategory.OVERHEAD;

  return {
    partA: { projectTitle: project.name, claimPeriod: `${project.fiscalYear}-01-01 to ${project.fiscalYear}-12-31`, isSpcc: project.isSpcc },
    partB: {
      projectDescription: project.description || '',
      technologicalUncertainties: project.technologicalUncertainty || '',
      technologicalAdvancements: project.technologicalAdvancement || '',
      systematicInvestigation: project.systematicInvestigation || '',
    },
    partC: { salaries, materials, subcontractors, capitalExpenditures: capital, overhead, totalExpenditure: calc.totalEligible, eligibleExpenditure: calc.totalEligible },
    partD: { federalRate: calc.federalRate, federalCredit: calc.federalCredit, provincialRate: calc.provincialRate, provincialCredit: calc.provincialCredit, totalCredit: calc.totalCredit },
    partE: { projectStartDate: project.startDate?.toISOString().split('T')[0] ?? null, projectEndDate: project.endDate?.toISOString().split('T')[0] ?? null, status: project.status },
  };
}

// =============================================================================
// Eligibility Checker
// =============================================================================

export function checkEligibility(project: { technologicalUncertainty?: string | null; technologicalAdvancement?: string | null; systematicInvestigation?: string | null; }): {
  eligible: boolean;
  score: number;
  criteria: Array<{ name: string; met: boolean; description: string; }>;
} {
  const criteria = [
    { name: 'Incertitude technologique', met: !!(project.technologicalUncertainty && project.technologicalUncertainty.length > 20), description: 'Le projet doit identifier des incertitudes technologiques qui ne pouvaient être résolues par la pratique courante.' },
    { name: 'Avancement technologique', met: !!(project.technologicalAdvancement && project.technologicalAdvancement.length > 20), description: 'Le projet doit viser à réaliser un avancement technologique.' },
    { name: 'Investigation systématique', met: !!(project.systematicInvestigation && project.systematicInvestigation.length > 20), description: 'Le projet doit suivre une démarche systématique (hypothèses, tests, analyse).' },
  ];
  const score = criteria.filter(c => c.met).length;
  return { eligible: score === 3, score, criteria };
}

// =============================================================================
// Category Suggestion
// =============================================================================

export function suggestCategory(description: string): RSDeExpenseCategory {
  const lower = description.toLowerCase();
  if (/salaire|wage|salary|employee|chercheur|researcher|paie|pay/.test(lower)) return 'SALARY';
  if (/matéri|material|réactif|reagent|consommable|consumable|chimique|chemical/.test(lower)) return 'MATERIALS';
  if (/sous-trait|subcontract|consultant|externe|external|freelance/.test(lower)) return 'SUBCONTRACTOR';
  if (/équipement|equipment|machine|capital|achat.*appareil|instrument/.test(lower)) return 'CAPITAL';
  return 'OVERHEAD';
}

// =============================================================================
// Dashboard Summary
// =============================================================================

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const projects = await prisma.rSDeProject.findMany({ include: { expenses: true, calculations: { orderBy: { calculatedAt: 'desc' }, take: 1 } } });

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT').length;
  let totalEligibleExpenses = 0;
  let totalCreditsEarned = 0;
  const byCategory: Record<string, number> = {};
  const byYearMap = new Map<number, { eligible: number; credits: number; projects: number }>();

  for (const p of projects) {
    const eligible = p.expenses.filter(e => e.isEligible).reduce((s, e) => s + Number(e.amount), 0);
    totalEligibleExpenses += eligible;
    const calc = p.calculations[0];
    if (calc) totalCreditsEarned += Number(calc.totalCredit);

    for (const e of p.expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    }

    const y = p.fiscalYear;
    const existing = byYearMap.get(y) || { eligible: 0, credits: 0, projects: 0 };
    existing.eligible += eligible;
    existing.credits += calc ? Number(calc.totalCredit) : 0;
    existing.projects += 1;
    byYearMap.set(y, existing);
  }

  const byFiscalYear = Array.from(byYearMap.entries()).map(([year, v]) => ({ year, ...v })).sort((a, b) => b.year - a.year);

  const recentExpenses = await prisma.rSDeExpense.findMany({
    take: 10,
    orderBy: { date: 'desc' },
    include: { project: { select: { name: true } } },
  });

  return {
    totalProjects,
    activeProjects,
    totalEligibleExpenses,
    totalCreditsEarned,
    byFiscalYear,
    byCategory,
    recentExpenses: recentExpenses.map(e => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      date: e.date.toISOString(),
      category: e.category,
      projectName: e.project.name,
    })),
  };
}

export { CATEGORY_LABELS };
