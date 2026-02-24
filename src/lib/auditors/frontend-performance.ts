/**
 * FRONTEND-PERFORMANCE Auditor
 * Checks Next.js frontend performance: image optimization, dynamic imports, memoization, Suspense.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class FrontendPerformanceAuditor extends BaseAuditor {
  auditTypeCode = 'FRONTEND-PERFORMANCE';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkImageOptimization());
    results.push(...this.checkDynamicImports());
    results.push(...this.checkMemoization());
    results.push(...this.checkSuspenseBoundaries());

    return results;
  }

  /**
   * fe-01: Check for <img> tags not using next/image.
   * In Next.js projects, all images should use the Image component for automatic optimization.
   */
  private checkImageOptimization(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsxFiles = this.findFiles(this.srcDir, /\.tsx$/);

    const offenders: { file: string; line: number; snippet: string }[] = [];

    for (const file of tsxFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comment lines
        if (/^\s*\/\//.test(line) || /^\s*\*/.test(line) || /^\s*{\/\*/.test(line)) continue;

        // Look for raw <img tags (not <Image from next/image)
        if (/<img\s/i.test(line) && !/<Image\s/i.test(line)) {
          offenders.push({
            file,
            line: i + 1,
            snippet: this.getSnippet(content, i + 1),
          });
        }
      }
    }

    if (offenders.length === 0) {
      results.push(this.pass('fe-01', 'All images use next/image Image component'));
    } else {
      for (const item of offenders.slice(0, 10)) {
        results.push(
          this.fail(
            'fe-01',
            'MEDIUM',
            'Raw <img> tag used instead of next/image',
            'Using raw <img> tags bypasses Next.js image optimization (lazy loading, WebP conversion, responsive sizing)',
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              codeSnippet: item.snippet,
              recommendation:
                'Replace <img> with <Image> from "next/image". Set width/height or use fill prop for responsive images.',
            }
          )
        );
      }

      if (offenders.length > 10) {
        results.push(
          this.fail('fe-01', 'INFO', 'Image optimization summary', `${offenders.length} raw <img> tags found total. Showing first 10.`, {
            recommendation: 'Replace all <img> with next/image Image component for automatic optimization',
          })
        );
      }
    }

    return results;
  }

  /**
   * fe-02: Check for dynamic imports / lazy loading patterns.
   * Large components and heavy libraries should use dynamic() or React.lazy().
   */
  private checkDynamicImports(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Check pages and components for dynamic import usage
    const pages = this.findPages();
    const components = this.findComponents();
    const allFiles = [...pages, ...components];

    let dynamicImportCount = 0;
    let nextDynamicCount = 0;
    let reactLazyCount = 0;
    const largeFilesWithoutLazy: { file: string; size: number }[] = [];

    // Known heavy libraries that should typically be dynamically imported
    const heavyLibraries = [
      'recharts',
      'chart.js',
      'react-chartjs',
      'd3',
      'monaco-editor',
      'react-quill',
      'react-draft-wysiwyg',
      'react-pdf',
      'react-map-gl',
      'mapbox-gl',
      '@react-three',
      'three',
      'framer-motion',
    ];

    const heavyImportsWithoutDynamic: { file: string; library: string; line: number }[] = [];

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Count dynamic patterns
      if (/import\s*\(\s*['"]/.test(content)) dynamicImportCount++;
      if (/next\/dynamic/.test(content)) nextDynamicCount++;
      if (/React\.lazy\s*\(/.test(content) || /lazy\s*\(/.test(content)) reactLazyCount++;

      // Check for heavy library static imports
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*import\s/.test(line)) {
          for (const lib of heavyLibraries) {
            if (line.includes(`'${lib}`) || line.includes(`"${lib}`)) {
              // Check if this file also uses dynamic for this import
              if (!content.includes(`dynamic(() => import('${lib}`) && !content.includes(`dynamic(() => import("${lib}`)) {
                heavyImportsWithoutDynamic.push({ file, library: lib, line: i + 1 });
              }
            }
          }
        }
      }

      // Flag large component files (>300 lines) without any lazy loading
      if (lines.length > 300) {
        const hasLazy =
          /next\/dynamic/.test(content) || /React\.lazy/.test(content) || /import\s*\(/.test(content);
        if (!hasLazy) {
          largeFilesWithoutLazy.push({ file, size: lines.length });
        }
      }
    }

    // Report dynamic import usage
    if (dynamicImportCount > 0 || nextDynamicCount > 0 || reactLazyCount > 0) {
      results.push(
        this.pass(
          'fe-02',
          `Dynamic imports detected: ${nextDynamicCount} next/dynamic, ${reactLazyCount} React.lazy, ${dynamicImportCount} raw dynamic imports`
        )
      );
    } else {
      results.push(
        this.fail(
          'fe-02',
          'MEDIUM',
          'No dynamic imports or lazy loading detected',
          'The codebase has no dynamic imports. Large components and heavy libraries should be lazily loaded to reduce initial bundle size.',
          {
            recommendation:
              'Use `next/dynamic` for heavy components: `const Chart = dynamic(() => import("./Chart"), { ssr: false })`',
          }
        )
      );
    }

    // Report heavy libraries without dynamic import
    for (const item of heavyImportsWithoutDynamic) {
      const content = this.readFile(item.file);
      results.push(
        this.fail(
          'fe-02',
          'MEDIUM',
          `Heavy library "${item.library}" imported statically`,
          `"${item.library}" is a large library and should be dynamically imported to reduce bundle size`,
          {
            filePath: this.relativePath(item.file),
            lineNumber: item.line,
            codeSnippet: content ? this.getSnippet(content, item.line) : undefined,
            recommendation: `Use next/dynamic: const Component = dynamic(() => import('...'), { ssr: false })`,
          }
        )
      );
    }

    // Report large files without lazy loading
    for (const item of largeFilesWithoutLazy.slice(0, 5)) {
      results.push(
        this.fail(
          'fe-02',
          'LOW',
          'Large component without lazy loading',
          `File has ${item.size} lines with no dynamic imports. Consider code splitting.`,
          {
            filePath: this.relativePath(item.file),
            recommendation: 'Split into smaller components and use next/dynamic for non-critical sections',
          }
        )
      );
    }

    return results;
  }

  /**
   * fe-03: Check for useMemo/useCallback in components with expensive operations.
   * Components performing array operations, filtering, or sorting should memoize.
   */
  private checkMemoization(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsxFiles = this.findFiles(this.srcDir, /\.tsx$/);

    // Patterns indicating expensive operations that should be memoized
    const expensivePatterns = [
      { pattern: /\.filter\s*\(/, name: '.filter()' },
      { pattern: /\.map\s*\(/, name: '.map()' },
      { pattern: /\.sort\s*\(/, name: '.sort()' },
      { pattern: /\.reduce\s*\(/, name: '.reduce()' },
      { pattern: /Object\.keys\s*\(/, name: 'Object.keys()' },
      { pattern: /Object\.entries\s*\(/, name: 'Object.entries()' },
      { pattern: /JSON\.parse\s*\(/, name: 'JSON.parse()' },
    ];

    const memoPatterns = /useMemo|useCallback|React\.memo/;

    let componentsWithExpensiveOps = 0;
    let componentsWithMemoization = 0;
    const missingMemo: { file: string; operations: string[] }[] = [];

    for (const file of tsxFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Only check client components (those with hooks or 'use client')
      const isClientComponent = /['"]use client['"]/.test(content) || /useState|useEffect|useRef/.test(content);
      if (!isClientComponent) continue;

      const foundExpensive: string[] = [];
      for (const { pattern, name } of expensivePatterns) {
        // Count occurrences in render body (not in useEffect/useMemo already)
        const matches = content.match(pattern);
        if (matches && matches.length >= 2) {
          foundExpensive.push(`${name} x${matches.length}`);
        }
      }

      if (foundExpensive.length > 0) {
        componentsWithExpensiveOps++;
        const hasMemo = memoPatterns.test(content);
        if (hasMemo) {
          componentsWithMemoization++;
        } else {
          missingMemo.push({ file, operations: foundExpensive });
        }
      }
    }

    if (componentsWithExpensiveOps === 0) {
      results.push(this.pass('fe-03', 'No components with excessive array operations detected'));
    } else if (missingMemo.length === 0) {
      results.push(
        this.pass(
          'fe-03',
          `All ${componentsWithExpensiveOps} components with expensive operations use memoization`
        )
      );
    } else {
      for (const item of missingMemo.slice(0, 8)) {
        results.push(
          this.fail(
            'fe-03',
            'LOW',
            'Component with expensive operations lacks memoization',
            `Component uses ${item.operations.join(', ')} without useMemo/useCallback`,
            {
              filePath: this.relativePath(item.file),
              recommendation:
                'Wrap expensive computations in useMemo() and event handlers in useCallback() to prevent unnecessary recalculations on re-render',
            }
          )
        );
      }

      results.push(
        this.fail(
          'fe-03',
          'INFO',
          'Memoization summary',
          `${componentsWithMemoization}/${componentsWithExpensiveOps} components with expensive operations use memoization. ${missingMemo.length} could benefit from useMemo/useCallback.`
        )
      );
    }

    return results;
  }

  /**
   * fe-04: Check for Suspense boundaries around async components.
   * Async server components and data-fetching components should be wrapped in Suspense.
   */
  private checkSuspenseBoundaries(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Check layout.tsx and page.tsx files for Suspense usage
    const layouts = this.findFiles(path.join(this.srcDir, 'app'), /^layout\.tsx$/);
    const pages = this.findPages();

    let suspenseCount = 0;
    let asyncComponentsWithoutSuspense = 0;
    const missingBoundaries: { file: string; line: number }[] = [];

    // Check layouts for Suspense wrapping
    for (const file of layouts) {
      const content = this.readFile(file);
      if (!content) continue;

      if (/Suspense/.test(content)) {
        suspenseCount++;
      }
    }

    // Check pages that use async operations
    for (const file of pages) {
      const content = this.readFile(file);
      if (!content) continue;

      // Detect async components
      const isAsync = /async\s+(?:function\s+)?\w+.*?Page|export\s+default\s+async/.test(content);
      const usesAwait = /await\s/.test(content);
      const usesFetch = /fetch\s*\(/.test(content);
      const usesPrisma = /prisma\./.test(content);

      if (isAsync || usesAwait || usesFetch || usesPrisma) {
        // Check if this page or its parent layout uses Suspense
        if (!/Suspense/.test(content)) {
          // Check the layout in the same directory
          const dir = path.dirname(file);
          const layoutPath = path.join(dir, 'layout.tsx');
          const layoutContent = this.readFile(layoutPath);
          const parentHasSuspense = layoutContent && /Suspense/.test(layoutContent);

          if (!parentHasSuspense) {
            asyncComponentsWithoutSuspense++;
            const lineNum = this.findLineNumber(content, 'async');
            missingBoundaries.push({ file, line: lineNum || 1 });
          }
        } else {
          suspenseCount++;
        }
      }
    }

    // Check for loading.tsx files (Next.js automatic Suspense boundaries)
    const loadingFiles = this.findFiles(path.join(this.srcDir, 'app'), /^loading\.tsx$/);

    if (suspenseCount > 0 || loadingFiles.length > 0) {
      results.push(
        this.pass(
          'fe-04',
          `Suspense boundaries found: ${suspenseCount} explicit <Suspense>, ${loadingFiles.length} loading.tsx files`
        )
      );
    } else {
      results.push(
        this.fail(
          'fe-04',
          'MEDIUM',
          'No Suspense boundaries detected',
          'The app has no <Suspense> boundaries or loading.tsx files. Async data fetching will block the entire page.',
          {
            recommendation:
              'Add loading.tsx files in app directories, or wrap async components with <Suspense fallback={<Loading />}>',
          }
        )
      );
    }

    // Report specific pages missing Suspense
    for (const item of missingBoundaries.slice(0, 8)) {
      const content = this.readFile(item.file);
      results.push(
        this.fail(
          'fe-04',
          'LOW',
          'Async page without Suspense boundary',
          'This async page has no Suspense boundary or loading.tsx in its directory',
          {
            filePath: this.relativePath(item.file),
            lineNumber: item.line,
            codeSnippet: content ? this.getSnippet(content, item.line) : undefined,
            recommendation:
              'Add a loading.tsx in the same directory, or wrap the async content in <Suspense fallback={...}>',
          }
        )
      );
    }

    return results;
  }
}
