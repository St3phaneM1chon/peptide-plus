/**
 * API: GET /api/platform/check-slug?slug=xxx
 * Checks if a tenant slug is available for registration.
 * Public endpoint — used by the signup form for real-time validation.
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/admin-audit';

// Reserved slugs that cannot be used by tenants
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'billing', 'blog', 'cdn', 'checkout',
  'dashboard', 'demo', 'dev', 'docs', 'help', 'koraline', 'login',
  'mail', 'platform', 'signup', 'status', 'support', 'www', 'test',
  'staging', 'prod', 'production', 'attitudes', 'vip',
]);

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 30 checks per minute per IP
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/platform/check-slug');
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const slug = request.nextUrl.searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter required' }, { status: 400 });
    }

    // Validate format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug) || slug.length < 3 || slug.length > 30) {
      return NextResponse.json({
        available: false,
        reason: 'Format invalide (3-30 caracteres, lettres minuscules, chiffres, tirets)',
      });
    }

    // Check reserved slugs
    if (RESERVED_SLUGS.has(slug)) {
      return NextResponse.json({
        available: false,
        reason: 'Ce nom est reserve',
      });
    }

    // Check database
    const existing = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });

    return NextResponse.json({
      available: !existing,
      reason: existing ? 'Ce slug est deja pris' : undefined,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
