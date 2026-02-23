/**
 * Shared utilities for the email subsystem.
 */

/**
 * Safely parse a JSON string (or pass through an object) with an optional fallback.
 *
 * - If `input` is a string, attempts `JSON.parse`. On failure returns `fallback` (or `null`).
 * - If `input` is already a non-null object, returns it cast as `T`.
 * - For `null`, `undefined`, or other primitives, returns `fallback` (or `null`).
 *
 * Replaces the many per-file `safeParseJson` copies scattered across admin email routes.
 */
export function safeParseJson<T = unknown>(input: unknown, fallback?: T): T | null {
  if (typeof input === 'string') {
    if (!input) return fallback ?? null;
    try {
      return JSON.parse(input) as T;
    } catch {
      return fallback ?? null;
    }
  }
  if (typeof input === 'object' && input !== null) return input as T;
  return fallback ?? null;
}
