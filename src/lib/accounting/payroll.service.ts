/**
 * PAYROLL SERVICE - Canadian Payroll (Quebec-based, 2026)
 *
 * Complete payroll calculation engine supporting:
 * - CPP/QPP contributions (base + QPP2)
 * - Employment Insurance (EI) premiums (Quebec reduced rate)
 * - QPIP (Quebec Parental Insurance Plan / RQAP)
 * - Federal income tax (2026 brackets)
 * - Provincial income tax (Quebec 2026 brackets)
 * - Employer contributions: CPP match, EI x 1.4, QPIP employer rate, HSF, CNESST, CNT
 * - Vacation pay accrual
 * - Payroll run lifecycle: Draft -> Calculated -> Approved -> Paid
 * - Pay stub generation with YTD totals
 * - T4 / RL-1 slip data generation
 *
 * All tax calculation functions are pure (no side effects) for testability.
 * Rates are based on 2026 Canadian/Quebec rates.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

// =============================================================================
// 2026 TAX CONSTANTS
// =============================================================================

/** CPP/QPP 2026 rates */
export const CPP_2026 = {
  // QPP Base (Quebec employees use QPP, not CPP)
  QPP_RATE: 0.0595,                // 5.95% employee rate for QPP base (Quebec)
  QPP_EMPLOYER_RATE: 0.0595,       // 5.95% employer match
  MAX_PENSIONABLE_EARNINGS: 71_300, // First ceiling (YMPE)
  BASIC_EXEMPTION: 3_500,
  MAX_EMPLOYEE_CONTRIBUTION: 4_034.10, // (71300-3500)*5.95%

  // QPP2 (second additional QPP contribution)
  QPP2_RATE: 0.04,                 // 4.00% employee
  QPP2_EMPLOYER_RATE: 0.04,        // 4.00% employer
  QPP2_MAX_EARNINGS: 81_200,       // Second ceiling (YAMPE)
  QPP2_MAX_EMPLOYEE_CONTRIBUTION: 396.00, // (81200-71300)*4.00%

  // CPP for non-Quebec provinces
  CPP_RATE: 0.0595,
  CPP_EMPLOYER_RATE: 0.0595,
  CPP2_RATE: 0.04,
  CPP2_EMPLOYER_RATE: 0.04,
} as const;

/** EI 2026 rates */
export const EI_2026 = {
  // Quebec has a reduced EI rate because QPIP replaces maternity/parental EI benefits
  QC_EMPLOYEE_RATE: 0.01312,      // 1.312% (reduced rate for Quebec)
  QC_EMPLOYER_RATE: 0.01837,      // 1.4x employee rate for Quebec
  QC_MAX_INSURABLE: 65_700,
  QC_MAX_EMPLOYEE: 862.38,
  QC_MAX_EMPLOYER: 1_207.34,

  // Non-Quebec rates
  EMPLOYEE_RATE: 0.01640,          // 1.64%
  EMPLOYER_RATE: 0.02296,          // 1.4x employee rate
  MAX_INSURABLE: 65_700,
  MAX_EMPLOYEE: 1_077.48,
  MAX_EMPLOYER: 1_508.47,
} as const;

/** QPIP / RQAP 2026 rates (Quebec only) */
export const QPIP_2026 = {
  EMPLOYEE_RATE: 0.00494,          // 0.494%
  EMPLOYER_RATE: 0.00692,          // 0.692%
  MAX_INSURABLE: 98_000,
  MAX_EMPLOYEE: 484.12,
  MAX_EMPLOYER: 678.16,
} as const;

/** Quebec employer-only contributions */
export const QC_EMPLOYER_2026 = {
  // HSF - Health Services Fund (Fonds des services de sante)
  HSF_RATE: 0.0165,                // 1.65% for total payroll <= $7M (small employer)
  HSF_RATE_LARGE: 0.0465,          // 4.65% for total payroll > $7M

  // CNESST (Workers' compensation) - rate varies by industry; using a default
  CNESST_RATE: 0.0144,             // 1.44% (average for office/tech; actual rate from CNESST classification)

  // CNT - Commission des normes du travail
  CNT_RATE: 0.0007,                // 0.07%
  CNT_MAX_INSURABLE: 98_000,

  // WSDRF - Workforce Skills Development (Loi sur les competences - 1%)
  // Only for employers with payroll > $2M; BioCycle is below threshold
  WSDRF_RATE: 0.01,
  WSDRF_THRESHOLD: 2_000_000,
} as const;

// =============================================================================
// 2026 FEDERAL INCOME TAX BRACKETS
// =============================================================================

