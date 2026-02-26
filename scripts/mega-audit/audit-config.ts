/**
 * MEGA-AUDIT CONFIGURATION
 * Defines domains, dimensions, severity thresholds, and scoring rules.
 */

// =====================================================
// DIMENSIONS (each audited independently per function)
// =====================================================

export type AuditDimension =
  | 'security'
  | 'performance'
  | 'reliability'
  | 'maintainability'
  | 'compliance';

export const DIMENSIONS: AuditDimension[] = [
  'security',
  'performance',
  'reliability',
  'maintainability',
  'compliance',
];

// =====================================================
// SEVERITY & SCORING
// =====================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
  info: 0,
};

/** Score thresholds — lower is better (weighted sum of findings) */
export const GRADE_THRESHOLDS: { maxScore: number; grade: Grade }[] = [
  { maxScore: 0, grade: 'A' },
  { maxScore: 3, grade: 'B' },
  { maxScore: 8, grade: 'C' },
  { maxScore: 15, grade: 'D' },
  { maxScore: Infinity, grade: 'F' },
];

export function scoreToGrade(weightedScore: number): Grade {
  for (const t of GRADE_THRESHOLDS) {
    if (weightedScore <= t.maxScore) return t.grade;
  }
  return 'F';
}

// =====================================================
// FEATURE DOMAINS (group functions by business area)
// =====================================================

export interface DomainConfig {
  name: string;
  /** Glob patterns to include */
  include: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Dimensions to emphasize (weight ×2) */
  emphasize?: AuditDimension[];
}

export const DOMAINS: Record<string, DomainConfig> = {
  auth: {
    name: 'Authentication & Authorization',
    include: [
      'src/lib/auth*.ts',
      'src/lib/brute-force*.ts',
      'src/lib/mfa*.ts',
      'src/lib/session-security*.ts',
      'src/lib/security*.ts',
      'src/lib/token-encryption*.ts',
      'src/app/api/auth/**/*.ts',
      'src/app/auth/**/*.tsx',
    ],
    emphasize: ['security', 'compliance'],
  },
  payment: {
    name: 'Payment & Billing',
    include: [
      'src/lib/stripe*.ts',
      'src/lib/payment*.ts',
      'src/lib/invoice*.ts',
      'src/app/api/checkout/**/*.ts',
      'src/app/api/webhooks/stripe/**/*.ts',
      'src/app/api/admin/invoices/**/*.ts',
    ],
    emphasize: ['security', 'reliability'],
  },
  accounting: {
    name: 'Accounting & Journal',
    include: [
      'src/lib/accounting*.ts',
      'src/lib/journal*.ts',
      'src/lib/tax*.ts',
      'src/app/api/admin/accounting/**/*.ts',
      'src/app/api/admin/journal/**/*.ts',
    ],
    emphasize: ['reliability', 'compliance'],
  },
  ecommerce: {
    name: 'E-commerce (Products, Cart, Orders)',
    include: [
      'src/lib/product*.ts',
      'src/lib/cart*.ts',
      'src/lib/order*.ts',
      'src/lib/inventory*.ts',
      'src/app/api/products/**/*.ts',
      'src/app/api/cart/**/*.ts',
      'src/app/api/orders/**/*.ts',
    ],
    emphasize: ['performance', 'reliability'],
  },
  admin: {
    name: 'Admin Dashboard',
    include: [
      'src/app/admin/**/*.tsx',
      'src/app/api/admin/**/*.ts',
    ],
    exclude: [
      'src/app/api/admin/accounting/**/*.ts',
      'src/app/api/admin/journal/**/*.ts',
      'src/app/api/admin/invoices/**/*.ts',
    ],
    emphasize: ['security', 'maintainability'],
  },
  user: {
    name: 'User-facing (Account, Dashboard)',
    include: [
      'src/app/dashboard/**/*.tsx',
      'src/app/(shop)/account/**/*.tsx',
      'src/app/api/user/**/*.ts',
      'src/app/api/account/**/*.ts',
    ],
    emphasize: ['performance', 'reliability'],
  },
  api_core: {
    name: 'Core API Infrastructure',
    include: [
      'src/lib/db*.ts',
      'src/lib/prisma*.ts',
      'src/lib/logger*.ts',
      'src/lib/email*.ts',
      'src/lib/cache*.ts',
      'src/lib/rate-limit*.ts',
      'src/middleware*.ts',
    ],
    emphasize: ['security', 'performance'],
  },
  i18n: {
    name: 'Internationalization',
    include: [
      'src/i18n/**/*.ts',
      'src/i18n/**/*.tsx',
      'src/hooks/useTranslations*.ts',
    ],
    emphasize: ['maintainability'],
  },
};

// =====================================================
// CONFIDENCE THRESHOLDS (filter noise)
// =====================================================

/** Minimum confidence to report a finding */
export const MIN_CONFIDENCE = 0.6;

/** Minimum confidence for a finding to be auto-fixable */
export const AUTO_FIX_CONFIDENCE = 0.9;

// =====================================================
// OUTPUT CONFIG
// =====================================================

export const OUTPUT_DIR = '.audit_results/mega-audit';
export const REPORT_JSON = 'audit-report.json';
export const REPORT_MD = 'audit-report.md';
export const BASELINE_FILE = 'audit-baseline.json';

// =====================================================
// FINDING STRUCTURE
// =====================================================

export interface AuditFinding {
  id: string;
  dimension: AuditDimension;
  severity: Severity;
  confidence: number;
  title: string;
  description: string;
  file: string;
  line: number;
  endLine?: number;
  codeSnippet?: string;
  suggestedFix?: string;
  cweId?: string;
  owaspCategory?: string;
  references?: string[];
}

export interface FunctionAuditResult {
  function: string;
  file: string;
  line: number;
  endLine: number;
  domain: string;
  dimensions: Record<AuditDimension, {
    score: Grade;
    weightedScore: number;
    findings: AuditFinding[];
    confidence: number;
  }>;
  overallScore: Grade;
  overallWeightedScore: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
}

export interface AuditReport {
  generatedAt: string;
  projectRoot: string;
  gitCommit?: string;
  totalFunctions: number;
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byDimension: Record<AuditDimension, { grade: Grade; findingsCount: number }>;
  byDomain: Record<string, { grade: Grade; functionsAudited: number; findingsCount: number }>;
  functions: FunctionAuditResult[];
  topCritical: AuditFinding[];
}
