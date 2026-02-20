/**
 * Environment variable validation using Zod.
 *
 * - Required vars throw in production, warn in development.
 * - Important vars always warn if missing.
 * - Optional vars are silently absent.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   const dbUrl = env.DATABASE_URL;
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Server-side environment variables (never exposed to the browser).
 */
const serverSchema = z.object({
  // ---- Required (app will not function without these) ----
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),

  // ---- Important (degraded experience if missing) ----
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // ---- OAuth providers (optional) ----
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),

  // ---- Azure AD (optional) ----
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_TENANT_ID: z.string().optional(),
  AZURE_KEY_VAULT_URL: z.string().optional(),

  // ---- PayPal (optional) ----
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_MODE: z.enum(['sandbox', 'live']).optional(),
  PAYPAL_SANDBOX: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),

  // ---- Email ----
  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid', 'smtp', 'log']).optional(),
  SMTP_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  INTERNAL_API_KEY: z.string().optional(),

  // ---- OpenAI (optional) ----
  OPENAI_API_KEY: z.string().optional(),

  // ---- Security ----
  ENCRYPTION_KEY: z.string().optional(),
  CSRF_SECRET: z.string().optional(),

  // ---- Business information ----
  BUSINESS_NAME: z.string().optional(),
  BUSINESS_ADDRESS: z.string().optional(),
  BUSINESS_STREET: z.string().optional(),
  BUSINESS_CITY: z.string().optional(),
  BUSINESS_PROVINCE: z.string().optional(),
  BUSINESS_POSTAL_CODE: z.string().optional(),
  BUSINESS_PHONE: z.string().optional(),
  BUSINESS_EMAIL: z.string().optional(),
  TPS_NUMBER: z.string().optional(),
  TVQ_NUMBER: z.string().optional(),
  NEQ_NUMBER: z.string().optional(),
  BUSINESS_TPS: z.string().optional(),
  BUSINESS_TVQ: z.string().optional(),

  // ---- Site configuration (server-side) ----
  SITE_ID: z.string().optional(),
  SITE_NAME: z.string().optional(),
  LOGO_URL: z.string().optional(),

  // ---- Chat ----
  CHAT_ENABLED: z.string().optional(),
  CHAT_NOTIFICATION_EMAIL: z.string().optional(),
  CHAT_WEBHOOK_URL: z.string().optional(),
  CHAT_RESPONSE_TIME: z.string().optional(),
  CHAT_BUSINESS_HOURS_ENABLED: z.string().optional(),
  CHAT_TIMEZONE: z.string().optional(),
  CHAT_HOURS_MON: z.string().optional(),
  CHAT_HOURS_TUE: z.string().optional(),
  CHAT_HOURS_WED: z.string().optional(),
  CHAT_HOURS_THU: z.string().optional(),
  CHAT_HOURS_FRI: z.string().optional(),
  CHAT_HOURS_SAT: z.string().optional(),
  CHAT_HOURS_SUN: z.string().optional(),
  NOTIFY_EMAIL_ON_MESSAGE: z.string().optional(),
  NOTIFY_WEBHOOK_ON_MESSAGE: z.string().optional(),

  // ---- Node ----
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

/**
 * Client-side environment variables (NEXT_PUBLIC_* -- available in the browser).
 */
const clientSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_SITE_NAME: z.string().optional(),
  NEXT_PUBLIC_SITE_DESCRIPTION: z.string().optional(),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().optional(),
  NEXT_PUBLIC_CONTACT_EMAIL: z.string().optional(),
  NEXT_PUBLIC_INFO_EMAIL: z.string().optional(),
  NEXT_PUBLIC_ADDRESS: z.string().optional(),
  NEXT_PUBLIC_CITY: z.string().optional(),
  NEXT_PUBLIC_PHONE: z.string().optional(),
  NEXT_PUBLIC_EMAIL: z.string().optional(),
  NEXT_PUBLIC_LINKEDIN_URL: z.string().optional(),
  NEXT_PUBLIC_TWITTER_URL: z.string().optional(),
  NEXT_PUBLIC_FACEBOOK_URL: z.string().optional(),
  NEXT_PUBLIC_INSTAGRAM_URL: z.string().optional(),
  NEXT_PUBLIC_YOUTUBE_URL: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Classification lists (used for warnings and health checks)
// ---------------------------------------------------------------------------

/** Vars that MUST exist -- app cannot start without them in production. */
export const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const;

/** Vars that SHOULD exist -- features degrade without them. */
export const IMPORTANT_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CRON_SECRET',
  'REDIS_URL',
] as const;

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

function getEnvValue(key: string): string | undefined {
  const val = process.env[key];
  // Treat empty strings as undefined
  if (val === undefined || val === '') return undefined;
  return val;
}

function buildEnvObject(): Record<string, string | undefined> {
  const allKeys = [
    ...Object.keys(serverSchema.shape),
    ...Object.keys(clientSchema.shape),
  ];
  const obj: Record<string, string | undefined> = {};
  for (const key of allKeys) {
    obj[key] = getEnvValue(key);
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Parse & validate
// ---------------------------------------------------------------------------

const combined = serverSchema.merge(clientSchema);

type Env = z.infer<typeof combined>;

function validateEnv(): Env {
  const raw = buildEnvObject();
  const isProd = process.env.NODE_ENV === 'production';
  const isBuildPhase = !!process.env.NEXT_PHASE;

  // ---- Warn about important vars ----
  for (const key of IMPORTANT_VARS) {
    if (!raw[key]) {
      console.warn(`[env] WARNING: ${key} is not set. Some features may not work.`);
    }
  }

  // ---- Parse with Zod ----
  const result = combined.safeParse(raw);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    const message = `Environment validation failed:\n${formatted}`;

    // During Next.js build phase, env vars may not be available -- warn only
    if (isProd && !isBuildPhase) {
      throw new Error(message);
    }

    // In development or build phase, log and return a best-effort object
    console.warn(`[env] ${message}`);

    // Return raw values cast to the type -- the dev/build is warned
    return raw as unknown as Env;
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Typed, validated environment variables.
 * Import this instead of using `process.env` directly.
 */
export const env: Env = validateEnv();

/**
 * Re-export the schemas so other modules (like env-check) can use them.
 */
export { serverSchema, clientSchema, combined as envSchema };

export type { Env };