export const FEDERAL_TAX_BRACKETS_2026 = [
  { min: 0,       max: 57_375,    rate: 0.15 },
  { min: 57_375,  max: 114_750,   rate: 0.205 },
  { min: 114_750, max: 158_468,   rate: 0.26 },
  { min: 158_468, max: 221_708,   rate: 0.29 },
  { min: 221_708, max: Infinity,  rate: 0.33 },
] as const;

/** 2026 federal basic personal amount */
export const FEDERAL_BASIC_PERSONAL_2026 = 16_129;

// =============================================================================
// 2026 QUEBEC PROVINCIAL TAX BRACKETS
// =============================================================================

export const QC_TAX_BRACKETS_2026 = [
  { min: 0,       max: 53_255,    rate: 0.14 },
  { min: 53_255,  max: 106_495,   rate: 0.19 },
  { min: 106_495, max: 129_590,   rate: 0.24 },
  { min: 129_590, max: Infinity,  rate: 0.2575 },
] as const;

/** 2026 Quebec basic personal amount */
export const QC_BASIC_PERSONAL_2026 = 18_571;

// =============================================================================
// PURE TAX CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate CPP/QPP contribution for a pay period.
 * Uses QPP rates for Quebec, CPP for other provinces.
 *
 * @param grossPay - Gross pay for the period
 * @param ytdGross - Year-to-date gross before this period
 * @param province - Province code (QC uses QPP)
 * @returns Object with employee and employer contributions (base + second additional)
 */
export function calculateCPP(
  grossPay: number,
  ytdGross: number,
  province: string = 'QC'
): { employee: number; employer: number; employee2: number; employer2: number } {
  const isQuebec = province === 'QC';

  // Base CPP/QPP
  const baseRate = isQuebec ? CPP_2026.QPP_RATE : CPP_2026.CPP_RATE;
  const baseEmployerRate = isQuebec ? CPP_2026.QPP_EMPLOYER_RATE : CPP_2026.CPP_EMPLOYER_RATE;
  const maxPensionable = CPP_2026.MAX_PENSIONABLE_EARNINGS;
  const exemption = CPP_2026.BASIC_EXEMPTION;
  const maxContrib = CPP_2026.MAX_EMPLOYEE_CONTRIBUTION;

  // Pro-rate basic exemption per pay period (assume 26 biweekly periods)
  // The actual per-period exemption is calculated by the employer as: exemption / periods
  // For simplicity, we calculate on cumulative basis
  const ytdPensionable = Math.min(ytdGross, maxPensionable) - exemption;
  const currentPensionable = Math.min(ytdGross + grossPay, maxPensionable) - exemption;

  const ytdContrib = Math.max(0, ytdPensionable) * baseRate;
  const totalContrib = Math.max(0, currentPensionable) * baseRate;
  const employee = Math.min(Math.max(0, totalContrib - ytdContrib), maxContrib - Math.min(ytdContrib, maxContrib));
  const employer = employee * (baseEmployerRate / baseRate);

  // CPP2/QPP2 (second additional contribution on earnings between first and second ceiling)
  const cpp2Rate = isQuebec ? CPP_2026.QPP2_RATE : CPP_2026.CPP2_RATE;
  const cpp2EmployerRate = isQuebec ? CPP_2026.QPP2_EMPLOYER_RATE : CPP_2026.CPP2_EMPLOYER_RATE;
  const cpp2MaxEarnings = CPP_2026.QPP2_MAX_EARNINGS;
  const cpp2MaxContrib = CPP_2026.QPP2_MAX_EMPLOYEE_CONTRIBUTION;

  const ytdCpp2Earnings = Math.min(Math.max(ytdGross - maxPensionable, 0), cpp2MaxEarnings - maxPensionable);
  const currentCpp2Earnings = Math.min(Math.max(ytdGross + grossPay - maxPensionable, 0), cpp2MaxEarnings - maxPensionable);

  const ytdCpp2 = ytdCpp2Earnings * cpp2Rate;
  const totalCpp2 = currentCpp2Earnings * cpp2Rate;
  const employee2 = Math.min(Math.max(0, totalCpp2 - ytdCpp2), cpp2MaxContrib - Math.min(ytdCpp2, cpp2MaxContrib));
  const employer2 = employee2 * (cpp2EmployerRate / cpp2Rate || 0);

  return {
    employee: round2(employee),
    employer: round2(employer),
    employee2: round2(employee2),
    employer2: round2(employer2),
  };
}

/**
 * Calculate Employment Insurance premium for a pay period.
 * Quebec has a reduced rate because QPIP covers maternity/parental benefits.
 *
 * @param grossPay - Gross pay for the period
 * @param ytdGross - Year-to-date gross before this period
 * @param province - Province code (QC has reduced EI rate)
 * @returns Object with employee and employer premiums
 */
