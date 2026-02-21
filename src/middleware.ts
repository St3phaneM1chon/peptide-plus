/**
 * MIDDLEWARE NEXT.JS
 * Gestion des locales, authentification et permissions granulaires
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { defaultLocale, isValidLocale, type Locale, getLocaleFromHeaders } from '@/i18n/config';

// Lightweight UUID v4 generator for Edge runtime (no crypto.randomUUID in all runtimes)
function generateRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for environments without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
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
};

// Routes admin/owner uniquement
const adminRoutes = ['/admin'];
const ownerRoutes = ['/owner'];
// Routes pour les clients (compagnies)
const clientRoutes = ['/client', '/dashboard/client'];

// Role-based default permissions (lightweight subset for middleware - no DB queries)
// This mirrors ROLE_DEFAULTS from src/lib/permissions.ts but is kept small for edge runtime.
const EMPLOYEE_PERMISSIONS = new Set([
  'products.view', 'products.create', 'products.edit', 'products.manage_formats', 'products.manage_images', 'products.manage_inventory',
  'categories.view', 'categories.create', 'categories.edit',
  'orders.view', 'orders.edit', 'orders.export',
  'users.view',
  'cms.pages.view', 'cms.pages.create', 'cms.pages.edit', 'cms.faq.manage', 'cms.blog.manage', 'cms.hero.manage',
  'accounting.view',
  'shipping.view', 'shipping.update_status',
  'marketing.promos.manage', 'marketing.discounts.manage', 'marketing.newsletter.manage',
  'chat.view', 'chat.respond',
  'media.view', 'media.upload',
  'analytics.view',
  'seo.edit',
]);

/**
 * Check if a role has a given permission code (fast, no DB).
 * For fine-grained per-user overrides, the page-level check via hasPermission() is authoritative.
 */
function roleHasPermission(role: string, permissionCode: string): boolean {
  if (role === 'OWNER') return true;
  if (role === 'EMPLOYEE') return EMPLOYEE_PERMISSIONS.has(permissionCode);
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate a correlation ID for every request (useful for tracing)
  const requestId = request.headers.get('x-request-id') || generateRequestId();

  // Skip auth routes early (static files are already excluded by the matcher config below)
  if (pathname.startsWith('/auth')) {
    const res = NextResponse.next();
    res.headers.set('x-request-id', requestId);
    return res;
  }

  // --- Request logging (Improvement #88) ---
  // Skip health checks from logging to avoid noise
  const isHealthCheck = pathname === '/api/health';
  if (!isHealthCheck) {
    // In production sample at 10%, in dev log all
    const isProduction = process.env.NODE_ENV === 'production';
    const shouldLog = !isProduction || Math.random() < 0.1;

    if (shouldLog) {
      const startTime = Date.now();
      // Log is appended via x-request-start header for downstream duration calculation
      // Edge runtime cannot use Winston, so we use structured console.log with JSON
      const logEntry = {
        event: 'request',
        method: request.method,
        path: pathname,
        requestId,
        userAgent: request.headers.get('user-agent')?.substring(0, 100),
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip'),
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
      preflightResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, x-request-id');
      preflightResponse.headers.set('Access-Control-Max-Age', '86400');
      preflightResponse.headers.set('x-request-id', requestId);
      return preflightResponse;
    }

    const res = NextResponse.next();
    res.headers.set('x-request-id', requestId);
    res.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, x-request-id');
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
    return res;
  }

  // Récupérer le token d'authentification
  // Cookie name matches the explicit config in auth-config.ts (no __Secure- prefix)
  // to avoid name mismatch on Azure where TLS terminates at the load balancer.
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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

  // SECURITY: Force MFA setup for OWNER and EMPLOYEE roles (Chubb requirement)
  if (
    token &&
    (token.role === 'OWNER' || token.role === 'EMPLOYEE') &&
    !token.mfaEnabled &&
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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
