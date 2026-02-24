/**
 * ARCHITECTURE-QUALITY Auditor
 * Checks architecture patterns: circular imports, API consistency, business logic placement, unused exports.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

interface ImportEdge {
  from: string;
  to: string;
}

export default class ArchitectureQualityAuditor extends BaseAuditor {
  auditTypeCode = 'ARCHITECTURE-QUALITY';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkCircularImports());
    results.push(...this.checkApiRouteConsistency());
    results.push(...this.checkBusinessLogicPlacement());
    results.push(...this.checkUnusedExports());

    return results;
  }

  /**
   * arch-01: Check for circular import patterns (A imports B, B imports A).
   * Circular dependencies cause initialization order issues and make code harder to reason about.
   */
  private checkCircularImports(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    // Build import graph
    const importGraph = new Map<string, Set<string>>();
    const edges: ImportEdge[] = [];

    for (const file of tsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const relFile = this.relativePath(file);
      if (!importGraph.has(relFile)) {
        importGraph.set(relFile, new Set());
      }

      // Extract import paths
      const importRegex = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];

        // Only check local imports (starting with . or @/)
        if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue;

        // Resolve the import path to a file path
        let resolvedPath: string;
        if (importPath.startsWith('@/')) {
          resolvedPath = importPath.replace('@/', 'src/');
        } else {
          const dir = path.dirname(file);
          resolvedPath = this.relativePath(path.resolve(dir, importPath));
        }

        // Normalize: try common extensions
        const candidates = [
          resolvedPath,
          `${resolvedPath}.ts`,
          `${resolvedPath}.tsx`,
          `${resolvedPath}/index.ts`,
          `${resolvedPath}/index.tsx`,
        ];

        for (const candidate of candidates) {
          // Check if this target exists in our file set
          const fullCandidate = path.join(this.rootDir, candidate);
          if (tsFiles.includes(fullCandidate)) {
            const relCandidate = this.relativePath(fullCandidate);
            // Skip self-imports (file importing itself via alias)
            if (relCandidate === relFile) break;
            importGraph.get(relFile)!.add(relCandidate);
            edges.push({ from: relFile, to: relCandidate });
            break;
          }
        }
      }
    }

    // Detect direct circular imports (A->B->A)
    const circularPairs: { a: string; b: string }[] = [];
    const seen = new Set<string>();

    for (const [fileA, importsA] of importGraph) {
      for (const fileB of importsA) {
        // Skip self-imports (same file resolving to itself via alias)
        if (fileA === fileB) continue;
        const importsB = importGraph.get(fileB);
        if (importsB && importsB.has(fileA)) {
          const key = [fileA, fileB].sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            circularPairs.push({ a: fileA, b: fileB });
          }
        }
      }
    }

    if (circularPairs.length === 0) {
      results.push(this.pass('arch-01', 'No direct circular imports detected'));
    } else {
      for (const pair of circularPairs.slice(0, 10)) {
        results.push(
          this.fail(
            'arch-01',
            'HIGH',
            'Circular import detected',
            `${pair.a} and ${pair.b} import each other, creating a circular dependency`,
            {
              filePath: pair.a,
              recommendation:
                'Extract shared code into a separate module, or use dependency inversion (interfaces/types in a shared file)',
            }
          )
        );
      }

      if (circularPairs.length > 10) {
        results.push(
          this.fail(
            'arch-01',
            'INFO',
            'Circular import summary',
            `${circularPairs.length} circular import pairs detected. Showing first 10.`,
            {
              recommendation: 'Refactor to eliminate circular dependencies using barrel files or dependency inversion',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * arch-02: Check for consistent patterns across API routes.
   * All API routes should follow the same structure: auth check, validation, business logic, response.
   */
  private checkApiRouteConsistency(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiRoutes = this.findApiRoutes();

    if (apiRoutes.length === 0) {
      results.push(this.pass('arch-02', 'No API routes to check'));
      return results;
    }

    const patterns = {
      usesNextResponse: 0,
      usesJsonResponse: 0,
      hasTryCatch: 0,
      hasAuth: 0,
      hasValidation: 0,
      handlerExported: 0,
    };

    const inconsistentRoutes: { file: string; issues: string[] }[] = [];

    for (const file of apiRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      const fileIssues: string[] = [];

      // Check response pattern (exclude NextResponse from plain Response count)
      if (/NextResponse\.json/.test(content)) patterns.usesNextResponse++;
      if (/(?<!Next)Response\.json/.test(content)) patterns.usesJsonResponse++;

      // Check try/catch (withApiHandler wraps in try/catch automatically)
      // NextAuth catch-all route uses its own error handling framework
      const isFrameworkRoute = /\[\.\.\.nextauth\]|NextAuth\(/.test(content);
      if (/try\s*\{/.test(content) || /withApiHandler/.test(content) || isFrameworkRoute) {
        patterns.hasTryCatch++;
      } else {
        fileIssues.push('no try/catch');
      }

      // Check auth
      if (/auth\(|getServerSession|requireAuth|withAdminGuard|getSession/.test(content)) {
        patterns.hasAuth++;
      }

      // Check validation (zod, joi, manual checks)
      if (/\.parse\(|\.safeParse\(|validate|joi\.|yup\.|if\s*\(!.*body/.test(content)) {
        patterns.hasValidation++;
      }

      // Check exported handlers
      if (/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/.test(content)) {
        patterns.handlerExported++;
      }

      if (fileIssues.length > 0) {
        inconsistentRoutes.push({ file, issues: fileIssues });
      }
    }

    // Analyze consistency
    const total = apiRoutes.length;
    const allIssues: string[] = [];

    // Response pattern consistency
    if (patterns.usesNextResponse > 0 && patterns.usesJsonResponse > 0) {
      allIssues.push(`Mixed response patterns: ${patterns.usesNextResponse} use NextResponse.json, ${patterns.usesJsonResponse} use Response.json`);
    }

    // Try/catch coverage
    const tryCatchPct = ((patterns.hasTryCatch / total) * 100).toFixed(0);
    if (patterns.hasTryCatch < total) {
      allIssues.push(`Only ${tryCatchPct}% of API routes have try/catch (${patterns.hasTryCatch}/${total})`);
    }

    if (allIssues.length === 0) {
      results.push(
        this.pass('arch-02', `All ${total} API routes follow consistent patterns (try/catch, response format)`)
      );
    } else {
      for (const issue of allIssues) {
        results.push(
          this.fail('arch-02', 'MEDIUM', 'Inconsistent API route patterns', issue, {
            recommendation:
              'Standardize all API routes: use NextResponse.json, wrap in try/catch, validate inputs, and check auth consistently',
          })
        );
      }

      // Report specific inconsistent routes
      for (const item of inconsistentRoutes.slice(0, 5)) {
        results.push(
          this.fail(
            'arch-02',
            'LOW',
            'API route missing standard patterns',
            `Missing: ${item.issues.join(', ')}`,
            {
              filePath: this.relativePath(item.file),
              recommendation: 'Add missing patterns to match the project standard',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * arch-03: Check business logic is in lib/ not in components/ or pages.
   * Components and pages should be thin; business logic belongs in lib/services.
   */
  private checkBusinessLogicPlacement(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const components = this.findComponents();
    const pages = this.findPages();
    const uiFiles = [...components, ...pages];

    // Patterns indicating business logic that should be in lib/
    const businessLogicPatterns = [
      { pattern: /prisma\./, name: 'Direct Prisma calls' },
      { pattern: /fetch\s*\(\s*['"]https?:/, name: 'Direct external API calls' },
      { pattern: /new\s+Stripe\b/, name: 'SDK instantiation' },
      { pattern: /bcrypt|argon2/, name: 'Cryptographic operations' },
      { pattern: /sendEmail|sendMail|transporter\.sendMail/, name: 'Email sending' },
    ];

    const violations: { file: string; patterns: string[]; lines: number[] }[] = [];

    for (const file of uiFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Skip API routes (they are expected to have some logic)
      if (file.includes('/api/')) continue;

      // In Next.js App Router, Server Components (pages without 'use client')
      // are expected to have direct Prisma calls for data fetching - this is the
      // recommended pattern. Only flag client components for having business logic.
      const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
      const isPage = file.includes('/page.tsx') || file.includes('/page.ts');
      if (isPage && !isClientComponent) continue;

      const foundPatterns: string[] = [];
      const foundLines: number[] = [];
      const lines = content.split('\n');

      for (const { pattern, name } of businessLogicPatterns) {
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            foundPatterns.push(name);
            foundLines.push(i + 1);
            break; // One match per pattern per file is enough
          }
        }
      }

      if (foundPatterns.length > 0) {
        violations.push({ file, patterns: foundPatterns, lines: foundLines });
      }
    }

    if (violations.length === 0) {
      results.push(
        this.pass('arch-03', 'Business logic is properly separated in lib/ (not in components or pages)')
      );
    } else {
      for (const item of violations.slice(0, 10)) {
        const content = this.readFile(item.file);
        results.push(
          this.fail(
            'arch-03',
            'MEDIUM',
            'Business logic in UI layer',
            `Component/page contains business logic: ${item.patterns.join(', ')}`,
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.lines[0],
              codeSnippet: content ? this.getSnippet(content, item.lines[0]) : undefined,
              recommendation:
                'Move business logic to src/lib/services/ or src/lib/ and import from the component. Components should only handle UI rendering.',
            }
          )
        );
      }

      if (violations.length > 10) {
        results.push(
          this.fail(
            'arch-03',
            'INFO',
            'Business logic separation summary',
            `${violations.length} UI files contain business logic. Showing first 10.`,
            {
              recommendation: 'Refactor to a service layer pattern: components call services, services handle logic',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * arch-04: Find unused exports (exported but never imported elsewhere).
   * Dead code increases bundle size and maintenance burden.
   */
  private checkUnusedExports(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Scan lib/ and hooks/ files for exports
    const libFiles = this.findLibFiles();
    const hookFiles = this.findFiles(path.join(this.srcDir, 'hooks'), /\.tsx?$/);
    const exportableFiles = [...libFiles, ...hookFiles];

    // Collect all source files for import scanning
    const allTsFiles = this.findFiles(this.srcDir, /\.tsx?$/);

    // Build a map of all imports across the codebase
    const allImports = new Set<string>();
    for (const file of allTsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Extract named imports
      const namedImportRegex = /import\s*\{([^}]+)\}\s*from/g;
      let match;
      while ((match = namedImportRegex.exec(content)) !== null) {
        const names = match[1].split(',').map((n) => {
          const trimmed = n.trim();
          // Handle `as` aliases: import { foo as bar }
          const parts = trimmed.split(/\s+as\s+/);
          return parts[0].trim();
        });
        for (const name of names) {
          if (name) allImports.add(name);
        }
      }

      // Extract default imports
      const defaultImportRegex = /import\s+(\w+)\s+from/g;
      while ((match = defaultImportRegex.exec(content)) !== null) {
        allImports.add(match[1]);
      }

      // Extract namespace imports: import * as foo from ...
      const namespaceImportRegex = /import\s+\*\s+as\s+(\w+)\s+from/g;
      while ((match = namespaceImportRegex.exec(content)) !== null) {
        allImports.add(match[1]);
      }

      // Extract re-exports: export { foo } from '...' and export * from '...'
      const reexportRegex = /export\s*\{([^}]+)\}\s*from/g;
      while ((match = reexportRegex.exec(content)) !== null) {
        const names = match[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim());
        for (const name of names) {
          if (name) allImports.add(name);
        }
      }
    }

    // Check each exportable file for unused exports
    const unusedExports: { file: string; exports: string[] }[] = [];

    for (const file of exportableFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Skip accounting service library files (planned service library with many public functions)
      if (/lib\/accounting\//.test(file)) continue;

      // Skip index/barrel files
      if (path.basename(file).startsWith('index.')) continue;

      const fileExports: string[] = [];

      // Named exports: export function foo, export const foo, export class Foo, export type Foo, export interface Foo
      const namedExportRegex = /export\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+(\w+)/g;
      let match;
      while ((match = namedExportRegex.exec(content)) !== null) {
        fileExports.push(match[1]);
      }

      // Default exports with names: export default function Foo / export default class Foo
      const defaultNamedRegex = /export\s+default\s+(?:async\s+)?(?:function|class)\s+(\w+)/g;
      while ((match = defaultNamedRegex.exec(content)) !== null) {
        fileExports.push(match[1]);
      }

      // Filter to exports that are never imported anywhere
      const unused = fileExports.filter((exp) => !allImports.has(exp));

      if (unused.length > 0 && unused.length === fileExports.length && fileExports.length > 0) {
        // All exports unused - likely a dead module
        unusedExports.push({ file, exports: unused });
      } else if (unused.length > 2) {
        // Several unused exports
        unusedExports.push({ file, exports: unused });
      }
    }

    if (unusedExports.length === 0) {
      results.push(this.pass('arch-04', 'No files with significant unused exports detected'));
    } else {
      for (const item of unusedExports.slice(0, 10)) {
        results.push(
          this.fail(
            'arch-04',
            'LOW',
            'Potentially unused exports',
            `${item.exports.length} export(s) appear unused: ${item.exports.slice(0, 5).join(', ')}${item.exports.length > 5 ? '...' : ''}`,
            {
              filePath: this.relativePath(item.file),
              recommendation:
                'Remove unused exports to reduce bundle size. Verify they are not used via dynamic imports or re-exports before removing.',
            }
          )
        );
      }

      if (unusedExports.length > 10) {
        const totalUnused = unusedExports.reduce((sum, item) => sum + item.exports.length, 0);
        results.push(
          this.fail(
            'arch-04',
            'INFO',
            'Unused exports summary',
            `${totalUnused} potentially unused exports across ${unusedExports.length} files. Showing first 10 files.`,
            {
              recommendation: 'Run a dead-code analysis tool (e.g., ts-prune) for comprehensive results',
            }
          )
        );
      }
    }

    return results;
  }
}