export function calculateEI(
  grossPay: number,
  ytdGross: number,
  province: string = 'QC'
): { employee: number; employer: number } {
  const isQuebec = province === 'QC';
  const employeeRate = isQuebec ? EI_2026.QC_EMPLOYEE_RATE : EI_2026.EMPLOYEE_RATE;
  const employerRate = isQuebec ? EI_2026.QC_EMPLOYER_RATE : EI_2026.EMPLOYER_RATE;
  const maxInsurable = isQuebec ? EI_2026.QC_MAX_INSURABLE : EI_2026.MAX_INSURABLE;
  const maxEmployee = isQuebec ? EI_2026.QC_MAX_EMPLOYEE : EI_2026.MAX_EMPLOYEE;
  const maxEmployer = isQuebec ? EI_2026.QC_MAX_EMPLOYER : EI_2026.MAX_EMPLOYER;

  const ytdInsurable = Math.min(ytdGross, maxInsurable);
  const currentInsurable = Math.min(ytdGross + grossPay, maxInsurable);
  const insurableThisPeriod = currentInsurable - ytdInsurable;

  const ytdEmployeePrem = ytdInsurable * employeeRate;
  const employee = Math.min(insurableThisPeriod * employeeRate, maxEmployee - Math.min(ytdEmployeePrem, maxEmployee));

  const ytdEmployerPrem = ytdInsurable * employerRate;
  const employer = Math.min(insurableThisPeriod * employerRate, maxEmployer - Math.min(ytdEmployerPrem, maxEmployer));

  return {
    employee: round2(Math.max(0, employee)),
    employer: round2(Math.max(0, employer)),
  };
}

/**
 * Calculate QPIP (Quebec Parental Insurance Plan) premium.
 * Quebec-only contribution.
 *
 * @param grossPay - Gross pay for the period
 * @param ytdGross - Year-to-date gross before this period
 * @returns Object with employee and employer premiums (0 for non-Quebec)
 */
export function calculateQPIP(
  grossPay: number,
  ytdGross: number,
  province: string = 'QC'
): { employee: number; employer: number } {
  if (province !== 'QC') return { employee: 0, employer: 0 };

  const maxInsurable = QPIP_2026.MAX_INSURABLE;
  const maxEmployee = QPIP_2026.MAX_EMPLOYEE;
  const maxEmployer = QPIP_2026.MAX_EMPLOYER;

  const ytdInsurable = Math.min(ytdGross, maxInsurable);
  const currentInsurable = Math.min(ytdGross + grossPay, maxInsurable);
  const insurableThisPeriod = currentInsurable - ytdInsurable;

  const ytdEmployeePrem = ytdInsurable * QPIP_2026.EMPLOYEE_RATE;
  const employee = Math.min(
    insurableThisPeriod * QPIP_2026.EMPLOYEE_RATE,
    maxEmployee - Math.min(ytdEmployeePrem, maxEmployee)
  );

  const ytdEmployerPrem = ytdInsurable * QPIP_2026.EMPLOYER_RATE;
  const employer = Math.min(
    insurableThisPeriod * QPIP_2026.EMPLOYER_RATE,
    maxEmployer - Math.min(ytdEmployerPrem, maxEmployer)
  );

  return {
    employee: round2(Math.max(0, employee)),
    employer: round2(Math.max(0, employer)),
  };
}

/**
 * Calculate federal income tax for a pay period using the annualization method.
 *
 * Method: Annualize the pay period income, calculate annual tax,
 * then divide by the number of pay periods to get the per-period deduction.
 *
 * @param annualizedIncome - Gross pay annualized (grossPay * payPeriods)
 * @param td1Credit - Federal TD1 personal credit amount (default: basic personal amount)
 * @param payPeriods - Number of pay periods per year (26 for biweekly, etc.)
 * @returns Federal tax for one pay period
 */
export function calculateFederalTax(
  annualizedIncome: number,
  td1Credit: number = FEDERAL_BASIC_PERSONAL_2026,
  payPeriods: number = 26
): number {
  // Taxable income after personal credit
  const taxableIncome = Math.max(0, annualizedIncome);

  let tax = 0;
  for (const bracket of FEDERAL_TAX_BRACKETS_2026) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  // Subtract non-refundable credit (15% of personal amount)
  const personalCredit = td1Credit * 0.15;
  // Also subtract CPP/QPP and EI credits (calculated elsewhere, but the basic method
  // uses the TD1 credit which includes them)
  tax = Math.max(0, tax - personalCredit);

  return round2(tax / payPeriods);
}

