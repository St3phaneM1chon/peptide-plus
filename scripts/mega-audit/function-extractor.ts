/**
 * FUNCTION EXTRACTOR
 * Uses TypeScript Compiler API to extract all exported functions/methods
 * with their full context (imports, types, callers).
 */

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import type { DomainConfig } from './audit-config';

// =====================================================
// TYPES
// =====================================================

export interface ExtractedFunction {
  name: string;
  file: string;
  relativePath: string;
  line: number;
  endLine: number;
  kind: 'function' | 'arrow' | 'method' | 'handler' | 'component';
  exported: boolean;
  async: boolean;
  /** The function source code */
  body: string;
  /** Imports used by this function */
  imports: string[];
  /** Type annotations in scope */
  types: string[];
  /** Other functions in the same file that call this one */
  internalCallers: string[];
  /** Full file source (for context) */
  fileSource: string;
  /** Domain this function belongs to */
  domain?: string;
}

// =====================================================
// AST EXTRACTION
// =====================================================

function getLineNumber(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) return true;

  // Check if parent is an export declaration
  if (node.parent && ts.isVariableStatement(node.parent)) {
    const parentMods = ts.canHaveModifiers(node.parent) ? ts.getModifiers(node.parent) : undefined;
    if (parentMods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) return true;
  }
  return false;
}

function extractImports(sourceFile: ts.SourceFile): string[] {
  const imports: string[] = [];
  ts.forEachChild(sourceFile, node => {
    if (ts.isImportDeclaration(node)) {
      imports.push(node.getText(sourceFile));
    }
  });
  return imports;
}

function extractTypeDeclarations(sourceFile: ts.SourceFile): string[] {
  const types: string[] = [];
  ts.forEachChild(sourceFile, node => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
      types.push(node.getText(sourceFile));
    }
  });
  return types;
}

function getFunctionName(node: ts.Node, sourceFile: ts.SourceFile): string | null {
  // Named function declaration
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.getText(sourceFile);
  }

  // Arrow function or function expression assigned to a variable
  if (ts.isVariableDeclaration(node) && node.name) {
    const init = node.initializer;
    if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
      return node.name.getText(sourceFile);
    }
  }

  // Method declaration
  if (ts.isMethodDeclaration(node) && node.name) {
    return node.name.getText(sourceFile);
  }

  // Property assignment with arrow/function (e.g., in object literals for API routes)
  if (ts.isPropertyAssignment(node) && node.name) {
    const init = node.initializer;
    if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
      return node.name.getText(sourceFile);
    }
  }

  return null;
}

function getKind(node: ts.Node): ExtractedFunction['kind'] {
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isMethodDeclaration(node)) return 'method';
  if (ts.isVariableDeclaration(node)) {
    const init = node.initializer;
    if (init && ts.isArrowFunction(init)) return 'arrow';
    if (init && ts.isFunctionExpression(init)) return 'function';
  }
  return 'function';
}

function isAsync(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) return true;

  if (ts.isVariableDeclaration(node) && node.initializer) {
    const init = node.initializer;
    if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
      const initMods = ts.canHaveModifiers(init) ? ts.getModifiers(init) : undefined;
      return initMods?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    }
  }
  return false;
}

function findInternalCallers(funcName: string, sourceFile: ts.SourceFile, allFuncNames: string[]): string[] {
  const callers: string[] = [];
  const text = sourceFile.getFullText();

  for (const otherName of allFuncNames) {
    if (otherName === funcName) continue;
    // Simple heuristic: check if the function name appears as an identifier call
    const callPattern = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
    // Find if the call is within another function's body
    if (callPattern.test(text)) {
      callers.push(otherName);
    }
  }
  return callers;
}

// =====================================================
// MAIN EXTRACTION
// =====================================================

