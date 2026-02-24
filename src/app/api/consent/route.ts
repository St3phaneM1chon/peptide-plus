export const dynamic = 'force-dynamic';

/**
 * COOKIE CONSENT API
 *
 * GET  /api/consent - Get current consent preferences
 * POST /api/consent - Save consent preferences
 *
 * Consent categories:
 *   - essential: always true, cannot be disabled
 *   - analytics: Google Analytics, Hotjar, etc.
 *   - marketing: Facebook Pixel, Google Ads, etc.
 *   - personalization: product recommendations, saved preferences
 *
 * Storage: Redis (fast access) with cookie fallback.
 *
 * TODO: FLAW-069 - Add composite index @@index([email, type]) to ConsentRecord model in schema.prisma
 * Identifies users by userId (if logged in) or a consent session cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { getRedisClient, isRedisAvailable } from '@/lib/redis';
import { cookies } from 'next/headers';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsentPreferences {
  essential: true; // Always true
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
}

interface ConsentRecord {
  userId: string | null;
  sessionId: string;
  preferences: ConsentPreferences;
  timestamp: string;
  ipAddress: string;
  version: string; // Consent policy version
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONSENT_COOKIE_NAME = 'consent-id';
const CONSENT_VERSION = '1.0';
const REDIS_PREFIX = 'consent:';
const CONSENT_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

// In-memory fallback
const memoryStore = new Map<string, ConsentRecord>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CONSENT_COOKIE_NAME)?.value;
  if (existing) return existing;

  // AMELIORATION: Use crypto.randomUUID instead of Math.random for session IDs
  const newId = `cs_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  cookieStore.set(CONSENT_COOKIE_NAME, newId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CONSENT_TTL_SECONDS,
  });
  return newId;
}

function resolveKey(userId: string | null, sessionId: string): string {
  return userId ? `user:${userId}` : `session:${sessionId}`;
}

async function loadConsent(key: string): Promise<ConsentRecord | null> {
  // Try Redis
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const raw = await redis.get(`${REDIS_PREFIX}${key}`);
        if (raw) return JSON.parse(raw);
      }
    } catch (error) {
      logger.error('[Consent] Redis load consent failed, falling through to memory', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Memory fallback
  return memoryStore.get(key) || null;
}

async function saveConsent(key: string, record: ConsentRecord): Promise<void> {
  const serialized = JSON.stringify(record);

  // Try Redis
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.set(`${REDIS_PREFIX}${key}`, serialized, 'EX', CONSENT_TTL_SECONDS);
        return;
      }
    } catch (error) {
      logger.error('[Consent] Redis save consent failed, falling through to memory', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Memory fallback
  memoryStore.set(key, record);
}

// ---------------------------------------------------------------------------
// GET - Retrieve current consent preferences
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id || null;
    const sessionId = await getOrCreateSessionId();
    const key = resolveKey(userId, sessionId);

    const record = await loadConsent(key);

    if (!record) {
      // No consent recorded yet - return defaults (all false except essential)
      return NextResponse.json({
        hasConsent: false,
        preferences: {
          essential: true,
          analytics: false,
          marketing: false,
          personalization: false,
        },
        version: CONSENT_VERSION,
      });
    }

    return NextResponse.json({
      hasConsent: true,
      preferences: record.preferences,
      timestamp: record.timestamp,
      version: record.version,
    });
  } catch (error) {
    logger.error('[consent] Failed to get preferences', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to retrieve consent preferences' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const consentSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  personalization: z.boolean(),
});

// ---------------------------------------------------------------------------
// POST - Save consent preferences
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit consent saves
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/consent');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate preferences with Zod
    const parsed = consentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid consent preferences. Each category must be a boolean.', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { analytics, marketing, personalization } = parsed.data;

    const session = await auth();
    const userId = session?.user?.id || null;
    const sessionId = await getOrCreateSessionId();
    const key = resolveKey(userId, sessionId);
    const ipAddress = getClientIp(request);

    const preferences: ConsentPreferences = {
      essential: true, // Always true
      analytics,
      marketing,
      personalization,
    };

    const record: ConsentRecord = {
      userId,
      sessionId,
      preferences,
      timestamp: new Date().toISOString(),
      ipAddress,
      version: CONSENT_VERSION,
    };

    await saveConsent(key, record);

    logger.info('[consent] Preferences saved', {
      userId,
      sessionId: sessionId.substring(0, 12) + '...',
      analytics,
      marketing,
      personalization,
    });

    return NextResponse.json({
      success: true,
      preferences: record.preferences,
      timestamp: record.timestamp,
      version: record.version,
    });
  } catch (error) {
    logger.error('[consent] Failed to save preferences', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to save consent preferences' },
      { status: 500 }
    );
  }
}