/**
 * Calculate provincial income tax for a pay period.
 * Currently supports Quebec (QC) with full bracket calculation.
 * Other provinces use a simplified effective rate estimate.
 *
 * @param annualizedIncome - Gross pay annualized
 * @param province - Province code
 * @param tdCredit - Provincial personal credit amount
 * @param payPeriods - Number of pay periods per year
 * @returns Provincial tax for one pay period
 */
export function calculateProvincialTax(
  annualizedIncome: number,
  province: string = 'QC',
  tdCredit: number = QC_BASIC_PERSONAL_2026,
  payPeriods: number = 26
): number {
  if (province === 'QC') {
    return calculateQuebecTax(annualizedIncome, tdCredit, payPeriods);
  }

  // Simplified estimate for other provinces (not primary focus for BioCycle)
  // Use an average effective rate of ~10% for income > personal exemption
  const taxableIncome = Math.max(0, annualizedIncome - 12_000);
  const tax = taxableIncome * 0.10;
  return round2(Math.max(0, tax) / payPeriods);
}

/**
 * Calculate Quebec provincial tax with full bracket support.
 */
function calculateQuebecTax(
  annualizedIncome: number,
  tdCredit: number = QC_BASIC_PERSONAL_2026,
  payPeriods: number = 26
): number {
  const taxableIncome = Math.max(0, annualizedIncome);

  let tax = 0;
  for (const bracket of QC_TAX_BRACKETS_2026) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  // Quebec non-refundable credit: 14% of personal amount (lowest bracket rate)
  const personalCredit = tdCredit * 0.14;
  tax = Math.max(0, tax - personalCredit);

  // Quebec abatement: Quebec residents get a 16.5% reduction on federal tax
  // (handled at the federal level, not here)

  return round2(tax / payPeriods);
}

/**
 * Calculate employer-only contributions for a payroll entry.
 * Includes: HSF, CNESST, CNT (Quebec-specific).
 *
 * @param grossPay - Gross pay for the period
 * @param province - Province code
 * @returns Object with employer-only contributions
 */
export function calculateEmployerContributions(
  grossPay: number,
  province: string = 'QC'
): { hsf: number; cnesst: number; cnt: number } {
  if (province !== 'QC') {
    return { hsf: 0, cnesst: 0, cnt: 0 };
  }

  const hsf = round2(grossPay * QC_EMPLOYER_2026.HSF_RATE);
  const cnesst = round2(grossPay * QC_EMPLOYER_2026.CNESST_RATE);
  const cnt = round2(grossPay * QC_EMPLOYER_2026.CNT_RATE);

  return { hsf, cnesst, cnt };
}

/**
 * Calculate vacation pay accrual for the period.
 *
 * @param grossPay - Gross pay for the period
 * @param rate - Vacation pay rate as a percentage (default 4%)
 * @returns Vacation pay amount
 */
export function calculateVacationPay(grossPay: number, rate: number = 4): number {
  return round2(grossPay * (rate / 100));
}

/**
 * Get the number of pay periods per year for a given frequency.
 */
export function getPayPeriods(frequency: string): number {
  switch (frequency) {
    case 'WEEKLY': return 52;
    case 'BIWEEKLY': return 26;
    case 'SEMI_MONTHLY': return 24;
    case 'MONTHLY': return 12;
    default: return 26;
  }
}

// =============================================================================
// PAYROLL ENTRY CALCULATION
// =============================================================================

interface EmployeeForCalc {
  id: string;
  province: string;
  annualSalary: Prisma.Decimal | null;
  hourlyRate: Prisma.Decimal | null;
  payFrequency: string;
  federalTdCredit: Prisma.Decimal;
  provincialTdCredit: Prisma.Decimal;
  vacationPayRate: Prisma.Decimal;
}

/**
 * Calculate all deductions for one employee in a payroll run.
 * This is the main per-employee calculation function.
 *
 * @param employee - Employee record
 * @param hoursWorked - Regular hours worked in the period
 * @param overtimeHours - Overtime hours worked
 * @param ytdGross - Year-to-date gross pay before this period
 * @returns Complete payroll entry calculation
 */
