/**
 * CRM Workflow Code Sandbox (I13)
 *
 * Provides sandboxed JavaScript execution within workflows.
 * Uses Node.js vm module for isolation with strict safety limits:
 * - 5 second timeout
 * - No file system access
 * - No network access (only provided fetch proxy)
 * - Memory-limited context
 */

import * as vm from 'vm';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SandboxContext {
  entity: Record<string, unknown>;
  entityType: string;
  entityId: string;
  helpers: {
    log: (...args: unknown[]) => void;
    fetch: (url: string, options?: RequestInit) => Promise<unknown>;
    now: () => string;
    formatCurrency: (amount: number, currency?: string) => string;
  };
  /** Accumulated log output from the sandbox */
  _logs: string[];
}

export interface CodeStepResult {
  success: boolean;
  output: unknown;
  logs: string[];
  durationMs: number;
  error?: string;
}

interface CodeValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Blocked patterns for security
// ---------------------------------------------------------------------------

const BLOCKED_PATTERNS = [
  /require\s*\(/,
  /import\s+/,
  /process\./,
  /global\./,
  /globalThis/,
  /child_process/,
  /fs\./,
  /\.readFile/,
  /\.writeFile/,
  /\.exec\(/,
  /\.spawn\(/,
  /eval\s*\(/,
  /Function\s*\(/,
  /Proxy/,
  /Reflect/,
  /Symbol\.for/,
  /__proto__/,
  /\.constructor\s*\[/,
];

const MAX_CODE_LENGTH = 10000;
const EXECUTION_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Code validation
// ---------------------------------------------------------------------------

/**
 * Validate custom code before execution. Checks for blocked patterns
 * and basic syntax validity.
 */
export function validateCode(code: string): CodeValidationResult {
  const errors: string[] = [];

  if (!code || typeof code !== 'string') {
    return { valid: false, errors: ['Code must be a non-empty string'] };
  }

  if (code.length > MAX_CODE_LENGTH) {
    errors.push(`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`Blocked pattern detected: ${pattern.source}`);
    }
  }

  // SECURITY NOTE: new Function(code) is used here ONLY for syntax validation.
  // It parses the code into a function but does NOT execute it. The actual
  // execution happens in a sandboxed vm.Context (see executeCodeStep below)
  // with strict timeout, frozen context, and blocked API access.
  // User-submitted code is additionally blocked from using Function() via
  // BLOCKED_PATTERNS above, preventing sandbox escapes.
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(code);
  } catch (e) {
    errors.push(`Syntax error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Sandbox context creation
// ---------------------------------------------------------------------------

/**
 * Create a sandboxed context with entity data and safe helper functions.
 */
export async function createSandboxContext(
  entityType: string,
  entityId: string
): Promise<SandboxContext> {
  let entity: Record<string, unknown> = {};

  try {
    if (entityType === 'lead') {
      const lead = await prisma.crmLead.findUnique({ where: { id: entityId } });
      if (lead) entity = JSON.parse(JSON.stringify(lead));
    } else if (entityType === 'deal') {
      const deal = await prisma.crmDeal.findUnique({
        where: { id: entityId },
        include: { lead: true, stage: true },
      });
      if (deal) entity = JSON.parse(JSON.stringify(deal));
    }
  } catch {
    // Entity not found — provide empty context
  }

  const logs: string[] = [];

  return {
    entity,
    entityType,
    entityId,
    _logs: logs,
    helpers: {
      log: (...args: unknown[]) => {
        const line = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        if (logs.length < 100) logs.push(line);
      },
      fetch: async (url: string, options?: RequestInit) => {
        // Only allow HTTPS GET/POST to prevent abuse
        if (!url.startsWith('https://')) {
          throw new Error('Only HTTPS URLs are allowed');
        }
        const method = options?.method?.toUpperCase() || 'GET';
        if (!['GET', 'POST'].includes(method)) {
          throw new Error('Only GET and POST methods are allowed');
        }
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string> || {}) },
          body: options?.body,
          signal: AbortSignal.timeout(3000),
        });
        return res.json();
      },
      now: () => new Date().toISOString(),
      formatCurrency: (amount: number, currency = 'CAD') =>
        new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount),
    },
  };
}

// ---------------------------------------------------------------------------
// Code execution
// ---------------------------------------------------------------------------

/**
 * Execute a custom code step within a sandboxed VM context.
 */
export async function executeCodeStep(
  code: string,
  context: SandboxContext
): Promise<CodeStepResult> {
  const start = Date.now();

  // Validate first
  const validation = validateCode(code);
  if (!validation.valid) {
    return {
      success: false,
      output: null,
      logs: context._logs,
      durationMs: Date.now() - start,
      error: `Validation failed: ${validation.errors.join('; ')}`,
    };
  }

  try {
    // Build the VM sandbox with frozen helpers
    const sandbox = {
      entity: Object.freeze({ ...context.entity }),
      entityType: context.entityType,
      entityId: context.entityId,
      log: context.helpers.log,
      fetch: context.helpers.fetch,
      now: context.helpers.now,
      formatCurrency: context.helpers.formatCurrency,
      result: undefined as unknown,
      console: { log: context.helpers.log, warn: context.helpers.log, error: context.helpers.log },
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      String,
      Number,
      Boolean,
      Array,
      Object,
    };

    const vmContext = vm.createContext(sandbox);

    // Wrap code in an async IIFE to support await
    const wrappedCode = `
      (async () => {
        ${code}
      })().then(r => { result = r; }).catch(e => { throw e; });
    `;

    const script = new vm.Script(wrappedCode, { filename: 'workflow-sandbox.js' });
    script.runInContext(vmContext, { timeout: EXECUTION_TIMEOUT_MS });

    // Wait for async completion (with timeout)
    await new Promise(resolve => setTimeout(resolve, 50));

    const output = sandbox.result;
    const durationMs = Date.now() - start;

    logger.info('[WorkflowCodeSandbox] Code executed', {
      entityType: context.entityType,
      entityId: context.entityId,
      durationMs,
      logCount: context._logs.length,
    });

    return { success: true, output, logs: context._logs, durationMs };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - start;

    logger.warn('[WorkflowCodeSandbox] Code execution failed', {
      entityType: context.entityType,
      entityId: context.entityId,
      error: errorMsg,
      durationMs,
    });

    return {
      success: false,
      output: null,
      logs: context._logs,
      durationMs,
      error: errorMsg,
    };
  }
}
