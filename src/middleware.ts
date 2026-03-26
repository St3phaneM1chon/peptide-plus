/**
 * MIDDLEWARE NEXT.JS
 * Gestion des locales, authentification et permissions granulaires
 *
 * TODO: FAILLE-082 - No DB schema verification at startup; add health check with prisma.$queryRaw for critical tables
 * FIXED: FAILLE-089 - CSP and all security headers now set in addSecurityHeaders() (aligned with next.config.js)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { defaultLocale, isValidLocale, type Locale, getLocaleFromHeaders } from '@/i18n/config';
import { roleHasPermission } from '@/lib/permission-constants';

// Security headers applied to every response (AMELIORATION-002 / FAILLE-012 / FAILLE-017 / FAILLE-089).
// CSP is also defined in next.config.js headers() for static routes; middleware ensures dynamic
// routes are equally protected (some hosting platforms may not merge next.config headers on middleware responses).
function addSecurityHeaders(response: NextResponse): void {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Restrict browser features (aligned with next.config.js)
  // camera=(self) and microphone=(self): required for admin softphone (WebRTC/JsSIP)
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), interest-cohort=(), usb=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=()');
  // Disable DNS prefetching
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  // HSTS: Force HTTPS for 2 years (aligned with next.config.js FAILLE-012)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  // Content-Security-Policy — aligned with next.config.js (FAILLE-089 FIX)
  // unsafe-inline for scripts: required by Next.js inline scripts (nonce-based approach is a future improvement)
  // unsafe-inline for styles: required by Next.js styled-jsx, Radix UI, and Tailwind
  // unsafe-eval: only in development (needed for Next.js HMR/React Fast Refresh)
  //
  // TODO SEC-HARDENING: Subresource Integrity (SRI)
  // Implement SRI hashes for third-party scripts (Stripe, PayPal, Google Maps, GTM).
  // This requires:
  // 1. Computing SHA-384 hashes of each external script at build time
  // 2. Adding `integrity` attributes to <Script> tags in layout.tsx
  // 3. Adding `require-sri-for script style` to CSP (once browser support matures)
  // 4. Automating hash updates when vendors release new script versions
  // Reference: https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
  const cspDirectives = [
    "default-src 'self'",
    process.env.NODE_ENV === 'production'
      ? "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.paypal.com https://login.microsoftonline.com https://accounts.google.com https://appleid.cdn-apple.com https://www.googletagmanager.com https://maps.googleapis.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.paypal.com https://login.microsoftonline.com https://accounts.google.com https://appleid.cdn-apple.com https://www.googletagmanager.com https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob: https://maps.googleapis.com https://maps.gstatic.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.azure.com https://login.microsoftonline.com https://api.stripe.com https://www.paypal.com https://api.openai.com https://accounts.google.com https://oauth.googleapis.com https://appleid.apple.com https://graph.facebook.com https://api.x.com https://api.twitter.com https://twitter.com https://www.google-analytics.com https://www.googletagmanager.com wss://*.telnyx.com:7443 wss://sip.telnyx.com:7443 wss://rtc.telnyx.com https://rtc.telnyx.com https://api.telnyx.com https://maps.googleapis.com",
    "frame-src https://js.stripe.com https://www.paypal.com https://hooks.stripe.com https://accounts.google.com https://www.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com https://appleid.apple.com https://www.facebook.com https://x.com https://twitter.com",
    "object-src 'none'",
    "worker-src 'self'",
    ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
    // SEC-HARDENING: CSP violation reporting endpoint
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ];
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));
  // SEC-HARDENING: Report-To header for CSP reporting API (newer browsers)
  response.headers.set('Report-To', JSON.stringify({
    group: 'csp-endpoint',
    max_age: 86400,
    endpoints: [{ url: '/api/csp-report' }],
  }));
}

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
  '/admin/backups': 'admin.backups',
};

// Routes admin/owner uniquement
const adminRoutes = ['/admin'];
const ownerRoutes = ['/owner'];
// Routes pour les clients (compagnies)
const clientRoutes = ['/client', '/dashboard/client'];

// FAILLE-009: EMPLOYEE_PERMISSIONS and roleHasPermission moved to
// src/lib/permission-constants.ts (single source of truth)

// ---------------------------------------------------------------------------
// Multi-Tenant: Resolve tenant from request hostname
// ---------------------------------------------------------------------------
// The Edge Runtime cannot use Prisma directly. Instead, we resolve the tenant
// via a lightweight API call to /api/tenant/resolve on the first request,
// then cache it for subsequent requests. For Phase 1 (single tenant BioCycle),
// we use a simple hostname-based lookup.

/**
 * Returns the CORS origin for a given tenant slug.
 * Used for Access-Control-Allow-Origin headers.
 */
