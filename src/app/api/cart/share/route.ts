export const dynamic = 'force-dynamic';

/**
 * Cart Sharing API
 * POST  - Generate a shareable cart token (JWT-encoded, rate-limited)
 * GET   - Load shared cart items from token (?token=xxx)
 *
 * Uses JWT encoding to keep it simple without needing a DB table.
 * The token encodes the cart items and expires after 7 days.
 *
 * POST is rate-limited per IP (10 req/min) to prevent abuse.
 * GET is public (anyone with the token can load a shared cart).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SignJWT, jwtVerify } from 'jose';
import { logger } from '@/lib/logger';
import { stripHtml } from '@/lib/sanitize';
import { getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SHARE_TOKEN_EXPIRY = '7d'; // 7 days

// COMMERCE-010 FIX: Use a dedicated CART_SHARE_SECRET instead of NEXTAUTH_SECRET.
// Reusing the session signing secret for cart JWTs means a leaked cart token
// exposes the auth secret, enabling session forgery for any user.
// Falls back to a derived key from NEXTAUTH_SECRET if CART_SHARE_SECRET is not set.
let _shareSecret: Uint8Array | null = null;
function getShareSecret(): Uint8Array {
  if (!_shareSecret) {
    const dedicatedSecret = process.env.CART_SHARE_SECRET;
    if (dedicatedSecret) {
      _shareSecret = new TextEncoder().encode(dedicatedSecret);
    } else {
      // Fallback: derive a separate key from NEXTAUTH_SECRET so the raw secret differs
      if (!process.env.NEXTAUTH_SECRET) {
        throw new Error('CART_SHARE_SECRET or NEXTAUTH_SECRET environment variable is required for cart sharing');
      }
      // Prefix ensures the derived key differs from the raw NEXTAUTH_SECRET
      _shareSecret = new TextEncoder().encode(`cart-share:${process.env.NEXTAUTH_SECRET}`);
    }
  }
  return _shareSecret;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const sharedCartItemSchema = z.object({
  productId: z.string().min(1),
  optionId: z.string().nullable().optional(),
  name: z.string().min(1).max(200),
  price: z.number().min(0),
  quantity: z.number().int().min(1).max(10),
  image: z.string().nullable().optional(),
});

const shareCartSchema = z.object({
  items: z.array(sharedCartItemSchema).min(1).max(50),
}).strict();

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface SharedCartPayload {
  items: Array<{
    productId: string;
    optionId?: string | null;
    name: string;
    price: number;
    quantity: number;
    image?: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// POST /api/cart/share - Generate shareable token
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP (centralized Redis-backed limiter, no memory leak)
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/cart/share');
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const parsed = shareCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      );
    }

    const { items } = parsed.data;

    // Encode cart items into a JWT token
    // XSS FIX: Strip HTML tags from name field before storing in JWT
    const payload: SharedCartPayload = {
      items: items.map((item) => ({
        productId: item.productId,
        optionId: item.optionId ?? null,
        name: stripHtml(item.name),
        price: item.price,
        quantity: item.quantity,
        image: item.image ?? null,
      })),
    };

    const token = await new SignJWT({ cart: payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(SHARE_TOKEN_EXPIRY)
      .sign(getShareSecret());

    // Build shareable URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || '';
    const shareUrl = baseUrl ? `${baseUrl}/cart/shared?token=${token}` : undefined;

    return NextResponse.json({
      success: true,
      token,
      shareUrl,
      expiresIn: '7 days',
    });
  } catch (error) {
    logger.error('Cart share POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/cart/share?token=xxx - Load shared cart
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 });
    }

    // Verify and decode the JWT
    let payload: SharedCartPayload;
    try {
      const { payload: decoded } = await jwtVerify(token, getShareSecret());
      payload = (decoded as { cart: SharedCartPayload }).cart;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired share token' },
        { status: 400 }
      );
    }

    if (!payload?.items || !Array.isArray(payload.items)) {
      return NextResponse.json({ error: 'Invalid cart data in token' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      items: payload.items,
      itemCount: payload.items.reduce((sum, item) => sum + item.quantity, 0),
    });
  } catch (error) {
    logger.error('Cart share GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
