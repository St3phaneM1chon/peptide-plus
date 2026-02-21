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
} from 'lucide-react';

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
          { href: '/admin/inventaire', labelKey: 'admin.nav.inventory', icon: Archive },
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
          { href: '/admin/abonnements', labelKey: 'admin.nav.subscriptions', icon: RefreshCw },
          { href: '/admin/webinaires', labelKey: 'admin.nav.webinars', icon: Video },
        ],
        defaultOpen: true,
      },
    ],
  },

  emails: {
    railId: 'emails',
    title: 'admin.nav.emails',
    groups: [
      {
        labelKey: 'admin.nav.emails',
        items: [
          { href: '/admin/emails', labelKey: 'admin.nav.emailInbox', icon: Inbox, badge: 'inboxCount' },
          { href: '/admin/emails?tab=templates', labelKey: 'admin.nav.emailTemplates', icon: FileText },
          { href: '/admin/emails?tab=campaigns', labelKey: 'admin.nav.emailCampaigns', icon: Send },
          { href: '/admin/emails?tab=flows', labelKey: 'admin.nav.emailFlows', icon: Zap },
          { href: '/admin/emails?tab=analytics', labelKey: 'admin.nav.emailAnalytics', icon: BarChart2 },
          { href: '/admin/emails?tab=segments', labelKey: 'admin.nav.emailSegments', icon: Target },
        ],
        defaultOpen: true,
      },
      {
        labelKey: 'admin.nav.configuration',
        items: [
          { href: '/admin/emails?tab=settings', labelKey: 'admin.nav.emailSettings', icon: Settings },
        ],
        collapsible: true,
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
    ],
  },

  system: {
    railId: 'system',
    title: 'admin.nav.system',
    groups: [
      {
        items: [
          { href: '/admin/permissions', labelKey: 'admin.nav.permissions', icon: Shield },
          { href: '/admin/fiscal', labelKey: 'admin.nav.fiscalTaxes', icon: Briefcase },
          { href: '/admin/rapports', labelKey: 'admin.nav.reports', icon: BarChart2 },
          { href: '/admin/logs', labelKey: 'admin.nav.logsAudit', icon: Activity },
          { href: '/admin/employes', labelKey: 'admin.nav.employees', icon: UserCheck },
          { href: '/admin/parametres', labelKey: 'admin.nav.settings', icon: Settings },
          { href: '/admin/uat', labelKey: 'admin.nav.uatTesting', icon: FlaskConical },
        ],
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
          { href: '/admin/medias', labelKey: 'admin.nav.media', icon: ImageIcon },
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
  if (pathname.startsWith('/admin/comptabilite')) return 'accounting';
  if (pathname.startsWith('/admin/emails')) return 'emails';
  if (pathname.startsWith('/admin/commandes') || pathname.startsWith('/admin/customers') || pathname.startsWith('/admin/clients') || pathname.startsWith('/admin/inventaire')) return 'commerce';
  if (pathname.startsWith('/admin/produits') || pathname.startsWith('/admin/categories')) return 'catalog';
  if (pathname.startsWith('/admin/promo-codes') || pathname.startsWith('/admin/promotions') || pathname.startsWith('/admin/newsletter') || pathname.startsWith('/admin/bannieres') || pathname.startsWith('/admin/upsell')) return 'marketing';
  if (pathname.startsWith('/admin/avis') || pathname.startsWith('/admin/questions') || pathname.startsWith('/admin/chat') || pathname.startsWith('/admin/ambassadeurs')) return 'community';
  if (pathname.startsWith('/admin/fidelite') || pathname.startsWith('/admin/abonnements') || pathname.startsWith('/admin/webinaires')) return 'loyalty';
  if (pathname.startsWith('/admin/permissions') || pathname.startsWith('/admin/fiscal') || pathname.startsWith('/admin/rapports') || pathname.startsWith('/admin/logs') || pathname.startsWith('/admin/employes') || pathname.startsWith('/admin/parametres') || pathname.startsWith('/admin/uat') || pathname.startsWith('/admin/livraison') || pathname.startsWith('/admin/devises') || pathname.startsWith('/admin/seo') || pathname.startsWith('/admin/traductions') || pathname.startsWith('/admin/contenu') || pathname.startsWith('/admin/medias')) return 'system';
  return 'dashboard';
}