export function extractFunctionsFromFile(
  filePath: string,
  projectRoot: string,
): ExtractedFunction[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const functions: ExtractedFunction[] = [];
  const imports = extractImports(sourceFile);
  const types = extractTypeDeclarations(sourceFile);
  const relativePath = path.relative(projectRoot, filePath);
  const allFuncNames: string[] = [];

  // First pass: collect all function names
  function collectNames(node: ts.Node) {
    const name = getFunctionName(node, sourceFile);
    if (name) allFuncNames.push(name);

    // For variable statements, look inside declarations
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach(decl => {
        const declName = getFunctionName(decl, sourceFile);
        if (declName) allFuncNames.push(declName);
      });
    }

    ts.forEachChild(node, collectNames);
  }
  ts.forEachChild(sourceFile, collectNames);

  // Second pass: extract function details
  function visit(node: ts.Node) {
    let funcNode: ts.Node | null = null;
    let name: string | null = null;

    if (ts.isFunctionDeclaration(node) && node.name) {
      funcNode = node;
      name = node.name.getText(sourceFile);
    } else if (ts.isVariableStatement(node)) {
      const exported = isExported(node);
      for (const decl of node.declarationList.declarations) {
        const declName = getFunctionName(decl, sourceFile);
        if (declName && decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
          const line = getLineNumber(sourceFile, decl.getStart(sourceFile));
          const endLine = getLineNumber(sourceFile, decl.getEnd());

          // Detect React component (PascalCase + returns JSX)
          let kind = getKind(decl);
          if (/^[A-Z]/.test(declName) && filePath.endsWith('.tsx')) {
            kind = 'component';
          }

          // Detect API route handlers
          if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(declName)) {
            kind = 'handler';
          }

          functions.push({
            name: declName,
            file: filePath,
            relativePath,
            line,
            endLine,
            kind,
            exported: exported || isExported(decl),
            async: isAsync(decl),
            body: decl.getText(sourceFile),
            imports,
            types,
            internalCallers: findInternalCallers(declName, sourceFile, allFuncNames),
            fileSource: source,
          });
        }
      }
      // Don't recurse into the same declarations
      return;
    } else if (ts.isExportAssignment(node)) {
      // export default function / export default async function
      const expr = node.expression;
      if (ts.isFunctionExpression(expr) || ts.isArrowFunction(expr)) {
        const line = getLineNumber(sourceFile, node.getStart(sourceFile));
        const endLine = getLineNumber(sourceFile, node.getEnd());
        functions.push({
          name: 'default',
          file: filePath,
          relativePath,
          line,
          endLine,
          kind: filePath.endsWith('.tsx') ? 'component' : 'function',
          exported: true,
          async: isAsync(expr),
          body: node.getText(sourceFile),
          imports,
          types,
          internalCallers: [],
          fileSource: source,
        });
      }
      return;
    }

    if (funcNode && name) {
      const line = getLineNumber(sourceFile, funcNode.getStart(sourceFile));
      const endLine = getLineNumber(sourceFile, funcNode.getEnd());

      let kind = getKind(funcNode);
      if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(name)) {
        kind = 'handler';
      }

      functions.push({
        name,
        file: filePath,
        relativePath,
        line,
        endLine,
        kind,
        exported: isExported(funcNode),
        async: isAsync(funcNode),
        body: funcNode.getText(sourceFile),
        imports,
        types,
        internalCallers: findInternalCallers(name, sourceFile, allFuncNames),
        fileSource: source,
      });
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return functions;
}

// =====================================================
// DOMAIN-BASED EXTRACTION
// =====================================================

export async function extractFunctionsByDomain(
  projectRoot: string,
  domainConfig: DomainConfig,
  domainName: string,
): Promise<ExtractedFunction[]> {
  const allFunctions: ExtractedFunction[] = [];
  const seen = new Set<string>();

  // Resolve include patterns
  for (const pattern of domainConfig.include) {
    const files = await glob(pattern, { cwd: projectRoot, absolute: true });
    for (const file of files) {
      // Apply exclude patterns
      if (domainConfig.exclude?.some(ex => {
        const exGlob = path.join(projectRoot, ex);
        return file.startsWith(exGlob.replace(/\*\*.*/, ''));
      })) {
        continue;
      }

      if (seen.has(file)) continue;
      seen.add(file);

      try {
        const funcs = extractFunctionsFromFile(file, projectRoot);
        for (const f of funcs) {
          f.domain = domainName;
          allFunctions.push(f);
        }
      } catch (err) {
        console.error(`[extractor] Failed to parse ${file}:`, err);
      }
    }
  }

  return allFunctions;
}

// =====================================================
// FULL PROJECT EXTRACTION
// =====================================================

export async function extractAllFunctions(
  projectRoot: string,
  domains: Record<string, DomainConfig>,
): Promise<{ byDomain: Record<string, ExtractedFunction[]>; total: number }> {
  const byDomain: Record<string, ExtractedFunction[]> = {};
  let total = 0;

  for (const [domainName, config] of Object.entries(domains)) {
    const funcs = await extractFunctionsByDomain(projectRoot, config, domainName);
    byDomain[domainName] = funcs;
    total += funcs.length;
    console.log(`[extractor] ${domainName}: ${funcs.length} functions`);
  }

  console.log(`[extractor] Total: ${total} functions across ${Object.keys(domains).length} domains`);
  return { byDomain, total };
}