export function calculatePayrollEntry(
  employee: EmployeeForCalc,
  hoursWorked: number,
  overtimeHours: number,
  ytdGross: number
): {
  grossPay: number;
  cppContribution: number;
  eiPremium: number;
  federalTax: number;
  provincialTax: number;
  qpipPremium: number;
  employerCpp: number;
  employerEi: number;
  employerQpip: number;
  employerHst: number;
  employerWcb: number;
  vacationPay: number;
  totalDeductions: number;
  netPay: number;
  totalEmployerCost: number;
} {
  const payPeriods = getPayPeriods(employee.payFrequency);
  const province = employee.province;

  // Calculate gross pay
  let grossPay: number;
  if (employee.annualSalary && Number(employee.annualSalary) > 0) {
    // Salaried employee: annual salary / pay periods
    grossPay = round2(Number(employee.annualSalary) / payPeriods);
  } else if (employee.hourlyRate && Number(employee.hourlyRate) > 0) {
    // Hourly employee
    const regularPay = hoursWorked * Number(employee.hourlyRate);
    const otPay = overtimeHours * Number(employee.hourlyRate) * 1.5; // 1.5x overtime
    grossPay = round2(regularPay + otPay);
  } else {
    grossPay = 0;
  }

  // CPP/QPP
  const cpp = calculateCPP(grossPay, ytdGross, province);
  const cppContribution = round2(cpp.employee + cpp.employee2);
  const employerCpp = round2(cpp.employer + cpp.employer2);

  // EI
  const ei = calculateEI(grossPay, ytdGross, province);
  const eiPremium = ei.employee;
  const employerEi = ei.employer;

  // QPIP
  const qpip = calculateQPIP(grossPay, ytdGross, province);
  const qpipPremium = qpip.employee;
  const employerQpip = qpip.employer;

  // Income taxes (annualization method)
  const annualizedIncome = grossPay * payPeriods;
  const federalTdCredit = Number(employee.federalTdCredit) || FEDERAL_BASIC_PERSONAL_2026;
  const provincialTdCredit = Number(employee.provincialTdCredit) || QC_BASIC_PERSONAL_2026;

  const federalTax = calculateFederalTax(annualizedIncome, federalTdCredit, payPeriods);
  const provincialTax = calculateProvincialTax(annualizedIncome, province, provincialTdCredit, payPeriods);

  // Employer-only contributions
  const employerContrib = calculateEmployerContributions(grossPay, province);
  const employerHst = employerContrib.hsf; // HSF = Health Services Fund
  const employerWcb = round2(employerContrib.cnesst + employerContrib.cnt);

  // Vacation pay
  const vacationPay = calculateVacationPay(grossPay, Number(employee.vacationPayRate) || 4);

  // Totals
  const totalDeductions = round2(
    cppContribution + eiPremium + federalTax + provincialTax + qpipPremium
  );
  const netPay = round2(grossPay - totalDeductions);
  const totalEmployerCost = round2(
    grossPay + employerCpp + employerEi + employerQpip + employerHst + employerWcb + vacationPay
  );

  return {
    grossPay,
    cppContribution,
    eiPremium,
    federalTax,
    provincialTax,
    qpipPremium,
    employerCpp,
    employerEi,
    employerQpip,
    employerHst,
    employerWcb,
    vacationPay,
    totalDeductions,
    netPay,
    totalEmployerCost,
  };
}

// =============================================================================
// PAYROLL RUN FUNCTIONS (Database operations)
// =============================================================================

/**
 * Calculate all entries in a payroll run.
 * Fetches all active employees, computes YTD totals, and calculates deductions.
 *
 * @param payrollRunId - The payroll run to calculate
 * @returns Updated payroll run with calculated entries
 */