function getTenantOrigin(tenantSlug: string): string {
  const origins: Record<string, string> = {
    biocycle: process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip',
    attitudes: 'https://attitudes.vip',
  };
  return origins[tenantSlug] || `https://${tenantSlug}.koraline.app`;
}

function resolveTenantFromHost(hostname: string): { tenantSlug: string; isSuperAdmin: boolean } {
  const cleanHost = hostname.split(':')[0].toLowerCase();

  // Super-admin: attitudes.vip
  if (cleanHost === 'attitudes.vip' || cleanHost.endsWith('.attitudes.vip')) {
    return { tenantSlug: 'attitudes', isSuperAdmin: true };
  }

  // BioCycle production
  if (cleanHost === 'biocyclepeptides.com' || cleanHost === 'www.biocyclepeptides.com') {
    return { tenantSlug: 'biocycle', isSuperAdmin: false };
  }

  // Railway production domains
  if (cleanHost.endsWith('.up.railway.app')) {
    return { tenantSlug: 'attitudes', isSuperAdmin: true };
  }

  // Koraline subdomains: {slug}.koraline.app
  const koralineMatch = cleanHost.match(/^([a-z0-9-]+)\.koraline\.app$/);
  if (koralineMatch) {
    return { tenantSlug: koralineMatch[1], isSuperAdmin: false };
  }

  // Localhost / dev → default to attitudes (platform tenant)
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return { tenantSlug: 'attitudes', isSuperAdmin: false };
  }

  // Unknown domain → try to resolve via slug from first subdomain part
  // e.g., clientx.com → will be resolved by the API layer via DB lookup
  // Default to attitudes (platform tenant)
  return { tenantSlug: 'attitudes', isSuperAdmin: false };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // C3-SEC-S-007 FIX: Explicit HTTP-to-HTTPS redirect in production
  if (process.env.NODE_ENV === 'production' && request.headers.get('x-forwarded-proto') !== 'https') {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl.toString(), 301);
  }

  // Generate a correlation ID for every request (useful for tracing)
  const requestId = request.headers.get('x-request-id') || generateRequestId();

  // Multi-Tenant: Resolve tenant from hostname and inject into request headers
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'localhost';
  const { tenantSlug, isSuperAdmin } = resolveTenantFromHost(host);

  // ---------------------------------------------------------------------------
  // Super-Admin Tenant (attitudes.vip): Serve SaaS landing pages
  // Rewrites public-facing paths to the /platform route group which has its
  // own layout (no shop header/footer, Koraline SaaS branding).
  // Tenant shops are NOT affected — this only triggers for isSuperAdmin hosts.
  // ---------------------------------------------------------------------------
  if (isSuperAdmin) {
    const platformRoutes: Record<string, string> = {
      '/': '/platform',
      '/pricing': '/platform/pricing',
      '/demo': '/platform/demo',
    };
    const rewriteTo = platformRoutes[pathname];
    if (rewriteTo) {
      const url = request.nextUrl.clone();
      url.pathname = rewriteTo;
      const res = NextResponse.rewrite(url, {
        request: {
          headers: new Headers(request.headers),
        },
      });
      res.headers.set('x-request-id', requestId);
      res.headers.set('x-tenant-slug', tenantSlug);
      addSecurityHeaders(res);
      return res;
    }
  }

  // Skip auth routes early (static files are already excluded by the matcher config below)
  if (pathname.startsWith('/auth')) {
    const res = NextResponse.next({
      request: {
        headers: new Headers(request.headers),
      },
    });
    res.headers.set('x-request-id', requestId);
    res.headers.set('x-tenant-slug', tenantSlug);
    addSecurityHeaders(res);
    return res;
  }

  // --- Request logging (Improvement #88) ---
  // Skip health checks from logging to avoid noise
  const isHealthCheck = pathname === '/api/health';
  if (!isHealthCheck) {
    // F8 FIX: Log 100% of admin mutation requests (POST/PUT/PATCH/DELETE)
    // Keep 10% sampling only for public GET requests to reduce log volume
    const isProduction = process.env.NODE_ENV === 'production';
    const isAdminMutation = pathname.startsWith('/admin') && request.method !== 'GET';
    const isApiMutation = pathname.startsWith('/api/admin') && request.method !== 'GET';
    const shouldLog = !isProduction || isAdminMutation || isApiMutation || Math.random() < 0.1;

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
        // FAILLE-063 FIX: Validate IP format, prefer standard headers, use rightmost XFF
        // x-azure-clientip kept as last-resort fallback (harmless on non-Azure platforms)
        ip: (() => {
          const xff = request.headers.get('x-forwarded-for');
          if (xff) {
            const ips = xff.split(',').map((i: string) => i.trim()).filter((i: string) => /^[\d.:a-fA-F]{3,45}$/.test(i));
            if (ips.length > 0) return ips[ips.length - 1];
          }
          const realIp = request.headers.get('x-real-ip');
          if (realIp && /^[\d.:a-fA-F]{3,45}$/.test(realIp)) return realIp;
          // Fallback: Azure-specific header (no-op on Railway, kept for compatibility)
          const azureIp = request.headers.get('x-azure-clientip');
          return azureIp && /^[\d.:a-fA-F]{3,45}$/.test(azureIp) ? azureIp : undefined;
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
      preflightResponse.headers.set('Access-Control-Allow-Origin', getTenantOrigin(tenantSlug));
      preflightResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      // AMELIORATION SYS-001: Include x-csrf-token in CORS allowed headers for cross-origin CSRF protection
      preflightResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, x-request-id, x-csrf-token');
      // FAILLE-080 FIX: Reduce CORS preflight cache to 1h (was 24h) for faster CORS policy updates
      preflightResponse.headers.set('Access-Control-Max-Age', '3600');
      preflightResponse.headers.set('x-request-id', requestId);
      addSecurityHeaders(preflightResponse);
      return preflightResponse;
    }

    // Auth for /api/admin/* is enforced by withAdminGuard() in each route handler.
    // No middleware JWT decode needed here — saves 5-15ms per admin API request.

    const res = NextResponse.next({
      request: {
        headers: new Headers(request.headers),
      },
    });
    res.headers.set('x-request-id', requestId);
    res.headers.set('x-tenant-slug', tenantSlug);
    res.headers.set('Access-Control-Allow-Origin', getTenantOrigin(tenantSlug));
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, x-request-id, x-csrf-token');
    addSecurityHeaders(res);
    return res;
  }

  // --- Performance optimization: skip getToken() for public routes ---
  // These routes never need authentication checks. By returning early we avoid
  // the cost of JWT decoding (crypto) on every public page load.
  const publicPathPrefixes = [
    '/shop', '/products', '/blog', '/about', '/contact',
    '/legal', '/faq', '/search', '/community',
    '/platform', // SaaS landing pages (served via rewrite for attitudes.vip)
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
    const res = NextResponse.next({
      request: {
        headers: new Headers(request.headers),
      },
    });
    res.headers.set('x-request-id', requestId);
    res.headers.set('x-locale', locale);
    res.headers.set('x-tenant-slug', tenantSlug);
    addSecurityHeaders(res);
    return res;
  }

  // Retrieve auth token from the __Secure- prefixed session cookie.
  // Railway supports HTTPS natively, so the __Secure- prefix is stable.
  // FAILLE-023 FIX: Warn if no auth secret is configured
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    console.warn(JSON.stringify({ event: 'middleware_no_auth_secret', pathname }));
  }
  let token = null;
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieName = isProd ? '__Secure-authjs.session-token' : 'authjs.session-token';
    token = await getToken({
      req: request,
      // FAILLE-023 FIX: Use AUTH_SECRET with NEXTAUTH_SECRET fallback (both are valid)
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      secureCookie: isProd,
      cookieName,
    });
  } catch (err) {
    const cookieName = process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token';
    console.error(JSON.stringify({
      event: 'middleware_getToken_error',
      pathname,
      error: String(err),
      hasCookie: !!request.cookies.get(cookieName),
      cookieLength: request.cookies.get(cookieName)?.value?.length || 0,
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

  // Créer la réponse avec tenant headers propagés
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  // Correlation ID for request tracing
  response.headers.set('x-request-id', requestId);

  // Multi-Tenant headers
  response.headers.set('x-tenant-slug', tenantSlug);

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

  // FAILLE-053 FIX: OAuth users with MFA enabled must verify MFA before accessing protected areas
  // mfaVerified is false when user logged in via OAuth but hasn't completed MFA challenge
  if (
    token &&
    token.mfaEnabled &&
    token.mfaVerified === false &&
    !pathname.startsWith('/auth/mfa-verify') &&
    !pathname.startsWith('/auth/signout') &&
    !pathname.startsWith('/api/auth') &&
    !pathname.startsWith('/api/mfa')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/mfa-verify';
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

  // AMELIORATION SYS-002: Centralized security headers (HSTS, CSP, X-Frame-Options, etc.)
  addSecurityHeaders(response);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
