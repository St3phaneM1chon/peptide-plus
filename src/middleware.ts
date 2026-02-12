/**
 * MIDDLEWARE NEXT.JS
 * Gestion des locales, authentification et permissions granulaires
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { defaultLocale, isValidLocale, type Locale, getLocaleFromHeaders } from '@/i18n/config';

// Routes qui nécessitent une authentification
const protectedRoutes = [
  '/dashboard',
  '/admin',
  '/owner',
  '/client',
  '/checkout/payment',
  '/checkout/confirm',
  '/order',
  '/profile',
];

// Routes publiques même si dans un chemin protégé
const publicRoutes = [
  '/checkout',
  '/checkout/cart',
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

  // Skip pour les fichiers statiques et API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname.startsWith('/auth')
  ) {
    return NextResponse.next();
  }

  // Récupérer le token d'authentification
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

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
