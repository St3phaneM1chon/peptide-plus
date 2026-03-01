/**
 * Outlook-style Navigation Configuration
 * Centralizes all admin navigation: Icon Rail items + Folder Pane trees
 */

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, ShoppingCart, Users, Package, FolderOpen, Archive,
  Tag, Percent, Mail, ImageIcon, Star, HelpCircle, MessageCircle, Award,
  Gift, RefreshCw, Video, Truck, DollarSign, Send, Search, FileText,
  Briefcase, Calculator, PenLine, FileSpreadsheet, Landmark, TrendingUp,
  BarChart2, Activity, UserCheck, Settings, Shield, FlaskConical, Languages,
  Megaphone, Inbox, FileBarChart, Layout, Receipt, CreditCard, Clock,
  BookOpen, Import, Ruler, Scale, Calendar, FileCheck, Zap, Target,
  Trash2, AlertTriangle, StickyNote, FolderSearch, FileEdit, Globe,
  ClipboardCheck, Database, Sparkles, Play, Wifi,
} from 'lucide-react';
import { TeamsIcon, ZoomIcon, WebexIcon, GoogleMeetIcon, WhatsAppIcon } from '@/components/admin/icons/platform-icons';

// ── Icon Rail (left vertical strip) ──────────────────────────

export interface NavRailItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  badge?: 'pendingOrders' | 'unreadChats' | 'inboxCount';
}

export const railItems: NavRailItem[] = [
  { id: 'dashboard', labelKey: 'admin.nav.dashboard', icon: LayoutDashboard },
  { id: 'commerce', labelKey: 'admin.nav.commerce', icon: ShoppingCart, badge: 'pendingOrders' },
  { id: 'catalog', labelKey: 'admin.nav.catalog', icon: Package },
  { id: 'marketing', labelKey: 'admin.nav.marketing', icon: Megaphone },
  { id: 'community', labelKey: 'admin.nav.community', icon: MessageCircle, badge: 'unreadChats' },
  { id: 'loyalty', labelKey: 'admin.nav.loyalty', icon: Award },
  { id: 'media', labelKey: 'admin.nav.mediaSection', icon: Video },
  { id: 'emails', labelKey: 'admin.nav.emails', icon: Mail, badge: 'inboxCount' },
  { id: 'accounting', labelKey: 'admin.nav.accounting', icon: Calculator },
  { id: 'system', labelKey: 'admin.nav.system', icon: Settings },
];

// ── Folder Pane (tree navigation per rail section) ───────────

export interface NavFolderItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavFolderItem[];
  image?: string; // Optional PNG logo path (used instead of icon when set)
}

