/**
 * MIDDLEWARE NEXT.JS
 * Gestion des locales, authentification et permissions granulaires
 *
 * TODO: FAILLE-082 - No DB schema verification at startup; add health check with prisma.$queryRaw for critical tables
 * TODO: FAILLE-089 - No helmet/next-secure-headers package; consider adding centralized security headers management
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { defaultLocale, isValidLocale, type Locale, getLocaleFromHeaders } from '@/i18n/config';
import { roleHasPermission } from '@/lib/permission-constants';

// FAILLE-099 FIX: Use crypto.getRandomValues fallback instead of Math.random
function generateRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback using crypto.getRandomValues (available in Edge runtime)
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
}

// Routes qui nécessitent une authentification
const protectedRoutes = [
  '/dashboard',
  '/admin',
  '/owner',
  '/client',
  '/account',
  '/checkout/payment',
  '/checkout/confirm',
  '/order',
  '/profile',
];

// Routes publiques même si dans un chemin protégé
const publicRoutes = [
  '/checkout',
  '/checkout/success',
];

// Admin sub-routes mapped to the minimum permission required.
// If a route is not listed here, the default admin role check (EMPLOYEE|OWNER) applies.
// OWNER always bypasses these checks.
const ADMIN_ROUTE_PERMISSIONS: Record<string, string> = {
  '/admin/produits': 'products.view',
  '/admin/categories': 'categories.view',
  '/admin/commandes': 'orders.view',
  '/admin/utilisateurs': 'users.view',
  '/admin/contenu': 'cms.pages.view',
  '/admin/hero-slides': 'cms.hero.manage',
  '/admin/livraison': 'shipping.view',
  '/admin/codes-promo': 'marketing.promos.manage',
  '/admin/promotions': 'marketing.discounts.manage',
  '/admin/newsletter': 'marketing.newsletter.manage',
  '/admin/chat': 'chat.view',
  '/admin/emails': 'chat.respond',
  '/admin/medias': 'media.view',
  '/admin/inventaire': 'products.manage_inventory',
  '/admin/seo': 'seo.edit',
  '/admin/comptabilite': 'accounting.view',
  '/admin/permissions': 'users.manage_permissions',
  '/admin/settings': 'admin.settings',
  // FAILLE-061 FIX: Restrict audit logs to users with audit_log permission
  '/admin/logs': 'admin.audit_log',
};

// Routes admin/owner uniquement
const adminRoutes = ['/admin'];
const ownerRoutes = ['/owner'];
// Routes pour les clients (compagnies)
const clientRoutes = ['/client', '/dashboard/client'];

// FAILLE-009: EMPLOYEE_PERMISSIONS and roleHasPermission moved to
// src/lib/permission-constants.ts (single source of truth)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate a correlation ID for every request (useful for tracing)
  const requestId = request.headers.get('x-request-id') || generateRequestId();

  // Skip auth routes early (static files are already excluded by the matcher config below)
  if (pathname.startsWith('/auth')) {
    const res = NextResponse.next();
    res.headers.set('x-request-id', requestId);
    // SECURITY: Apply security headers to auth pages
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return res;
  }

  // --- Request logging (Improvement #88) ---
  // Skip health checks from logging to avoid noise
  const isHealthCheck = pathname === '/api/health';
  if (!isHealthCheck) {
    // TODO: FAILLE-081 - 10% sampling silences 90% of requests; use structured logging service with configurable sampling
    // In production sample at 10%, in dev log all
    const isProduction = process.env.NODE_ENV === 'production';
    const shouldLog = !isProduction || Math.random() < 0.1;

    if (shouldLog) {
      // startTime used for x-request-start header
      const startTime = Date.now(); void startTime;
      // Log is appended via x-request-start header for downstream duration calculation
      // Edge runtime cannot use Winston, so we use structured console.log with JSON
      const logEntry = {
        event: 'request',
        method: request.method,
        path: pathname,
        requestId,
        // FAILLE-064 FIX: Increase UA truncation from 100 to 256 for better anomaly detection
        userAgent: request.headers.get('user-agent')?.substring(0, 256),
        // FAILLE-063 FIX: Validate IP format before logging to prevent log injection
        ip: (() => {
          const raw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
          return raw && /^[\d.:a-fA-F]{3,45}$/.test(raw) ? raw : undefined;
        })(),
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(logEntry));
    }
  }

  // Fix 3 (BE-CORS): Add CORS headers for API routes
  if (pathname.startsWith('/api')) {
    // Handle preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      const preflightResponse = new NextResponse(null, { status: 204 });
      preflightResponse.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com');
      preflightResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      // AMELIORATION SYS-001: Include x-csrf-token in CORS allowed headers for cross-origin CSRF protection
      preflightResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, x-request-id, x-csrf-token');
      // FAILLE-080 FIX: Reduce CORS preflight cache to 1h (was 24h) for faster CORS policy updates
      preflightResponse.headers.set('Access-Control-Max-Age', '3600');
      preflightResponse.headers.set('x-request-id', requestId);
      return preflightResponse;
    }

    // P1-8: Defense-in-depth auth logging for /api/admin/* routes.
    // The actual auth enforcement is handled by withAdminGuard() in each route handler.
    // We only LOG suspicious unauthenticated admin API requests here — blocking is left
    // to the per-route guard to avoid breaking the site if middleware token resolution
    // differs from the route-level auth (e.g. different cookie names on Azure).
    if (pathname.startsWith('/api/admin')) {
      try {
        const adminToken = await getToken({
          req: request,
          secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
          secureCookie: false,
          cookieName: 'authjs.session-token',
        });
        if (!adminToken) {
          console.warn(JSON.stringify({ event: 'middleware_admin_api_no_token', pathname, method: request.method }));
        }
      } catch {
        // Token resolution failed — don't block, just log
      }
    }

    const res = NextResponse.next();
    res.headers.set('x-request-id', requestId);
    res.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, x-request-id, x-csrf-token');
    // SECURITY: Apply security headers to API responses (mitigate XSS, clickjacking, MIME sniffing)
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return res;
  }

  // --- Performance optimization: skip getToken() for public routes ---
  // These routes never need authentication checks. By returning early we avoid
  // the cost of JWT decoding (crypto) on every public page load.
  const publicPathPrefixes = [
    '/shop', '/products', '/blog', '/about', '/contact',
    '/legal', '/faq', '/search', '/community',
  ];
  const isPublicPage =
    pathname === '/' ||
    publicPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));

  if (isPublicPage) {
    // Still resolve locale from cookie / Accept-Language (no token needed)
    let locale: Locale = defaultLocale;
    const localeCookie = request.cookies.get('locale')?.value;
    if (localeCookie && isValidLocale(localeCookie)) {
      locale = localeCookie as Locale;
    } else {
      locale = getLocaleFromHeaders(request.headers.get('accept-language'));
    }
    const res = NextResponse.next();
    res.headers.set('x-request-id', requestId);
    res.headers.set('x-locale', locale);
    // SECURITY: Apply security headers to public pages (mitigate XSS, clickjacking, MIME sniffing)
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return res;
  }

  // Récupérer le token d'authentification
  // Cookie name matches the explicit config in auth-config.ts (no __Secure- prefix)
  // to avoid name mismatch on Azure where TLS terminates at the load balancer.
  // FAILLE-023 FIX: Warn if no auth secret is configured
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    console.warn(JSON.stringify({ event: 'middleware_no_auth_secret', pathname }));
  }
  let token = null;
  try {
    token = await getToken({
      req: request,
      // FAILLE-023 FIX: Use AUTH_SECRET with NEXTAUTH_SECRET fallback (both are valid)
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      secureCookie: false,
      cookieName: 'authjs.session-token',
    });
  } catch (err) {
    console.error(JSON.stringify({
      event: 'middleware_getToken_error',
      pathname,
      error: String(err),
      hasCookie: !!request.cookies.get('authjs.session-token'),
      cookieLength: request.cookies.get('authjs.session-token')?.value?.length || 0,
    }));
  }

  // Récupérer la locale
  let locale: Locale = defaultLocale;

  // 1. Vérifier si l'utilisateur est connecté et a une préférence
  if (token?.locale && isValidLocale(token.locale as string)) {
    locale = token.locale as Locale;
  }
  // 2. Vérifier le cookie de locale
  else {
    const localeCookie = request.cookies.get('locale')?.value;
    if (localeCookie && isValidLocale(localeCookie)) {
      locale = localeCookie as Locale;
    }
    // 3. Utiliser Accept-Language
    else {
      locale = getLocaleFromHeaders(request.headers.get('accept-language'));
    }
  }

  // Créer la réponse
  const response = NextResponse.next();

  // Correlation ID for request tracing
  response.headers.set('x-request-id', requestId);

  // Ajouter la locale en header pour les composants server
  response.headers.set('x-locale', locale);

  // Vérifier les routes protégées (exclure les routes publiques)
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));
  const isProtected = !isPublic && protectedRoutes.some((route) => pathname.startsWith(route));
  const isAdmin = adminRoutes.some((route) => pathname.startsWith(route));
  const isOwner = ownerRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !token) {
    // Rediriger vers la page de connexion
    const url = request.nextUrl.clone();
    url.pathname = '/auth/signin';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // SECURITY: MFA setup recommended for OWNER and EMPLOYEE roles (Chubb requirement)
  // Soft enforcement: redirect only on account/dashboard pages, not on admin or API
  // This allows admin access while showing MFA banner on the account settings page
  if (
    token &&
    (token.role === 'OWNER' || token.role === 'EMPLOYEE') &&
    !token.mfaEnabled &&
    (pathname.startsWith('/account') || pathname.startsWith('/dashboard')) &&
    !pathname.startsWith('/account/settings') &&
    !pathname.startsWith('/account/security') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/account/settings';
    url.searchParams.set('mfa_required', '1');
    return NextResponse.redirect(url);
  }

  // Vérifier les permissions admin (EMPLOYEE ou OWNER peuvent accéder)
  if (isAdmin && token?.role !== 'EMPLOYEE' && token?.role !== 'OWNER') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Granular admin sub-route permission check
  if (isAdmin && token?.role && token.role !== 'OWNER') {
    // Find the most specific matching route
    const matchedRoute = Object.keys(ADMIN_ROUTE_PERMISSIONS)
      .filter((route) => pathname.startsWith(route))
      .sort((a, b) => b.length - a.length)[0];

    if (matchedRoute) {
      const requiredPermission = ADMIN_ROUTE_PERMISSIONS[matchedRoute];
      if (!roleHasPermission(token.role as string, requiredPermission)) {
        const url = request.nextUrl.clone();
        url.pathname = '/admin';
        url.searchParams.set('denied', requiredPermission);
        return NextResponse.redirect(url);
      }
    }
  }

  // Vérifier les permissions owner
  if (isOwner && token?.role !== 'OWNER') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Vérifier les permissions client (compagnies)
  const isClientRoute = clientRoutes.some((route) => pathname.startsWith(route));
  if (isClientRoute && token?.role !== 'CLIENT' && token?.role !== 'OWNER') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // AMELIORATION SYS-002: Security headers to mitigate XSS, clickjacking, MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
