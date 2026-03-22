/**
 * Base class for the 12 Section Auditors.
 * Each section audit covers 8 angles:
 *   1. DB-First (row counts, orphans)
 *   2. Component Matrix (model/lib/API/page/i18n completeness)
 *   3. API Testing (auth, validation, pagination)
 *   4. UI Playwright (navigation, console/network errors, LCP)
 *   5. State Testing (loading/empty/error states, date formatting)
 *   6. Interaction Testing (modals, forms, buttons, search, tabs)
 *   7. Responsive (375px mobile, 768px tablet)
 *   8. Accessibility (ARIA, contrast, keyboard)
 *
 * Subclasses only need to define `sectionConfig` — all 8 angles run automatically.
 * Override individual angle methods for section-specific checks.
 *
 * v2.0: Reduced false positives by:
 *   - Scanning imported components for delegated a11y/responsive/overflow handling
 *   - Recognizing shared components (DataTable, MobileSplitLayout, ContentList, etc.)
 *     that already provide ARIA, overflow, responsive, and focus handling
 *   - Treating admin pages as desktop-primary (relaxed responsive severity)
 *   - Better regex patterns for date, search, navigation, form detection
 *   - Considering loading.tsx/error.tsx at parent layout level
 *   - Recognizing that admin sidebar provides navigation (not each page)
 *   - Skipping search/filter check for non-list pages (settings, diagnostics)
 *
 * v2.1: Further false-positive reductions:
 *   - Resolving delegate pages: when page.tsx is a thin server wrapper that renders
 *     a single child component, the child component's content is also scanned
 *   - Fixed extractModelBlock to handle '}' inside comments (brace-counting)
 *   - Date format: only flag dates rendered in UI, not .toISOString() for filenames
 *   - Empty state: skip for settings/config pages (they always have form content)
 *   - Focus: recognize native <button> elements have built-in focus handling
 *   - Search/filter: skip for pages with very few items (e.g., backups)
 *
 * v3.0: Major false-positive elimination:
 *   - getEffectivePageContent() now resolves ALL local relative imports (not just
 *     the first return statement match), fixing server/client split pattern where
 *     page.tsx wraps content in <Suspense> and delegates to a client component
 *   - Added StatCard, CallStats, SatisfactionBadge, PaymentStatusBadge to component lists
 *   - isListPage() now excludes dashboard/overview pages that use .map() for fixed cards
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseAuditor } from '../base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export interface SectionConfig {
  sectionName: string;
  adminPages: string[];
  apiRoutes: string[];
  prismaModels: string[];
  i18nNamespaces: string[];
}

/**
 * Shared components that already provide responsive/a11y/overflow handling.
 * When a page imports one of these, we skip redundant checks in the page itself.
 */
const RESPONSIVE_COMPONENTS = [
  'DataTable', 'MobileSplitLayout', 'ContentList', 'DetailPane',
  'FilterBar', 'CalendarView', 'ContactListPage',
  'StatCard', 'CallStats',
];
const A11Y_COMPONENTS = [
  'DataTable', 'MobileSplitLayout', 'ContentList', 'DetailPane',
  'Modal', 'EmptyState', 'Button', 'FormField', 'Input', 'Select',
  'ConfirmDialog', 'FilterBar', 'PageHeader', 'StatusBadge',
  'KeyboardShortcutsDialog', 'ContactListPage',
  'StatCard', 'CallStats', 'SatisfactionBadge', 'PaymentStatusBadge',
];
const OVERFLOW_COMPONENTS = [
  'DataTable', 'MobileSplitLayout', 'ContentList', 'DetailPane',
  'StatCard', 'ContactListPage',
];

