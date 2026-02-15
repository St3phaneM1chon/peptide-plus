/**
 * Environment health-check utility.
 *
 * Provides `checkEnvironment()` which returns a structured report
 * suitable for the /api/health endpoint.
 */

import { envSchema, REQUIRED_VARS, IMPORTANT_VARS } from '@/lib/env';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnvCheckResult {
  /** Overall pass / warn / fail */
  status: 'pass' | 'warn' | 'fail';
  /** Human-readable summary */
  message: string;
  /** Details broken down by category */
  details: {
    missingRequired: string[];
    missingImportant: string[];
    present: string[];
    totalDeclared: number;
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Validate the environment and return a health report.
 * This never throws -- errors are reported in the returned object.
 */
export function checkEnvironment(): EnvCheckResult {
  const allKeys = Object.keys(envSchema.shape);

  const present: string[] = [];
  const absent: string[] = [];

  for (const key of allKeys) {
    const val = process.env[key];
    if (val !== undefined && val !== '') {
      present.push(key);
    } else {
      absent.push(key);
    }
  }

  const missingRequired = REQUIRED_VARS.filter((k) => absent.includes(k));
  const missingImportant = IMPORTANT_VARS.filter((k) => absent.includes(k));

  // Determine overall status
  let status: EnvCheckResult['status'] = 'pass';
  if (missingImportant.length > 0) status = 'warn';
  if (missingRequired.length > 0) status = 'fail';

  // Build message
  const parts: string[] = [];
  if (missingRequired.length > 0) {
    parts.push(`Missing required: ${missingRequired.join(', ')}`);
  }
  if (missingImportant.length > 0) {
    parts.push(`Missing recommended: ${missingImportant.join(', ')}`);
  }
  if (parts.length === 0) {
    parts.push(`All ${present.length} environment variables are set`);
  } else {
    parts.push(`${present.length}/${allKeys.length} vars present`);
  }

  return {
    status,
    message: parts.join('. '),
    details: {
      missingRequired: [...missingRequired],
      missingImportant: [...missingImportant],
      present,
      totalDeclared: allKeys.length,
    },
  };
}