export async function calculatePayrollRun(payrollRunId: string) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: { entries: { include: { employee: true } } },
  });

  if (!run) throw new Error(`Payroll run ${payrollRunId} not found`);
  if (run.status !== 'DRAFT' && run.status !== 'CALCULATED') {
    throw new Error(`Cannot calculate payroll run in status ${run.status}`);
  }

  // If no entries exist yet, create entries for all active employees
  if (run.entries.length === 0) {
    const activeEmployees = await prisma.employee.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
    });

    if (activeEmployees.length === 0) {
      throw new Error('No active employees found');
    }

    // Create blank entries for each employee
    await prisma.payrollEntry.createMany({
      data: activeEmployees.map((emp) => ({
        payrollRunId,
        employeeId: emp.id,
        hoursWorked: emp.annualSalary ? 0 : 80, // Default 80h for biweekly hourly
        overtimeHours: 0,
      })),
    });
  }

  // Re-fetch entries with employees
  const entries = await prisma.payrollEntry.findMany({
    where: { payrollRunId },
    include: { employee: true },
  });

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  let totalEmployerCost = 0;

  // Calculate each entry
  for (const entry of entries) {
    const ytd = await getYTDTotals(entry.employeeId, run.periodStart);

    const calc = calculatePayrollEntry(
      entry.employee,
      Number(entry.hoursWorked),
      Number(entry.overtimeHours),
      ytd.grossPay
    );

    await prisma.payrollEntry.update({
      where: { id: entry.id },
      data: {
        grossPay: calc.grossPay,
        cppContribution: calc.cppContribution,
        eiPremium: calc.eiPremium,
        federalTax: calc.federalTax,
        provincialTax: calc.provincialTax,
        qpipPremium: calc.qpipPremium,
        employerCpp: calc.employerCpp,
        employerEi: calc.employerEi,
        employerQpip: calc.employerQpip,
        employerHst: calc.employerHst,
        employerWcb: calc.employerWcb,
        vacationPay: calc.vacationPay,
        totalDeductions: calc.totalDeductions,
        netPay: calc.netPay,
        totalEmployerCost: calc.totalEmployerCost,
      },
    });

    totalGross += calc.grossPay;
    totalDeductions += calc.totalDeductions;
    totalNet += calc.netPay;
    totalEmployerCost += calc.totalEmployerCost;
  }

  // Update run totals and status
  const updated = await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: 'CALCULATED',
      totalGross: round2(totalGross),
      totalDeductions: round2(totalDeductions),
      totalNet: round2(totalNet),
      totalEmployerCost: round2(totalEmployerCost),
    },
    include: {
      entries: {
        include: { employee: true },
      },
    },
  });

  logger.info('Payroll run calculated', {
    payrollRunId,
    employeeCount: entries.length,
    totalGross: round2(totalGross),
    totalNet: round2(totalNet),
  });

  return updated;
}

/**
 * Approve a payroll run and optionally post a journal entry.
 *
 * @param payrollRunId - The payroll run to approve
 * @param approvedBy - Email/name of the approver
 * @returns Updated payroll run
 */
export async function approvePayrollRun(payrollRunId: string, approvedBy: string) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
  });

  if (!run) throw new Error(`Payroll run ${payrollRunId} not found`);
  if (run.status !== 'CALCULATED') {
    throw new Error(`Cannot approve payroll run in status ${run.status}. Must be CALCULATED first.`);
  }

  const updated = await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: 'APPROVED',
      approvedBy,
      approvedAt: new Date(),
    },
    include: {
      entries: { include: { employee: true } },
    },
  });

  logger.info('Payroll run approved', {
    payrollRunId,
    approvedBy,
    totalGross: Number(updated.totalGross),
    totalNet: Number(updated.totalNet),
  });

  return updated;
}

/**
 * Generate pay stubs for all entries in a payroll run.
 *
 * @param payrollRunId - The payroll run to generate stubs for
 * @returns Array of created pay stubs
 */
export async function generatePayStubs(payrollRunId: string) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: {
      entries: { include: { employee: true } },
    },
  });

  if (!run) throw new Error(`Payroll run ${payrollRunId} not found`);
  if (run.status !== 'APPROVED' && run.status !== 'PAID') {
    throw new Error('Pay stubs can only be generated for APPROVED or PAID runs');
  }

  const stubs = [];

  for (const entry of run.entries) {
    const ytd = await getYTDTotals(entry.employeeId, new Date(run.periodEnd.getTime() + 1));

    const deductionDetails = {
      cppContribution: Number(entry.cppContribution),
      eiPremium: Number(entry.eiPremium),
      federalTax: Number(entry.federalTax),
      provincialTax: Number(entry.provincialTax),
      qpipPremium: Number(entry.qpipPremium),
      vacationPay: Number(entry.vacationPay),
      otherDeductions: Number(entry.otherDeductions),
      otherBenefits: Number(entry.otherBenefits),
      otherDeductionsDesc: entry.otherDeductionsDesc,
      otherBenefitsDesc: entry.otherBenefitsDesc,
      employerCpp: Number(entry.employerCpp),
      employerEi: Number(entry.employerEi),
      employerQpip: Number(entry.employerQpip),
      employerHst: Number(entry.employerHst),
      employerWcb: Number(entry.employerWcb),
    };

    const stub = await prisma.payStub.create({
      data: {
        employeeId: entry.employeeId,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        payDate: run.payDate,
        grossPay: entry.grossPay,
        totalDeductions: entry.totalDeductions,
        netPay: entry.netPay,
        ytdGross: round2(ytd.grossPay + Number(entry.grossPay)),
        ytdDeductions: round2(ytd.totalDeductions + Number(entry.totalDeductions)),
        ytdNet: round2(ytd.netPay + Number(entry.netPay)),
        deductionDetails,
      },
    });

    stubs.push(stub);
  }

  logger.info('Pay stubs generated', { payrollRunId, count: stubs.length });
  return stubs;
}

