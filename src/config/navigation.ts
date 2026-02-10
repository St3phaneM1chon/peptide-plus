/**
 * NAVIGATION CONFIGURATION
 * Structure complète du menu pour sites corporatifs
 * Configurable selon le type d'entreprise
 */

export interface NavItem {
  key: string;           // Clé de traduction (nav.xxx)
  href: string;
  icon?: string;
  children?: NavItem[];
  badge?: string;        // "new", "beta", etc.
  external?: boolean;
  requiresAuth?: boolean;
  roles?: string[];      // Rôles autorisés
}

export interface FooterSection {
  key: string;
  items: NavItem[];
}

// =====================================================
// MENU PRINCIPAL
// =====================================================

export const mainNavigation: NavItem[] = [
  {
    key: 'home',
    href: '/',
  },
  {
    key: 'about',
    href: '/a-propos',
    children: [
      { key: 'aboutUs', href: '/a-propos' },
      { key: 'mission', href: '/a-propos/mission' },
      { key: 'team', href: '/a-propos/equipe' },
      { key: 'history', href: '/a-propos/histoire' },
      { key: 'values', href: '/a-propos/valeurs' },
      { key: 'commitments', href: '/a-propos/engagements' },
    ],
  },
  {
    key: 'products',
    href: '/catalogue',
    children: [
      { key: 'allProducts', href: '/catalogue' },
      { key: 'courses', href: '/catalogue/formations' },
      { key: 'certifications', href: '/catalogue/certifications' },
      { key: 'byIndustry', href: '/catalogue/industries' },
    ],
  },
  {
    key: 'solutions',
    href: '/solutions',
    children: [
      { key: 'forCompanies', href: '/solutions/entreprises' },
      { key: 'forIndividuals', href: '/solutions/particuliers' },
      { key: 'forPartners', href: '/solutions/partenaires' },
      { key: 'byUseCase', href: '/solutions/cas-usage' },
    ],
  },
  {
    key: 'clients',
    href: '/clients',
    children: [
      { key: 'testimonials', href: '/clients/temoignages' },
      { key: 'caseStudies', href: '/clients/etudes-de-cas' },
      { key: 'references', href: '/clients/references' },
    ],
  },
  {
    key: 'resources',
    href: '/ressources',
    children: [
      { key: 'blog', href: '/blog' },
      { key: 'news', href: '/actualites' },
      { key: 'guides', href: '/ressources/guides' },
      { key: 'webinars', href: '/ressources/webinaires' },
      { key: 'faq', href: '/faq' },
    ],
  },
  {
    key: 'careers',
    href: '/carrieres',
  },
  {
    key: 'contact',
    href: '/contact',
  },
];

// =====================================================
// MENU UTILITAIRE (en-tête droite)
// =====================================================

export const utilityNavigation: NavItem[] = [
  {
    key: 'help',
    href: '/aide',
    icon: 'help',
  },
  {
    key: 'login',
    href: '/auth/signin',
    icon: 'user',
  },
];

// =====================================================
// CALL-TO-ACTION PRINCIPAL
// =====================================================

export const ctaNavigation: NavItem = {
  key: 'requestDemo',
  href: '/demo',
};

// =====================================================
// FOOTER
// =====================================================

export const footerNavigation: FooterSection[] = [
  {
    key: 'company',
    items: [
      { key: 'aboutUs', href: '/a-propos' },
      { key: 'team', href: '/a-propos/equipe' },
      { key: 'careers', href: '/carrieres' },
      { key: 'press', href: '/presse' },
      { key: 'contact', href: '/contact' },
    ],
  },
  {
    key: 'products',
    items: [
      { key: 'catalog', href: '/catalogue' },
      { key: 'courses', href: '/catalogue/formations' },
      { key: 'certifications', href: '/catalogue/certifications' },
      { key: 'pricing', href: '/tarifs' },
    ],
  },
  {
    key: 'resources',
    items: [
      { key: 'blog', href: '/blog' },
      { key: 'guides', href: '/ressources/guides' },
      { key: 'faq', href: '/faq' },
      { key: 'support', href: '/support' },
      { key: 'documentation', href: '/docs' },
    ],
  },
  {
    key: 'legal',
    items: [
      { key: 'terms', href: '/mentions-legales/conditions' },
      { key: 'privacy', href: '/mentions-legales/confidentialite' },
      { key: 'cookies', href: '/mentions-legales/cookies' },
      { key: 'security', href: '/securite' },
      { key: 'accessibility', href: '/accessibilite' },
    ],
  },
];

// =====================================================
// LIENS LÉGAUX (bas de footer)
// =====================================================