export interface NavFolderGroup {
  labelKey?: string;
  items: NavFolderItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export interface NavFolderSection {
  railId: string;
  title: string; // i18n key for pane header
  groups: NavFolderGroup[];
}

export const folderSections: Record<string, NavFolderSection> = {
  dashboard: {
    railId: 'dashboard',
    title: 'admin.nav.dashboard',
    groups: [
      {
        items: [
          { href: '/admin/dashboard', labelKey: 'admin.nav.dashboard', icon: LayoutDashboard },
        ],
        defaultOpen: true,
      },
    ],
  },

  commerce: {
    railId: 'commerce',
    title: 'admin.nav.commerce',
    groups: [
      {
        items: [
          { href: '/admin/commandes', labelKey: 'admin.nav.orders', icon: ShoppingCart, badge: 'pendingOrders' },
          { href: '/admin/customers', labelKey: 'admin.nav.customers', icon: Users },
          { href: '/admin/clients', labelKey: 'admin.nav.distributors', icon: Briefcase },
          { href: '/admin/abonnements', labelKey: 'admin.nav.subscriptions', icon: RefreshCw },
          { href: '/admin/inventaire', labelKey: 'admin.nav.inventory', icon: Archive },
          { href: '/admin/fournisseurs', labelKey: 'admin.nav.suppliers', icon: Truck },
        ],
        defaultOpen: true,
      },
    ],
  },

  catalog: {
    railId: 'catalog',
    title: 'admin.nav.catalog',
    groups: [
      {
        items: [
          { href: '/admin/produits', labelKey: 'admin.nav.products', icon: Package },
          { href: '/admin/categories', labelKey: 'admin.nav.categories', icon: FolderOpen },
        ],
        defaultOpen: true,
      },
    ],
  },

  marketing: {
    railId: 'marketing',
    title: 'admin.nav.marketing',
    groups: [
      {
        items: [
          { href: '/admin/promo-codes', labelKey: 'admin.nav.promoCodes', icon: Tag },
          { href: '/admin/promotions', labelKey: 'admin.nav.promotions', icon: Percent },
          { href: '/admin/newsletter', labelKey: 'admin.nav.newsletter', icon: Mail },
          { href: '/admin/bannieres', labelKey: 'admin.nav.banners', icon: ImageIcon },
          { href: '/admin/upsell', labelKey: 'admin.nav.upsell', icon: TrendingUp },
        ],
        defaultOpen: true,
      },
    ],
  },

  community: {
    railId: 'community',
    title: 'admin.nav.community',
    groups: [
      {
        items: [
          { href: '/admin/avis', labelKey: 'admin.nav.reviews', icon: Star },
          { href: '/admin/questions', labelKey: 'admin.nav.questions', icon: HelpCircle },
          { href: '/admin/chat', labelKey: 'admin.nav.chatSupport', icon: MessageCircle, badge: 'unreadChats' },
          { href: '/admin/ambassadeurs', labelKey: 'admin.nav.ambassadors', icon: Award },
        ],
        defaultOpen: true,
      },
    ],
  },

  loyalty: {
    railId: 'loyalty',
    title: 'admin.nav.loyalty',
    groups: [
      {
        items: [
          { href: '/admin/fidelite', labelKey: 'admin.nav.loyaltyProgram', icon: Gift },
          { href: '/admin/webinaires', labelKey: 'admin.nav.webinars', icon: Video },
        ],
        defaultOpen: true,
      },
    ],
  },

  media: {
    railId: 'media',
    title: 'admin.nav.mediaSection',
    groups: [
      {
        labelKey: 'admin.nav.mediaPlatforms',
        items: [
          { href: '/admin/media/launch-teams', labelKey: 'admin.nav.launchTeams', icon: TeamsIcon as unknown as LucideIcon, image: '/images/platforms/teams.png' },
          { href: '/admin/media/launch-zoom', labelKey: 'admin.nav.launchZoom', icon: ZoomIcon as unknown as LucideIcon, image: '/images/platforms/zoom.png' },
          { href: '/admin/media/launch-webex', labelKey: 'admin.nav.launchWebex', icon: WebexIcon as unknown as LucideIcon, image: '/images/platforms/webex.png' },
          { href: '/admin/media/launch-google-meet', labelKey: 'admin.nav.launchGoogleMeet', icon: GoogleMeetIcon as unknown as LucideIcon, image: '/images/platforms/google-meet.png' },
          { href: '/admin/media/launch-whatsapp', labelKey: 'admin.nav.launchWhatsApp', icon: WhatsAppIcon as unknown as LucideIcon, image: '/images/platforms/whatsapp.png' },
        ],
        defaultOpen: true,
      },
      {
        labelKey: 'admin.nav.mediaAds',
        items: [
          { href: '/admin/media/ads-youtube', labelKey: 'admin.nav.mediaYouTube', icon: Video, image: '/images/platforms/youtube.png' },
          { href: '/admin/media/ads-x', labelKey: 'admin.nav.mediaX', icon: MessageCircle, image: '/images/platforms/x.png' },
          { href: '/admin/media/ads-tiktok', labelKey: 'admin.nav.mediaTikTok', icon: Activity, image: '/images/platforms/tiktok.png' },
          { href: '/admin/media/ads-google', labelKey: 'admin.nav.mediaGoogle', icon: Search, image: '/images/platforms/google-ads.png' },
          { href: '/admin/media/ads-linkedin', labelKey: 'admin.nav.mediaLinkedIn', icon: Briefcase, image: '/images/platforms/linkedin.png' },
          { href: '/admin/media/ads-meta', labelKey: 'admin.nav.mediaMeta', icon: Users, image: '/images/platforms/meta.png' },
        ],
        collapsible: true,
        defaultOpen: true,
      },
      {
        labelKey: 'admin.nav.mediaAPIs',
        items: [
          { href: '/admin/media/api-zoom', labelKey: 'admin.nav.apiZoom', icon: Settings },
          { href: '/admin/media/api-teams', labelKey: 'admin.nav.apiTeams', icon: Settings },
          { href: '/admin/media/api-whatsapp', labelKey: 'admin.nav.apiWhatsApp', icon: Settings },
          { href: '/admin/media/api-webex', labelKey: 'admin.nav.apiWebex', icon: Settings },
          { href: '/admin/media/api-google-meet', labelKey: 'admin.nav.apiGoogleMeet', icon: Settings },
          { href: '/admin/media/api-youtube', labelKey: 'admin.nav.apiYouTube', icon: Settings },
          { href: '/admin/media/api-x', labelKey: 'admin.nav.apiX', icon: Settings },
          { href: '/admin/media/api-tiktok', labelKey: 'admin.nav.apiTikTok', icon: Settings },
          { href: '/admin/media/api-google-ads', labelKey: 'admin.nav.apiGoogleAds', icon: Settings },
          { href: '/admin/media/api-linkedin', labelKey: 'admin.nav.apiLinkedIn', icon: Settings },
          { href: '/admin/media/api-meta', labelKey: 'admin.nav.apiMeta', icon: Settings },
        ],
        collapsible: true,
        defaultOpen: false,
      },
      {
        labelKey: 'admin.nav.mediaManagement',
        items: [
          { href: '/admin/media/content-hub', labelKey: 'admin.nav.contentHub', icon: Layout },
          { href: '/admin/media/videos', labelKey: 'admin.nav.mediaVideos', icon: Video },
          { href: '/admin/media/video-categories', labelKey: 'admin.nav.videoCategories', icon: FolderOpen },
          { href: '/admin/media/connections', labelKey: 'admin.nav.platformConnections', icon: Zap },
          { href: '/admin/media/imports', labelKey: 'admin.nav.recordingImports', icon: Import },
          { href: '/admin/media/consents', labelKey: 'admin.nav.consents', icon: FileCheck },
          { href: '/admin/media/consent-templates', labelKey: 'admin.nav.consentTemplates', icon: ClipboardCheck },
          { href: '/admin/media/images', labelKey: 'admin.nav.mediaImages', icon: ImageIcon },
          { href: '/admin/media/library', labelKey: 'admin.nav.mediaLibrary', icon: Play },
        ],
        collapsible: true,
        defaultOpen: true,
      },
    ],
  },

  emails: {
    railId: 'emails',
    title: 'admin.nav.emails',
    groups: [
      {
        labelKey: 'admin.nav.emailFavorites',
        items: [
          { href: '/admin/emails?folder=inbox', labelKey: 'admin.nav.emailInbox', icon: Inbox, badge: 'inboxCount' },
          { href: '/admin/emails?folder=sent', labelKey: 'admin.nav.emailSent', icon: Send },
          { href: '/admin/emails?folder=drafts', labelKey: 'admin.nav.emailDrafts', icon: FileEdit },
        ],
        defaultOpen: true,
      },
      {
        labelKey: 'admin.nav.emailAccount',
        collapsible: true,
        items: [
          { href: '/admin/emails?folder=inbox', labelKey: 'admin.nav.emailInbox', icon: Inbox, badge: 'inboxCount' },
          { href: '/admin/emails?folder=drafts', labelKey: 'admin.nav.emailDrafts', icon: FileEdit },
          { href: '/admin/emails?folder=sent', labelKey: 'admin.nav.emailSent', icon: Send },
          { href: '/admin/emails?folder=deleted', labelKey: 'admin.nav.emailDeleted', icon: Trash2 },
          { href: '/admin/emails?folder=junk', labelKey: 'admin.nav.emailJunk', icon: AlertTriangle },
          { href: '/admin/emails?folder=notes', labelKey: 'admin.nav.emailNotes', icon: StickyNote },
          { href: '/admin/emails?folder=archive', labelKey: 'admin.nav.emailArchive', icon: Archive },
          { href: '/admin/emails?folder=search', labelKey: 'admin.nav.emailSearchFolders', icon: FolderSearch },
        ],
        defaultOpen: true,
      },
      {
        labelKey: 'admin.nav.emailManagement',
        collapsible: true,
        items: [
          { href: '/admin/emails?tab=templates', labelKey: 'admin.nav.emailTemplates', icon: FileText },
          { href: '/admin/emails?tab=campaigns', labelKey: 'admin.nav.emailCampaigns', icon: Megaphone },
          { href: '/admin/emails?tab=flows', labelKey: 'admin.nav.emailFlows', icon: Zap },
          { href: '/admin/emails?tab=analytics', labelKey: 'admin.nav.emailAnalytics', icon: BarChart2 },
          { href: '/admin/emails?tab=segments', labelKey: 'admin.nav.emailSegments', icon: Target },
          { href: '/admin/emails?tab=mailing-list', labelKey: 'admin.nav.emailMailingList', icon: Users },
          { href: '/admin/emails?tab=settings', labelKey: 'admin.nav.emailSettings', icon: Settings },
        ],
        defaultOpen: false,
      },
    ],
  },

  accounting: {
    railId: 'accounting',
    title: 'admin.nav.accounting',
    groups: [
      {
        labelKey: 'admin.nav.accountingOverview',
        items: [
          { href: '/admin/comptabilite', labelKey: 'admin.nav.accountingDashboard', icon: Layout },
          { href: '/admin/comptabilite/recherche', labelKey: 'admin.nav.search', icon: Search },
        ],
        defaultOpen: true,
      },
      {
        labelKey: 'admin.nav.accountingEntries',
        items: [
          { href: '/admin/comptabilite/saisie-rapide', labelKey: 'admin.nav.quickEntry', icon: Zap },
          { href: '/admin/comptabilite/ecritures', labelKey: 'admin.nav.entries', icon: PenLine },
          { href: '/admin/comptabilite/recurrentes', labelKey: 'admin.nav.recurring', icon: RefreshCw },
          { href: '/admin/comptabilite/ocr', labelKey: 'admin.nav.ocr', icon: FileCheck },
          { href: '/admin/comptabilite/depenses', labelKey: 'admin.nav.expenses', icon: Receipt },
        ],
        collapsible: true,
        defaultOpen: true,
      },
      {
        labelKey: 'admin.nav.accountingAccounts',
        items: [
          { href: '/admin/comptabilite/grand-livre', labelKey: 'admin.nav.generalLedger', icon: BookOpen },
          { href: '/admin/comptabilite/plan-comptable', labelKey: 'admin.nav.chartOfAccounts', icon: FileBarChart },
          { href: '/admin/comptabilite/factures-clients', labelKey: 'admin.nav.customerInvoices', icon: FileSpreadsheet },
          { href: '/admin/comptabilite/factures-fournisseurs', labelKey: 'admin.nav.supplierInvoices', icon: FileText },
          { href: '/admin/comptabilite/notes-credit', labelKey: 'admin.nav.creditNotes', icon: CreditCard },
          { href: '/admin/comptabilite/aging', labelKey: 'admin.nav.aging', icon: Clock },
          { href: '/admin/comptabilite/immobilisations', labelKey: 'admin.nav.fixedAssets', icon: Landmark },
        ],
        collapsible: true,
        defaultOpen: false,
      },
      {
        labelKey: 'admin.nav.accountingBank',
        items: [
          { href: '/admin/comptabilite/banques', labelKey: 'admin.nav.banks', icon: Landmark },
          { href: '/admin/comptabilite/import-bancaire', labelKey: 'admin.nav.bankImport', icon: Import },
          { href: '/admin/comptabilite/regles-bancaires', labelKey: 'admin.nav.bankRules', icon: Ruler },
          { href: '/admin/comptabilite/rapprochement', labelKey: 'admin.nav.reconciliation', icon: Scale },
          { href: '/admin/comptabilite/devises', labelKey: 'admin.nav.currencies', icon: DollarSign },
        ],
        collapsible: true,
        defaultOpen: false,
      },
      {
        labelKey: 'admin.nav.accountingReports',
        items: [
          { href: '/admin/comptabilite/etats-financiers', labelKey: 'admin.nav.financialStatements', icon: TrendingUp },
          { href: '/admin/comptabilite/previsions', labelKey: 'admin.nav.forecasts', icon: BarChart2 },
          { href: '/admin/comptabilite/budget', labelKey: 'admin.nav.budget', icon: FileBarChart },
          { href: '/admin/comptabilite/rapports', labelKey: 'admin.nav.reports', icon: FileText },
          { href: '/admin/comptabilite/exports', labelKey: 'admin.nav.exports', icon: FileSpreadsheet },
        ],
        collapsible: true,
        defaultOpen: false,
      },
      {
        labelKey: 'admin.nav.accountingCompliance',
        items: [
          { href: '/admin/comptabilite/audit', labelKey: 'admin.nav.auditTrail', icon: Activity },
          { href: '/admin/comptabilite/cloture', labelKey: 'admin.nav.periodClosing', icon: FileCheck },
          { href: '/admin/comptabilite/parametres', labelKey: 'admin.nav.accountingSettings', icon: Settings },
          { href: '/admin/comptabilite/calendrier-fiscal', labelKey: 'admin.nav.fiscalCalendar', icon: Calendar },
          { href: '/admin/comptabilite/declaration-tps-tvq', labelKey: 'admin.nav.taxReturn', icon: FileText },
        ],
        collapsible: true,
        defaultOpen: false,
      },
      {
        labelKey: 'admin.nav.accountingFiscalReports',
        items: [
          { href: '/admin/fiscal', labelKey: 'admin.nav.fiscalTaxes', icon: Briefcase },
          { href: '/admin/rapports', labelKey: 'admin.nav.reports', icon: BarChart2 },
        ],
        collapsible: true,
        defaultOpen: false,
      },
    ],
  },

  system: {
    railId: 'system',
    title: 'admin.nav.system',
    groups: [
      {
        items: [
          { href: '/admin/permissions', labelKey: 'admin.nav.permissions', icon: Shield },
          { href: '/admin/logs', labelKey: 'admin.nav.logsAudit', icon: Activity },
          { href: '/admin/employes', labelKey: 'admin.nav.employees', icon: UserCheck },
          { href: '/admin/parametres', labelKey: 'admin.nav.settings', icon: Settings },
          { href: '/admin/uat', labelKey: 'admin.nav.uatTesting', icon: FlaskConical },
          { href: '/admin/diagnostics', labelKey: 'admin.nav.networkDiagnostics', icon: Wifi },
        ],
        defaultOpen: true,
      },
      {
        labelKey: 'admin.nav.aurelia',
        items: [
          { href: '/admin/mots-magiques', labelKey: 'admin.nav.magicWords', icon: Sparkles },
          { href: '/admin/audits', labelKey: 'admin.nav.codeAudits', icon: ClipboardCheck },
          { href: '/admin/backups', labelKey: 'admin.nav.backups', icon: Database },
        ],
        collapsible: true,
        defaultOpen: true,
      },
      {
        labelKey: 'admin.nav.configuration',
        items: [
          { href: '/admin/livraison', labelKey: 'admin.nav.shippingZones', icon: Truck },
          { href: '/admin/devises', labelKey: 'admin.nav.currencies', icon: DollarSign },
          { href: '/admin/seo', labelKey: 'admin.nav.seo', icon: Search },
          { href: '/admin/traductions', labelKey: 'admin.nav.translations', icon: Languages },
          { href: '/admin/contenu', labelKey: 'admin.nav.contentPages', icon: FileText },
          { href: '/admin/navigateur', labelKey: 'admin.nav.webNavigator', icon: Globe },
        ],
        collapsible: true,
        defaultOpen: true,
      },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────

/** Determine which rail section is active based on the current pathname */
export function getActiveRailId(pathname: string): string {
  if (pathname.startsWith('/admin/comptabilite') || pathname.startsWith('/admin/fiscal') || pathname.startsWith('/admin/rapports')) return 'accounting';
  if (pathname.startsWith('/admin/emails')) return 'emails';
  if (pathname.startsWith('/admin/commandes') || pathname.startsWith('/admin/customers') || pathname.startsWith('/admin/clients') || pathname.startsWith('/admin/abonnements') || pathname.startsWith('/admin/inventaire') || pathname.startsWith('/admin/fournisseurs')) return 'commerce';
  if (pathname.startsWith('/admin/produits') || pathname.startsWith('/admin/categories')) return 'catalog';
  if (pathname.startsWith('/admin/promo-codes') || pathname.startsWith('/admin/promotions') || pathname.startsWith('/admin/newsletter') || pathname.startsWith('/admin/bannieres') || pathname.startsWith('/admin/upsell')) return 'marketing';
  if (pathname.startsWith('/admin/avis') || pathname.startsWith('/admin/questions') || pathname.startsWith('/admin/chat') || pathname.startsWith('/admin/ambassadeurs')) return 'community';
  if (pathname.startsWith('/admin/fidelite') || pathname.startsWith('/admin/webinaires')) return 'loyalty';
  if (pathname.startsWith('/admin/media')) return 'media';
  if (pathname.startsWith('/admin/permissions') || pathname.startsWith('/admin/logs') || pathname.startsWith('/admin/employes') || pathname.startsWith('/admin/parametres') || pathname.startsWith('/admin/uat') || pathname.startsWith('/admin/audits') || pathname.startsWith('/admin/backups') || pathname.startsWith('/admin/mots-magiques') || pathname.startsWith('/admin/livraison') || pathname.startsWith('/admin/devises') || pathname.startsWith('/admin/seo') || pathname.startsWith('/admin/traductions') || pathname.startsWith('/admin/contenu') || pathname.startsWith('/admin/navigateur') || pathname.startsWith('/admin/diagnostics')) return 'system';
  return 'dashboard';
}