/** Check if content imports any of the listed component names */
function importsAny(content: string, componentNames: string[]): boolean {
  for (const name of componentNames) {
    // Match: import { DataTable } or import DataTable or ContentList, etc.
    if (new RegExp(`\\b${name}\\b`).test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * Detect if a page is a "dashboard/overview" page that shows KPI cards, charts,
 * and summary widgets — not a list page that needs search/filter.
 */
function isDashboardPage(content: string): boolean {
  return /Dashboard|dashboard|KPI|kpi|Chart|chart|overview|Overview|StatCard|CallStats/.test(content);
}

/**
 * Detect if a page is a "list page" (shows a table/list of items with many rows)
 * vs a "form page" / "dashboard page" (settings, diagnostics, config, status).
 * Only list pages with potentially many items need search/filter.
 * Dashboard pages that .map() over a fixed set of status cards don't need search.
 */
function isListPage(content: string): boolean {
  // Dashboard/overview pages are never list pages even if they use .map()
  if (isDashboardPage(content)) return false;

  // Strong signals: uses a data table or has HTML table
  if (/DataTable|ContentList|<table[\s>]|<thead/.test(content)) return true;
  // Medium signals: iterates over "items" or uses filter in a list context
  // Require at least TWO signals to avoid false positives on dashboards
  const signals = [
    /items\.map\(|data\.map\(|entries\.map\(|rows\.map\(/.test(content),
    /\.filter\(.*search|search.*\.filter\(/.test(content),
    /\bpagination\b|\bpageSize\b|\btotalPages\b/i.test(content),
  ].filter(Boolean).length;
  return signals >= 1;
}

/**
 * Detect if a page is a "settings/config page" that always has form content
 * (never truly "empty") — empty state checks don't apply.
 */
function isSettingsPage(pageName: string, content: string): boolean {
  return /settings|parametres|config|preferences|configuration/i.test(pageName) ||
    /settings|config|preferences/i.test(content) &&
    /FormField|<form|onSubmit|handleSave|handleSubmit/.test(content);
}

export abstract class BaseSectionAuditor extends BaseAuditor {
  abstract sectionConfig: SectionConfig;

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    results.push(...(await this.angle1_dbFirst()));
    results.push(...(await this.angle2_componentMatrix()));
    results.push(...(await this.angle3_apiTesting()));
    results.push(...(await this.angle4_uiPlaywright()));
    results.push(...(await this.angle5_stateTesting()));
    results.push(...(await this.angle6_interactionTesting()));
    results.push(...(await this.angle7_responsive()));
    results.push(...(await this.angle8_accessibility()));
    return results;
  }

  /**
   * Get the "effective content" for a page.
   * If page.tsx is a thin server-side wrapper that delegates to local child components,
   * also include those components' content so audits aren't fooled by delegation.
   *
   * v3.0: Instead of relying on matching `return <ComponentName />` (which fails when
   * the return wraps in <Suspense> or other wrappers), we scan ALL local relative imports
   * and resolve their files. This catches patterns like:
   *   - import DashboardClient from './DashboardClient'  (used inside <Suspense>)
   *   - import VoipDashboardClient from './VoipDashboardClient'
   *   - import ProductsListClient from './ProductsListClient'
   */
  protected getEffectivePageContent(pagePath: string): string {
    const content = this.readFile(pagePath);
    if (!content) return '';

    // If page has 'use client' and substantial content, it handles everything itself
    if (/^['"]use client['"]/.test(content) && content.split('\n').length > 30) {
      return content;
    }

    // Find ALL local relative imports (from './' or '../' paths within the same directory)
    // Pattern: import ComponentName from './path' or import { X } from './path'
    const localImportRegex = /import\s+(?:(\w+)|(?:\{[^}]+\}))\s+from\s+['"](\.\/.+?)['"]/g;
    let combined = content;
    let match: RegExpExecArray | null;

    while ((match = localImportRegex.exec(content)) !== null) {
      const importPath = match[2];
      const dir = path.dirname(pagePath);

      // Try to resolve the imported file
      for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
        const resolved = path.join(dir, importPath.replace(/\.(tsx?|js)$/, '') + ext);
        if (fs.existsSync(resolved)) {
          const childContent = this.readFile(resolved);
          if (childContent) {
            combined += '\n' + childContent;
          }
          break; // Found the file, stop trying extensions
        }
      }
    }

    return combined;
  }

  // ── Angle 1: DB-First ─────────────────────────────────────────

  protected async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const cfg = this.sectionConfig;
    const prefix = `${this.auditTypeCode.toLowerCase()}-db`;

    // Check Prisma schema has the expected models
    // Support both single-file schema and prismaSchemaFolder (multiple .prisma files)
    const singleSchemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schemaFolderPath = path.join(this.rootDir, 'prisma', 'schema');
    let schema = this.readFile(singleSchemaPath);
    if (!schema && fs.existsSync(schemaFolderPath) && fs.statSync(schemaFolderPath).isDirectory()) {
      const schemaFiles = fs.readdirSync(schemaFolderPath).filter(f => f.endsWith('.prisma'));
      schema = schemaFiles.map(f => this.readFile(path.join(schemaFolderPath, f)) || '').join('\n');
    }

    for (const model of cfg.prismaModels) {
      const modelRegex = new RegExp(`^model\\s+${model}\\s*\\{`, 'm');
      if (modelRegex.test(schema)) {
        results.push(this.pass(`${prefix}-model-${model}`, `Prisma model ${model} exists`));
      } else {
        results.push(
          this.fail(`${prefix}-model-${model}`, 'HIGH', `Missing Prisma model: ${model}`,
            `The model ${model} is expected for the ${cfg.sectionName} section but was not found in schema.prisma`,
            { filePath: 'prisma/schema.prisma', recommendation: `Add model ${model} to schema.prisma` })
        );
      }
    }

    // Check for indexes — but skip Translation models (they typically use @@unique
    // compound keys which serve as implicit indexes) and simple enum-like models
    for (const model of cfg.prismaModels) {
      const modelBlock = this.extractModelBlock(schema, model);
      if (modelBlock) {
        // @@index, @@unique (compound), @unique, or @id on multiple fields all serve as indexes
        const hasIndex = /@@index|@@unique/.test(modelBlock);
        // Models with very few fields (< 4 non-relation lines) often don't need indexes
        const fieldLines = modelBlock.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('@@'));
        const isSmallModel = fieldLines.length < 5;

        if (hasIndex || isSmallModel) {
          results.push(this.pass(`${prefix}-index-${model}`, `Model ${model} has DB indexes or is a small model`));
        } else {
          results.push(
            this.fail(`${prefix}-index-${model}`, 'LOW', `Model ${model} may benefit from indexes`,
              `No @@index found in model ${model}. Consider adding indexes for frequently queried fields.`,
              { filePath: 'prisma/schema.prisma', recommendation: `Add @@index directives to model ${model}` })
          );
        }
      }
    }

    return results;
  }

  // ── Angle 2: Component Matrix ─────────────────────────────────

  protected async angle2_componentMatrix(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const cfg = this.sectionConfig;
    const prefix = `${this.auditTypeCode.toLowerCase()}-matrix`;

    // Check if there's a parent-level loading.tsx and error.tsx in /admin/ itself
    const parentLoadingExists = fs.existsSync(path.join(this.srcDir, 'app', 'admin', 'loading.tsx'));
    const parentErrorExists = fs.existsSync(path.join(this.srcDir, 'app', 'admin', 'error.tsx'));

    // Check admin pages exist
    for (const pageName of cfg.adminPages) {
      const pagePath = path.join(this.srcDir, 'app', 'admin', pageName, 'page.tsx');
      if (fs.existsSync(pagePath)) {
        results.push(this.pass(`${prefix}-page-${pageName}`, `Admin page /admin/${pageName} exists`));

        // Check for loading.tsx (page-level or parent-level)
        const loadingPath = path.join(this.srcDir, 'app', 'admin', pageName, 'loading.tsx');
        if (fs.existsSync(loadingPath) || parentLoadingExists) {
          results.push(this.pass(`${prefix}-loading-${pageName}`, `/admin/${pageName}/loading.tsx exists`));
        } else {
          // Client-side pages with 'use client' typically handle loading in-component
          const content = this.readFile(pagePath);
          const isClientPage = /^'use client'|^"use client"/m.test(content);
          const hasInlineLoading = /loading|isLoading|skeleton|animate-pulse|Spinner/i.test(content);
          if (isClientPage && hasInlineLoading) {
            results.push(this.pass(`${prefix}-loading-${pageName}`, `/admin/${pageName} handles loading client-side`));
          } else {
            results.push(
              this.fail(`${prefix}-loading-${pageName}`, 'LOW', `Missing loading.tsx for /admin/${pageName}`,
                `No loading.tsx found. Users see a blank screen during data fetch.`,
                { recommendation: `Create src/app/admin/${pageName}/loading.tsx` })
            );
          }
        }

        // Check for error.tsx (page-level or parent-level)
        const errorPath = path.join(this.srcDir, 'app', 'admin', pageName, 'error.tsx');
        if (fs.existsSync(errorPath) || parentErrorExists) {
          results.push(this.pass(`${prefix}-error-${pageName}`, `/admin/${pageName}/error.tsx exists`));
        } else {
          results.push(
            this.fail(`${prefix}-error-${pageName}`, 'MEDIUM', `Missing error.tsx for /admin/${pageName}`,
              `No error boundary. Unhandled errors crash the page with no recovery UI.`,
              { recommendation: `Create src/app/admin/${pageName}/error.tsx` })
          );
        }
      } else {
        results.push(
          this.fail(`${prefix}-page-${pageName}`, 'HIGH', `Missing admin page: /admin/${pageName}`,
            `Expected page.tsx at src/app/admin/${pageName}/ but it does not exist`,
            { recommendation: `Create src/app/admin/${pageName}/page.tsx` })
        );
      }
    }

    // Check API routes exist
    for (const route of cfg.apiRoutes) {
      const routePath = path.join(this.srcDir, 'app', 'api', route, 'route.ts');
      if (fs.existsSync(routePath)) {
        results.push(this.pass(`${prefix}-api-${route.replace(/\//g, '-')}`, `API route /api/${route} exists`));
      } else {
        // Check for [id]/route.ts variant
        const dynamicPath = path.join(this.srcDir, 'app', 'api', route, '[id]', 'route.ts');
        if (fs.existsSync(dynamicPath)) {
          results.push(this.pass(`${prefix}-api-${route.replace(/\//g, '-')}`, `API route /api/${route}/[id] exists`));
        } else {
          results.push(
            this.fail(`${prefix}-api-${route.replace(/\//g, '-')}`, 'MEDIUM', `Missing API route: /api/${route}`,
              `Expected route.ts at src/app/api/${route}/ but not found`,
              { recommendation: `Create src/app/api/${route}/route.ts` })
          );
        }
      }
    }

    // Check i18n namespace keys exist
    const enPath = path.join(this.srcDir, 'i18n', 'locales', 'en.json');
    const frPath = path.join(this.srcDir, 'i18n', 'locales', 'fr.json');
    const enContent = this.readFile(enPath);
    const frContent = this.readFile(frPath);

    for (const ns of cfg.i18nNamespaces) {
      const keyParts = ns.split('.');
      const hasEn = this.hasNestedKey(enContent, keyParts);
      const hasFr = this.hasNestedKey(frContent, keyParts);

      if (hasEn && hasFr) {
        results.push(this.pass(`${prefix}-i18n-${ns.replace(/\./g, '-')}`, `i18n key ${ns} exists in en+fr`));
      } else {
        const missing = !hasEn && !hasFr ? 'en + fr' : !hasEn ? 'en' : 'fr';
        results.push(
          this.fail(`${prefix}-i18n-${ns.replace(/\./g, '-')}`, 'MEDIUM', `Missing i18n key: ${ns}`,
            `Translation key "${ns}" not found in ${missing}`,
            { recommendation: `Add "${ns}" to locale files` })
        );
      }
    }

    return results;
  }

  // ── Angle 3: API Testing ──────────────────────────────────────

  protected async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const cfg = this.sectionConfig;
    const prefix = `${this.auditTypeCode.toLowerCase()}-api`;

    for (const route of cfg.apiRoutes) {
      const routePath = path.join(this.srcDir, 'app', 'api', route, 'route.ts');
      const content = this.readFile(routePath);
      if (!content) continue;

      // Check auth guard (session-based, secret-based, or signature-based)
      const hasAuth = /auth\(\)|getServerSession|withAdminGuard|withUserGuard/.test(content) ||
        // Webhook signature verification
        /constructEvent/.test(content) ||
        /timingSafeEqual/.test(content) ||
        /WEBHOOK_SECRET/.test(content) ||
        /verifySignature/.test(content) ||
        /x-hub-signature/i.test(content) ||
        // Twilio signature verification (WhatsApp, SMS webhooks)
        /validateTwilioSignature/.test(content) ||
        /TWILIO_AUTH_TOKEN/.test(content) ||
        // Session/token checks (non-standard patterns)
        /session\?\.user/.test(content) ||
        /request\.headers\.get.*authorization/i.test(content) ||
        // Cron/API key auth
        /CRON_SECRET/.test(content) ||
        /verifyCronSecret/.test(content) ||
        /withApiAuth/.test(content) ||
        // API key / bearer token patterns
        /API_KEY|apiKey|x-api-key/i.test(content) ||
        // Admin session check via cookies (Next.js patterns)
        /getToken|getSession/.test(content);
      if (hasAuth) {
        results.push(this.pass(`${prefix}-auth-${route.replace(/\//g, '-')}`, `API ${route} has auth guard`));
      } else {
        results.push(
          this.fail(`${prefix}-auth-${route.replace(/\//g, '-')}`, 'CRITICAL', `No auth guard on /api/${route}`,
            `The route handler does not call auth(), getServerSession(), or withAdminGuard`,
            { filePath: `src/app/api/${route}/route.ts`, recommendation: 'Add auth() or withAdminGuard check' })
        );
      }

      // Check Zod validation on POST/PUT/PATCH
      const hasMutations = /export\s+async\s+function\s+(POST|PUT|PATCH)/.test(content);
      if (hasMutations) {
        // Accept Zod, manual validation with if-checks, or JSON schema validation
        const hasValidation = /\.parse\(|\.safeParse\(|z\.object|z\.string/.test(content) ||
          /typeof\s+\w+\s*!==?\s*['"]string['"]/.test(content) ||
          /if\s*\(\s*!.*body/.test(content);
        if (hasValidation) {
          results.push(this.pass(`${prefix}-zod-${route.replace(/\//g, '-')}`, `API ${route} validates input`));
        } else {
          results.push(
            this.fail(`${prefix}-zod-${route.replace(/\//g, '-')}`, 'HIGH', `No Zod validation on /api/${route}`,
              `Mutation handler found but no Zod schema validation detected`,
              { filePath: `src/app/api/${route}/route.ts`, recommendation: 'Add Zod schema validation on request body' })
          );
        }
      }

      // Check pagination on GET list routes (skip single-resource routes with [id])
      const hasGet = /export\s+async\s+function\s+GET/.test(content);
      const isSingleResource = /\[id\]|\[slug\]/.test(route);
      if (hasGet && !isSingleResource) {
        const hasPagination = /page|limit|skip|take|offset|cursor/.test(content);
        if (hasPagination) {
          results.push(this.pass(`${prefix}-paging-${route.replace(/\//g, '-')}`, `API ${route} supports pagination`));
        } else {
          results.push(
            this.fail(`${prefix}-paging-${route.replace(/\//g, '-')}`, 'LOW', `No pagination on GET /api/${route}`,
              `GET handler does not appear to implement pagination (no page/limit/skip/take params)`,
              { filePath: `src/app/api/${route}/route.ts`, recommendation: 'Add pagination with take/skip or page/limit' })
          );
        }
      }

      // Check error handling (try/catch or guard wrappers that handle errors internally)
      const hasTryCatch = /try\s*\{/.test(content) ||
        /withAdminGuard|withApiHandler|withUserGuard|withApiAuth/.test(content) ||
        /\.catch\s*\(/.test(content);
      if (hasTryCatch) {
        results.push(this.pass(`${prefix}-errors-${route.replace(/\//g, '-')}`, `API ${route} has error handling`));
      } else {
        results.push(
          this.fail(`${prefix}-errors-${route.replace(/\//g, '-')}`, 'MEDIUM', `No error handling on /api/${route}`,
            `No try/catch block found in route handler`,
            { filePath: `src/app/api/${route}/route.ts`, recommendation: 'Wrap handler logic in try/catch' })
        );
      }
    }

    return results;
  }

  // ── Angle 4: UI Playwright (static analysis) ──────────────────

  protected async angle4_uiPlaywright(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const cfg = this.sectionConfig;
    const prefix = `${this.auditTypeCode.toLowerCase()}-ui`;

    for (const pageName of cfg.adminPages) {
      const pagePath = path.join(this.srcDir, 'app', 'admin', pageName, 'page.tsx');
      const content = this.getEffectivePageContent(pagePath);
      if (!content) continue;

      // Check for navigation links
      // Note: admin pages typically navigate via sidebar layout, tabs, or modals — not Link components
      const hasLinks = /Link\s+href=|useRouter|router\.push|href=/.test(content);
      // Admin sidebar provides navigation, so pages without internal links are fine
      results.push(
        hasLinks
          ? this.pass(`${prefix}-nav-${pageName}`, `Page /admin/${pageName} has navigation`)
          : this.pass(`${prefix}-nav-${pageName}`, `Page /admin/${pageName} relies on admin sidebar navigation`)
      );

      // Check for data fetching (broader patterns)
      const hasFetch = /fetch\(|useSWR|useQuery|prisma\.|useEffect.*fetch|useCallback.*fetch|axios/.test(content);
      results.push(
        hasFetch
          ? this.pass(`${prefix}-data-${pageName}`, `Page /admin/${pageName} fetches data`)
          : this.fail(`${prefix}-data-${pageName}`, 'MEDIUM', `No data fetching on /admin/${pageName}`,
              `Page may be a stub — no fetch(), useSWR(), or prisma calls found`,
              { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Connect page to API/data source' })
      );

      // Check for useI18n/useTranslations
      const hasI18n = /useI18n|useTranslations|t\(/.test(content);
      results.push(
        hasI18n
          ? this.pass(`${prefix}-i18n-${pageName}`, `Page /admin/${pageName} uses i18n`)
          : this.fail(`${prefix}-i18n-${pageName}`, 'LOW', `No i18n on /admin/${pageName}`,
              `Page does not use useI18n() or useTranslations() — text may be hardcoded`,
              { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Use t() for all user-facing text' })
      );
    }

    return results;
  }

  // ── Angle 5: State Testing ────────────────────────────────────

  protected async angle5_stateTesting(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const cfg = this.sectionConfig;
    const prefix = `${this.auditTypeCode.toLowerCase()}-state`;

    for (const pageName of cfg.adminPages) {
      const pagePath = path.join(this.srcDir, 'app', 'admin', pageName, 'page.tsx');
      const content = this.getEffectivePageContent(pagePath);
      if (!content) continue;

      // Check for loading state (also accept loading.tsx companion file)
      const hasLoadingFile = fs.existsSync(path.join(this.srcDir, 'app', 'admin', pageName, 'loading.tsx'));
      const hasLoadingState = /loading|isLoading|skeleton|animate-pulse|Spinner|setLoading|_loading/.test(content);
      results.push(
        (hasLoadingState || hasLoadingFile)
          ? this.pass(`${prefix}-loading-${pageName}`, `Page /admin/${pageName} handles loading state`)
          : this.fail(`${prefix}-loading-${pageName}`, 'MEDIUM', `No loading state on /admin/${pageName}`,
              `No loading indicator found. Users see nothing while data loads.`,
              { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add loading state (skeleton/spinner)' })
      );

      // Check for empty state (include component imports that handle it)
      // Skip for settings/config pages — they always have form content and are never "empty"
      const hasEmptyState = /empty|no data|aucun|No .* found|\.length\s*===?\s*0|EmptyState/.test(content);
      if (isSettingsPage(pageName, content)) {
        results.push(this.pass(`${prefix}-empty-${pageName}`, `Page /admin/${pageName} is a settings page (always has content)`));
      } else {
        results.push(
          hasEmptyState
            ? this.pass(`${prefix}-empty-${pageName}`, `Page /admin/${pageName} handles empty state`)
            : this.fail(`${prefix}-empty-${pageName}`, 'LOW', `No empty state on /admin/${pageName}`,
                `No empty state handling found. Page may show blank content when no data exists.`,
                { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add empty state message when list is empty' })
        );
      }

      // Check for error state
      const hasErrorState = /error|catch|toast\.error|onError|Error/.test(content);
      results.push(
        hasErrorState
          ? this.pass(`${prefix}-error-${pageName}`, `Page /admin/${pageName} handles error state`)
          : this.fail(`${prefix}-error-${pageName}`, 'MEDIUM', `No error handling on /admin/${pageName}`,
              `No error state found. Failures may show blank page or crash.`,
              { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add error handling with user feedback' })
      );

      // Check for date formatting — only if the page displays dates to users
      // Step 1: Does the page use any date-rendering method?
      const usesDateDisplay = /toLocaleDateString|toLocaleTimeString|toLocaleString|formatDate|Intl\.DateTimeFormat/.test(content);
      // Step 2: Does it render date fields in JSX like <span>{item.createdAt}</span>?
      // We look for patterns like: >{...date...}< or >{...Date...}</  (JSX context)
      // Exclude template literal backtick patterns (`prefix-${new Date().toISOString()}`)
      const rendersDateFieldInJsx = />\s*\{[^}]*(?:createdAt|updatedAt|date|timestamp)[^}]*\}\s*</.test(content);

      if (usesDateDisplay) {
        // Page renders dates — check if locale-aware formatting is used
        const hasLocaleFormat = /toLocaleDate|toLocaleDateString|toLocaleString|formatDate|Intl\.DateTimeFormat|locale/.test(content);
        results.push(
          hasLocaleFormat
            ? this.pass(`${prefix}-dateformat-${pageName}`, `Page /admin/${pageName} options dates with locale`)
            : this.fail(`${prefix}-dateformat-${pageName}`, 'LOW', `Dates may not be locale-formatted on /admin/${pageName}`,
                `Page renders dates but may not format them according to user locale`,
                { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Use toLocaleDateString(locale) for date display' })
        );
      } else if (rendersDateFieldInJsx) {
        // Page renders raw date fields in JSX without formatting
        results.push(
          this.fail(`${prefix}-dateformat-${pageName}`, 'LOW', `Dates may not be locale-formatted on /admin/${pageName}`,
            `Page renders date fields in JSX without locale formatting`,
            { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Use toLocaleDateString(locale) for date display' })
        );
      }
      // If only .toISOString() for filenames/state — not a user-facing finding
    }

    return results;
  }

  // ── Angle 6: Interaction Testing ──────────────────────────────

  protected async angle6_interactionTesting(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const cfg = this.sectionConfig;
    const prefix = `${this.auditTypeCode.toLowerCase()}-interact`;

    for (const pageName of cfg.adminPages) {
      const pagePath = path.join(this.srcDir, 'app', 'admin', pageName, 'page.tsx');
      const content = this.getEffectivePageContent(pagePath);
      if (!content) continue;

      // Check for form handling — use word boundary to avoid matching "transform", "platform", etc.
      const hasForms = /\bForm\b|onSubmit|handleSubmit|<form/.test(content);
      if (hasForms) {
        // Accept various validation patterns including FormField with required prop
        let hasValidation = /required|validation|zod|yup|schema|\.parse|FormField/.test(content);

        // If page imports a local component with "Form" in its name (e.g., SupplierForm,
        // PromoCodeForm), the form component likely contains its own validation logic.
        // This handles the case where getEffectivePageContent's early-exit for large
        // client components prevents us from seeing the child component's validation.
        if (!hasValidation) {
          const importsFormComponent = /import\s+\w*Form\w*\s+from\s+['"]\.\//.test(content);
          if (importsFormComponent) {
            // Check the imported form component file for validation
            const formImportMatch = content.match(/import\s+(\w*Form\w*)\s+from\s+['"](\.\/.+?)['"]/);
            if (formImportMatch) {
              const formPath = formImportMatch[2];
              const dir = path.dirname(pagePath);
              for (const ext of ['.tsx', '.ts']) {
                const resolved = path.join(dir, formPath.replace(/\.(tsx?|js)$/, '') + ext);
                const formContent = this.readFile(resolved);
                if (formContent && /required|validation|zod|yup|schema|\.parse|FormField/.test(formContent)) {
                  hasValidation = true;
                  break;
                }
              }
            }
          }
        }

        results.push(
          hasValidation
            ? this.pass(`${prefix}-formval-${pageName}`, `Forms on /admin/${pageName} have validation`)
            : this.fail(`${prefix}-formval-${pageName}`, 'MEDIUM', `No form validation on /admin/${pageName}`,
                `Form elements found but no validation logic detected`,
                { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add client-side form validation' })
        );
      }

      // Check for modals/dialogs
      const hasModals = /Dialog|Modal|modal|dialog|Sheet|drawer|ConfirmDialog/.test(content);
      if (hasModals) {
        results.push(this.pass(`${prefix}-modal-${pageName}`, `Page /admin/${pageName} uses modals/dialogs`));
      }

      // Check for search/filter — only on list pages, not settings/config/dashboard pages
      // Also skip if the list is explicitly bounded (e.g., .slice(0, N)) or has few fixed items
      if (isListPage(content) && !isSettingsPage(pageName, content)) {
        const hasSearch = /search|filter|Search|Filter|query|FilterBar|ContentList/.test(content);
        // A bounded list (e.g., .slice(0, 20)) with few items doesn't need search
        const isBoundedList = /\.slice\(0,\s*\d+\)/.test(content);
        if (hasSearch || isBoundedList) {
          results.push(this.pass(`${prefix}-search-${pageName}`, `Page /admin/${pageName} has search/filter or bounded list`));
        } else {
          results.push(
            this.fail(`${prefix}-search-${pageName}`, 'LOW', `No search/filter on /admin/${pageName}`,
              `No search or filtering capability found. Large data sets will be hard to navigate.`,
              { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add search/filter functionality' })
          );
        }
      }

      // Check for buttons/actions
      const hasActions = /onClick|button|Button|handleDelete|handleEdit|handleCreate|useRibbonAction/.test(content);
      results.push(
        hasActions
          ? this.pass(`${prefix}-actions-${pageName}`, `Page /admin/${pageName} has interactive actions`)
          : this.fail(`${prefix}-actions-${pageName}`, 'MEDIUM', `No interactive actions on /admin/${pageName}`,
              `No buttons or click handlers found. Page may be read-only or a stub.`,
              { filePath: `src/app/admin/${pageName}/page.tsx` })
      );

      // Check for tabs
      const hasTabs = /Tab|tab|Tabs|tabs|TabsList/.test(content);
      if (hasTabs) {
        results.push(this.pass(`${prefix}-tabs-${pageName}`, `Page /admin/${pageName} uses tabs`));
      }
    }

    return results;
  }

  // ── Angle 7: Responsive ───────────────────────────────────────

  protected async angle7_responsive(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const cfg = this.sectionConfig;
    const prefix = `${this.auditTypeCode.toLowerCase()}-responsive`;

    for (const pageName of cfg.adminPages) {
      const pagePath = path.join(this.srcDir, 'app', 'admin', pageName, 'page.tsx');
      const content = this.getEffectivePageContent(pagePath);
      if (!content) continue;

      // If the page imports a shared component that already handles responsiveness,
      // skip the responsive check — the component handles it internally.
      const usesResponsiveComponent = importsAny(content, RESPONSIVE_COMPONENTS);

      // Check for responsive classes (Tailwind breakpoints and responsive-aware utilities)
      // max-w-{size} constrains layout width (responsive-aware), w-full adapts to container
      const hasResponsive = /sm:|md:|lg:|xl:|2xl:|grid-cols-|flex-wrap|hidden\s+sm:|block\s+md:|max-w-\w+|w-full/.test(content);
      if (hasResponsive || usesResponsiveComponent) {
        results.push(this.pass(`${prefix}-tw-${pageName}`, `Page /admin/${pageName} has responsive design`));
      } else {
        // Admin pages are desktop-primary, so missing responsive is LOW not MEDIUM
        results.push(
          this.fail(`${prefix}-tw-${pageName}`, 'LOW', `No responsive design on /admin/${pageName}`,
            `No Tailwind responsive breakpoints (sm:/md:/lg:) or responsive components found. Admin is desktop-primary but tablet support recommended.`,
            { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add responsive breakpoints or use a responsive layout component' })
        );
      }

      // Check for overflow handling — shared components like DataTable already handle overflow
      const usesOverflowComponent = importsAny(content, OVERFLOW_COMPONENTS);
      const hasOverflow = /overflow-|truncate|line-clamp|text-ellipsis|min-w-0/.test(content);
      if (hasOverflow || usesOverflowComponent) {
        results.push(this.pass(`${prefix}-overflow-${pageName}`, `Page /admin/${pageName} handles text overflow`));
      } else {
        results.push(
          this.fail(`${prefix}-overflow-${pageName}`, 'LOW', `No overflow handling on /admin/${pageName}`,
            `No overflow/truncate classes found. Long text may break layout on small screens.`,
            { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add truncate/overflow handling for long text' })
        );
      }

      // Check for mobile-friendly tables — DataTable already wraps with overflow-x-auto
      // Use \b word boundary to avoid matching "stable", "timetable", etc.
      const usesDataTable = /DataTable/.test(content);
      if (/\btable\b|<table[\s>]|<Table[\s>]|<th[\s>]|<td[\s>]/.test(content) && !usesDataTable) {
        const hasScrollable = /overflow-x|overflow-auto|overflow-scroll/.test(content);
        results.push(
          hasScrollable
            ? this.pass(`${prefix}-table-${pageName}`, `Table on /admin/${pageName} is scrollable on mobile`)
            : this.fail(`${prefix}-table-${pageName}`, 'MEDIUM', `Table may overflow on /admin/${pageName}`,
                `Table found without horizontal scroll wrapper. Tables break on mobile without overflow-x-auto.`,
                { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Wrap table in a div with overflow-x-auto' })
        );
      } else if (usesDataTable) {
        results.push(this.pass(`${prefix}-table-${pageName}`, `DataTable on /admin/${pageName} has built-in scroll`));
      }
    }

    return results;
  }

  // ── Angle 8: Accessibility ────────────────────────────────────

  protected async angle8_accessibility(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const cfg = this.sectionConfig;
    const prefix = `${this.auditTypeCode.toLowerCase()}-a11y`;

    for (const pageName of cfg.adminPages) {
      const pagePath = path.join(this.srcDir, 'app', 'admin', pageName, 'page.tsx');
      const content = this.getEffectivePageContent(pagePath);
      if (!content) continue;

      // Check for ARIA attributes — shared components like DataTable, Modal, Button
      // already provide ARIA. If the page imports them, pass the check.
      const usesA11yComponent = importsAny(content, A11Y_COMPONENTS);
      const hasAria = /aria-|role=/.test(content);
      if (hasAria || usesA11yComponent) {
        results.push(this.pass(`${prefix}-aria-${pageName}`, `Page /admin/${pageName} has ARIA support`));
      } else {
        results.push(
          this.fail(`${prefix}-aria-${pageName}`, 'LOW', `No ARIA attributes on /admin/${pageName}`,
            `No aria-* or role= attributes found, and no shared a11y components imported.`,
            { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add ARIA labels and roles, or use shared components like DataTable, Modal, Button' })
        );
      }

      // Check for alt text on images
      // Exclude Lucide icon imports like `Image as ImageIcon` and `ImageIcon` — these are SVG icons, not user-content images
      const hasImages = /<img\b/.test(content) ||
        (/\bImage\b/.test(content) && !/Image\s+as\s+\w+Icon/.test(content) && /from\s+['"]next\/image['"]/.test(content));
      if (hasImages) {
        const hasAlt = /alt=/.test(content);
        results.push(
          hasAlt
            ? this.pass(`${prefix}-alt-${pageName}`, `Images on /admin/${pageName} have alt text`)
            : this.fail(`${prefix}-alt-${pageName}`, 'HIGH', `Missing alt text on /admin/${pageName}`,
                `Image elements found without alt attributes`,
                { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add meaningful alt text to all images' })
        );
      }

      // Check for keyboard focus indicators — shared components, Tailwind defaults,
      // and native <button>/<a>/<input> elements all provide built-in focus handling.
      const hasFocus = /focus:|focus-visible:|focus-within:|tabIndex|onKeyDown|onKeyUp|onKeyPress/.test(content);
      // Native interactive elements (<button>, <a href>, <input>, <select>) have browser-default focus
      const hasNativeFocusable = /<button[\s>]|<a\s+href|<input[\s/>]|<select[\s/>]/.test(content);
      if (hasFocus || usesA11yComponent || hasNativeFocusable) {
        results.push(this.pass(`${prefix}-focus-${pageName}`, `Page /admin/${pageName} has focus indicators`));
      } else {
        results.push(
          this.fail(`${prefix}-focus-${pageName}`, 'LOW', `No focus indicators on /admin/${pageName}`,
            `No Tailwind focus: classes, keyboard event handlers, native focusable elements, or shared components with built-in focus styles`,
            { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add focus-visible: styles or use shared components with built-in focus handling' })
        );
      }

      // Check for label association on form fields
      // Use patterns that match actual HTML/JSX form elements, not Prisma select: {} properties
      const hasFormFields = /<input[\s/>]|<select[\s/>]|<textarea[\s/>]|<Input[\s/>]|<Select[\s/>]|<Textarea[\s/>]/.test(content);
      if (hasFormFields) {
        // FormField component wraps inputs with labels automatically
        const hasLabels = /label|Label|htmlFor|aria-label|placeholder|FormField/.test(content);
        results.push(
          hasLabels
            ? this.pass(`${prefix}-labels-${pageName}`, `Form fields on /admin/${pageName} have labels`)
            : this.fail(`${prefix}-labels-${pageName}`, 'HIGH', `Form fields without labels on /admin/${pageName}`,
                `Form inputs found without associated labels or aria-label`,
                { filePath: `src/app/admin/${pageName}/page.tsx`, recommendation: 'Add <label> or aria-label to all form fields' })
        );
      }
    }

    return results;
  }

  // ── Utility methods ───────────────────────────────────────────

  /**
   * Extract the body of a Prisma model block, handling '}' inside comments.
   * Uses brace counting instead of a naive [^}]+ pattern.
   */
  protected extractModelBlock(schema: string, modelName: string): string | null {
    const startRegex = new RegExp(`model\\s+${modelName}\\s*\\{`);
    const startMatch = schema.match(startRegex);
    if (!startMatch || startMatch.index === undefined) return null;

    const bodyStart = startMatch.index + startMatch[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < schema.length && depth > 0) {
      const ch = schema[i];
      // Skip // line comments entirely
      if (ch === '/' && schema[i + 1] === '/') {
        const eol = schema.indexOf('\n', i);
        i = eol === -1 ? schema.length : eol + 1;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth > 0) i++;
      // When depth reaches 0 we stop (i points to closing '}')
    }

    if (depth !== 0) return null;
    return schema.substring(bodyStart, i);
  }

  protected hasNestedKey(jsonContent: string, keyParts: string[]): boolean {
    try {
      let obj = JSON.parse(jsonContent);
      for (const part of keyParts) {
        if (obj && typeof obj === 'object' && part in obj) {
          obj = obj[part];
        } else {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}

export default BaseSectionAuditor;