/**
 * Get year-to-date totals for an employee as of a specific date.
 *
 * @param employeeId - The employee ID
 * @param asOfDate - Calculate YTD up to (but not including) this date
 * @returns YTD totals
 */
export async function getYTDTotals(
  employeeId: string,
  asOfDate: Date = new Date()
): Promise<{
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  cppContribution: number;
  eiPremium: number;
  qpipPremium: number;
  federalTax: number;
  provincialTax: number;
}> {
  const yearStart = new Date(asOfDate.getFullYear(), 0, 1);

  const entries = await prisma.payrollEntry.findMany({
    where: {
      employeeId,
      payrollRun: {
        periodStart: { gte: yearStart },
        periodEnd: { lt: asOfDate },
        status: { in: ['CALCULATED', 'APPROVED', 'PAID'] },
        deletedAt: null,
      },
    },
  });

  return {
    grossPay: round2(entries.reduce((sum, e) => sum + Number(e.grossPay), 0)),
    totalDeductions: round2(entries.reduce((sum, e) => sum + Number(e.totalDeductions), 0)),
    netPay: round2(entries.reduce((sum, e) => sum + Number(e.netPay), 0)),
    cppContribution: round2(entries.reduce((sum, e) => sum + Number(e.cppContribution), 0)),
    eiPremium: round2(entries.reduce((sum, e) => sum + Number(e.eiPremium), 0)),
    qpipPremium: round2(entries.reduce((sum, e) => sum + Number(e.qpipPremium), 0)),
    federalTax: round2(entries.reduce((sum, e) => sum + Number(e.federalTax), 0)),
    provincialTax: round2(entries.reduce((sum, e) => sum + Number(e.provincialTax), 0)),
  };
}

// =============================================================================
// REPORTING FUNCTIONS
// =============================================================================

/**
 * Generate T4 slip data for an employee for a given tax year.
 * T4 (Statement of Remuneration Paid) is the federal information return.
 *
 * @param employeeId - Employee ID
 * @param year - Tax year
 * @returns T4 slip data
 */
export async function generateT4Data(employeeId: string, year: number) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error(`Employee ${employeeId} not found`);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const ytd = await getYTDTotals(employeeId, yearEnd);

  // Get YTD from entries in paid/approved runs within the year
  const entries = await prisma.payrollEntry.findMany({
    where: {
      employeeId,
      payrollRun: {
        periodStart: { gte: yearStart },
        periodEnd: { lt: yearEnd },
        status: { in: ['APPROVED', 'PAID'] },
        deletedAt: null,
      },
    },
  });

  const totalEmployerCpp = round2(entries.reduce((s, e) => s + Number(e.employerCpp), 0));
  const totalEmployerEi = round2(entries.reduce((s, e) => s + Number(e.employerEi), 0));
  const totalVacationPay = round2(entries.reduce((s, e) => s + Number(e.vacationPay), 0));

  return {
    employee: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      sin: employee.sin ? `***-***-${employee.sin.slice(-3)}` : 'N/A',
      address: `${employee.province}, ${employee.country}`,
    },
    year,
    box14_employmentIncome: ytd.grossPay,
    box16_cppContributions: ytd.cppContribution,
    box18_eiPremiums: ytd.eiPremium,
    box22_incomeTaxDeducted: round2(ytd.federalTax + ytd.provincialTax),
    box24_eiInsurableEarnings: Math.min(ytd.grossPay, EI_2026.QC_MAX_INSURABLE),
    box26_cppPensionableEarnings: Math.min(ytd.grossPay, CPP_2026.MAX_PENSIONABLE_EARNINGS),
    box44_unionDues: 0,
    box46_charitableDonations: 0,
    box50_rppContributions: 0,
    box52_pensionAdjustment: 0,
    box55_employerQpip: round2(entries.reduce((s, e) => s + Number(e.employerQpip), 0)),
    box56_qpipInsurableEarnings: Math.min(ytd.grossPay, QPIP_2026.MAX_INSURABLE),
    vacationPay: totalVacationPay,
    employerCpp: totalEmployerCpp,
    employerEi: totalEmployerEi,
    province: employee.province,
  };
}

/**
 * Generate RL-1 slip data for a Quebec employee for a given tax year.
 * RL-1 (Releve 1) is the Quebec provincial information return.
 *
 * @param employeeId - Employee ID
 * @param year - Tax year
 * @returns RL-1 slip data
 */
