/**
 * MIDDLEWARE NEXT.JS
 * Gestion des locales et de l'authentification
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

// Routes admin/owner uniquement
const adminRoutes = ['/admin'];
const ownerRoutes = ['/owner'];
// Routes pour les clients (compagnies)
const clientRoutes = ['/client', '/dashboard/client'];

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