export const legalLinks: NavItem[] = [
  { key: 'terms', href: '/mentions-legales/conditions' },
  { key: 'privacy', href: '/mentions-legales/confidentialite' },
  { key: 'cookies', href: '/mentions-legales/cookies' },
  { key: 'sitemap', href: '/plan-du-site' },
];

// =====================================================
// RÉSEAUX SOCIAUX
// =====================================================

export const socialLinks = [
  { name: 'LinkedIn', href: process.env.NEXT_PUBLIC_LINKEDIN_URL || '#', icon: 'linkedin' },
  { name: 'Twitter', href: process.env.NEXT_PUBLIC_TWITTER_URL || '#', icon: 'twitter' },
  { name: 'Facebook', href: process.env.NEXT_PUBLIC_FACEBOOK_URL || '#', icon: 'facebook' },
  { name: 'Instagram', href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || '#', icon: 'instagram' },
  { name: 'YouTube', href: process.env.NEXT_PUBLIC_YOUTUBE_URL || '#', icon: 'youtube' },
];

// =====================================================
// DASHBOARD NAVIGATION (après connexion)
// =====================================================

export const dashboardNavigation: Record<string, NavItem[]> = {
  CUSTOMER: [
    { key: 'dashboard', href: '/dashboard/customer' },
    { key: 'myOrders', href: '/account/orders' },
    { key: 'myRewards', href: '/rewards' },
    { key: 'profile', href: '/account/profile' },
    { key: 'shop', href: '/shop' },
  ],
  CLIENT: [
    { key: 'dashboard', href: '/dashboard/client' },
    { key: 'company', href: '/client/entreprise' },
    { key: 'students', href: '/client/etudiants' },
    { key: 'addStudent', href: '/client/etudiants/ajouter' },
    { key: 'purchases', href: '/client/achats' },
    { key: 'reports', href: '/client/rapports' },
    { key: 'catalog', href: '/catalogue' },
  ],
  EMPLOYEE: [
    { key: 'dashboard', href: '/dashboard/employee' },
    { key: 'clients', href: '/dashboard/employee/clients' },
    { key: 'addClient', href: '/dashboard/employee/clients/nouveau' },
    { key: 'customers', href: '/dashboard/employee/customers' },
    { key: 'products', href: '/admin/produits' },
    { key: 'categories', href: '/admin/categories' },
    { key: 'orders', href: '/dashboard/employee/ventes' },
    { key: 'chat', href: '/admin/chat' },
  ],
  OWNER: [
    { key: 'dashboard', href: '/owner/dashboard' },
    { key: 'analytics', href: '/owner/analytiques' },
    { key: 'revenue', href: '/owner/revenus' },
    { key: 'users', href: '/admin/utilisateurs' },
    { key: 'products', href: '/admin/produits' },
    { key: 'categories', href: '/admin/categories' },
    { key: 'orders', href: '/admin/commandes' },
    { key: 'settings', href: '/owner/parametres' },
    { key: 'chat', href: '/admin/chat' },
  ],
};

// =====================================================
// CONFIGURATION PAR TYPE D'ENTREPRISE
// =====================================================

export type BusinessType = 'saas' | 'formation' | 'ecommerce' | 'corporate' | 'agency';

export const navigationByBusinessType: Record<BusinessType, Partial<typeof mainNavigation>> = {
  saas: [
    { key: 'home', href: '/' },
    { key: 'features', href: '/fonctionnalites' },
    { key: 'pricing', href: '/tarifs' },
    { key: 'docs', href: '/documentation' },
    { key: 'blog', href: '/blog' },
    { key: 'contact', href: '/contact' },
  ],
  formation: mainNavigation, // Par défaut
  ecommerce: [
    { key: 'home', href: '/' },
    { key: 'catalog', href: '/catalogue' },
    { key: 'categories', href: '/categories' },
    { key: 'deals', href: '/promotions' },
    { key: 'about', href: '/a-propos' },
    { key: 'contact', href: '/contact' },
  ],
  corporate: [
    { key: 'home', href: '/' },
    { key: 'about', href: '/a-propos' },
    { key: 'services', href: '/services' },
    { key: 'clients', href: '/clients' },
    { key: 'careers', href: '/carrieres' },
    { key: 'investors', href: '/investisseurs' },
    { key: 'news', href: '/actualites' },
    { key: 'contact', href: '/contact' },
  ],
  agency: [
    { key: 'home', href: '/' },
    { key: 'services', href: '/services' },
    { key: 'portfolio', href: '/portfolio' },
    { key: 'team', href: '/equipe' },
    { key: 'blog', href: '/blog' },
    { key: 'contact', href: '/contact' },
  ],
};

export default {
  main: mainNavigation,
  utility: utilityNavigation,
  cta: ctaNavigation,
  footer: footerNavigation,
  legal: legalLinks,
  social: socialLinks,
  dashboard: dashboardNavigation,
};