export async function generateRL1Data(employeeId: string, year: number) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error(`Employee ${employeeId} not found`);
  if (employee.province !== 'QC') {
    throw new Error('RL-1 is only for Quebec employees');
  }

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const ytd = await getYTDTotals(employeeId, yearEnd);

  const entries = await prisma.payrollEntry.findMany({
    where: {
      employeeId,
      payrollRun: {
        periodStart: { gte: yearStart },
        periodEnd: { lt: yearEnd },
        status: { in: ['APPROVED', 'PAID'] },
        deletedAt: null,
      },
    },
  });

  const totalQpipEmployee = round2(entries.reduce((s, e) => s + Number(e.qpipPremium), 0));
  const totalQpipEmployer = round2(entries.reduce((s, e) => s + Number(e.employerQpip), 0));

  return {
    employee: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      sin: employee.sin ? `***-***-${employee.sin.slice(-3)}` : 'N/A',
    },
    year,
    caseA_revenusEmploi: ytd.grossPay,          // Employment income
    caseB_cotisationsRRQ: ytd.cppContribution,   // QPP contributions
    caseC_cotisationsAE: ytd.eiPremium,          // EI premiums
    caseE_impotQuebec: ytd.provincialTax,        // Quebec income tax deducted
    caseG_salaireBrutRRQ: Math.min(ytd.grossPay, CPP_2026.MAX_PENSIONABLE_EARNINGS),
    caseH_cotisationsRQAP: totalQpipEmployee,    // QPIP employee premium
    caseI_salaireRQAP: Math.min(ytd.grossPay, QPIP_2026.MAX_INSURABLE),
    caseJ_regimePriveAssurance: 0,
    caseK_voyages: 0,
    caseL_autresAvantages: 0,
    caseO_autresRevenus: 0,
    cotisationsRQAPEmployeur: totalQpipEmployer,
  };
}

/**
 * Get a payroll summary report for a given period.
 *
 * @param periodStart - Start of reporting period
 * @param periodEnd - End of reporting period
 * @returns Summary report data
 */
export async function getPayrollSummary(periodStart: Date, periodEnd: Date) {
  const runs = await prisma.payrollRun.findMany({
    where: {
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
      status: { in: ['CALCULATED', 'APPROVED', 'PAID'] },
      deletedAt: null,
    },
    include: {
      entries: {
        include: { employee: true },
      },
    },
    orderBy: { periodStart: 'asc' },
  });

  const allEntries = runs.flatMap((r) => r.entries);

  return {
    period: {
      start: periodStart.toISOString().split('T')[0],
      end: periodEnd.toISOString().split('T')[0],
    },
    runsCount: runs.length,
    employeeCount: new Set(allEntries.map((e) => e.employeeId)).size,
    totals: {
      grossPay: round2(allEntries.reduce((s, e) => s + Number(e.grossPay), 0)),
      totalDeductions: round2(allEntries.reduce((s, e) => s + Number(e.totalDeductions), 0)),
      netPay: round2(allEntries.reduce((s, e) => s + Number(e.netPay), 0)),
      cppContribution: round2(allEntries.reduce((s, e) => s + Number(e.cppContribution), 0)),
      eiPremium: round2(allEntries.reduce((s, e) => s + Number(e.eiPremium), 0)),
      federalTax: round2(allEntries.reduce((s, e) => s + Number(e.federalTax), 0)),
      provincialTax: round2(allEntries.reduce((s, e) => s + Number(e.provincialTax), 0)),
      qpipPremium: round2(allEntries.reduce((s, e) => s + Number(e.qpipPremium), 0)),
      employerCpp: round2(allEntries.reduce((s, e) => s + Number(e.employerCpp), 0)),
      employerEi: round2(allEntries.reduce((s, e) => s + Number(e.employerEi), 0)),
      employerQpip: round2(allEntries.reduce((s, e) => s + Number(e.employerQpip), 0)),
      employerHst: round2(allEntries.reduce((s, e) => s + Number(e.employerHst), 0)),
      employerWcb: round2(allEntries.reduce((s, e) => s + Number(e.employerWcb), 0)),
      vacationPay: round2(allEntries.reduce((s, e) => s + Number(e.vacationPay), 0)),
      totalEmployerCost: round2(allEntries.reduce((s, e) => s + Number(e.totalEmployerCost), 0)),
    },
    runs: runs.map((r) => ({
      id: r.id,
      periodStart: r.periodStart.toISOString().split('T')[0],
      periodEnd: r.periodEnd.toISOString().split('T')[0],
      payDate: r.payDate.toISOString().split('T')[0],
      status: r.status,
      totalGross: Number(r.totalGross),
      totalNet: Number(r.totalNet),
      totalEmployerCost: Number(r.totalEmployerCost),
      employeeCount: r.entries.length,
    })),
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
