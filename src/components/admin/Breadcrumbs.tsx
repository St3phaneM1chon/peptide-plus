'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  admin: 'Admin',
  dashboard: 'Tableau de bord',
  commandes: 'Commandes',
  produits: 'Produits',
  categories: 'Catégories',
  inventaire: 'Inventaire',
  customers: 'Clients',
  clients: 'Clients B2B',
  emails: 'Emails',
  newsletter: 'Newsletter',
  comptabilite: 'Comptabilité',
  fidelite: 'Fidélité',
  ambassadeurs: 'Ambassadeurs',
  promotions: 'Promotions',
  'promo-codes': 'Codes promo',
  livraison: 'Livraison',
  media: 'Médias',
  medias: 'Médiathèque',
  seo: 'SEO',
  contenu: 'Contenu',
  traductions: 'Traductions',
  parametres: 'Paramètres',
  permissions: 'Permissions',
  logs: 'Journaux',
  audits: 'Audits',
  avis: 'Avis',
  chat: 'Chat',
  rapports: 'Rapports',
  fiscal: 'Fiscal',
  devises: 'Devises',
  fournisseurs: 'Fournisseurs',
  employes: 'Employés',
  bannieres: 'Bannières',
  abonnements: 'Abonnements',
  questions: 'Questions',
  webinaires: 'Webinaires',
  monitoring: 'Monitoring',
  webhooks: 'Webhooks',
  'brand-kit': 'Kit de marque',
  'social-scheduler': 'Planificateur social',
  'content-hub': 'Hub de contenu',
  'video-categories': 'Catégories vidéo',
  'consent-templates': 'Modèles de consentement',
  'ads-youtube': 'Annonces YouTube',
  'ads-meta': 'Annonces Meta',
  'ads-google': 'Annonces Google',
  'ads-tiktok': 'Annonces TikTok',
  'ads-linkedin': 'Annonces LinkedIn',
  'ads-twitter': 'Annonces Twitter',
  consents: 'Consentements',
  connections: 'Connexions',
  imports: 'Importations',
  library: 'Bibliothèque',
  analytics: 'Analytique',
  security: 'Sécurité',
  previsions: 'Prévisions',
  budget: 'Budget',
  cloture: 'Clôture',
  images: 'Images',
  videos: 'Vidéos',
  upsell: 'Upsell',
  uat: 'UAT',
  navigateur: 'Navigateur',
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    const isLast = index === segments.length - 1;
    return { path, label, isLast, segment };
  });

  return (
    <nav aria-label="Breadcrumbs" className="flex items-center gap-1 text-sm text-slate-500 mb-4">
      <Link href="/admin" className="hover:text-sky-600 transition-colors">
        <Home className="w-4 h-4" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          {crumb.isLast ? (
            <span className="font-medium text-slate-700">{crumb.label}</span>
          ) : (
            <Link href={crumb.path} className="hover:text-sky-600 transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
