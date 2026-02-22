/**
 * Outlook-style Ribbon configuration per admin section & sub-section.
 *
 * Sub-section configs (e.g. "commerce.orders") take priority.
 * Section-level configs (e.g. "commerce") are kept as fallbacks.
 */

import type { LucideIcon } from 'lucide-react';
import {
  // Existing
  Plus, Trash2, Printer, PackageCheck, RotateCcw, Download,
  Copy, Eye, EyeOff, Megaphone, Power, Reply, ReplyAll, Forward,
  Archive, Flag, Mail, CheckCircle, XCircle, Save, RefreshCw,
  FolderInput, MailOpen, Star, Filter, ArrowUpDown, Upload, Play,
  // New
  BarChart3, UserPlus, Pencil, ExternalLink, Calendar, Send,
  Ban, MessageSquare, Pause, PlayCircle, History, Lock, Unlock,
  Settings, Search, CreditCard, Scale, Wrench, Clock, Layers,
  FileText, AlertTriangle, DollarSign, Bookmark, Zap, Target,
  Wand2, Video, Shield, BookOpen, Scan, FileUp, LayoutGrid, List,
  Users, Package,
} from 'lucide-react';

// ── Interfaces ────────────────────────────────────────────────

export interface RibbonAction {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  variant?: 'primary' | 'default' | 'danger';
  separator?: boolean; // group separator after this item
  type?: 'button' | 'dropdown';
  dropdownItems?: { key: string; labelKey: string; href?: string }[];
}

export interface RibbonTab {
  key: string;
  labelKey: string;
  type?: 'tab' | 'navDropdown';
  railId?: string; // for navDropdown: which folderSection to show
}

export interface RibbonConfig {
  tabs: RibbonTab[];
  actions: Record<string, RibbonAction[]>; // key = tab key
}

// ── Shared tab sets ───────────────────────────────────────────

const defaultTabs: RibbonTab[] = [
  { key: 'home', labelKey: 'admin.ribbon.tabHome' },
  { key: 'view', labelKey: 'admin.ribbon.tabView' },
];

const viewActions: RibbonAction[] = [
  { key: 'filter', labelKey: 'admin.ribbon.filters', icon: Filter },
  { key: 'sort', labelKey: 'admin.ribbon.sort', icon: ArrowUpDown },
];

const viewActionsWithGrid: RibbonAction[] = [
  { key: 'filter', labelKey: 'admin.ribbon.filters', icon: Filter },
  { key: 'sort', labelKey: 'admin.ribbon.sort', icon: ArrowUpDown, separator: true },
  { key: 'gridView', labelKey: 'admin.ribbon.gridView', icon: LayoutGrid },
  { key: 'listView', labelKey: 'admin.ribbon.listView', icon: List },
];

// ── Dashboard nav tabs ────────────────────────────────────────

const dashboardNavTabs: RibbonTab[] = [
  { key: 'home', labelKey: 'admin.ribbon.tabHome' },
  { key: 'nav.commerce', labelKey: 'admin.nav.commerce', type: 'navDropdown', railId: 'commerce' },
  { key: 'nav.catalog', labelKey: 'admin.nav.catalog', type: 'navDropdown', railId: 'catalog' },
  { key: 'nav.marketing', labelKey: 'admin.nav.marketing', type: 'navDropdown', railId: 'marketing' },
  { key: 'nav.community', labelKey: 'admin.nav.community', type: 'navDropdown', railId: 'community' },
  { key: 'nav.loyalty', labelKey: 'admin.nav.loyalty', type: 'navDropdown', railId: 'loyalty' },
  { key: 'nav.media', labelKey: 'admin.nav.mediaSection', type: 'navDropdown', railId: 'media' },
  { key: 'nav.emails', labelKey: 'admin.nav.emails', type: 'navDropdown', railId: 'emails' },
  { key: 'nav.accounting', labelKey: 'admin.nav.accounting', type: 'navDropdown', railId: 'accounting' },
  { key: 'nav.system', labelKey: 'admin.nav.system', type: 'navDropdown', railId: 'system' },
];

// ── Ribbon Configs ────────────────────────────────────────────

export const ribbonConfigs: Record<string, RibbonConfig> = {

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD (mega-nav mode)
  // ═══════════════════════════════════════════════════════════

  dashboard: {
    tabs: dashboardNavTabs,
    actions: {
      home: [
        { key: 'refresh', labelKey: 'admin.ribbon.refresh', icon: RefreshCw, variant: 'primary' },
        { key: 'exportDashboard', labelKey: 'admin.ribbon.exportDashboard', icon: Download },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════
  // COMMERCE - Section fallback
  // ═══════════════════════════════════════════════════════════

  commerce: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newOrder', labelKey: 'admin.ribbon.newOrder', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
        { key: 'markShipped', labelKey: 'admin.ribbon.markShipped', icon: PackageCheck, separator: true },
        { key: 'refund', labelKey: 'admin.ribbon.refund', icon: RotateCcw },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ── Commerce sub-sections ──────────────────────────────────

  'commerce.orders': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newOrder', labelKey: 'admin.ribbon.newOrder', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
        { key: 'markShipped', labelKey: 'admin.ribbon.markShipped', icon: PackageCheck, separator: true },
        { key: 'refund', labelKey: 'admin.ribbon.refund', icon: RotateCcw },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'commerce.customers': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newCustomer', labelKey: 'admin.ribbon.newCustomer', icon: UserPlus, variant: 'primary', separator: true },
        { key: 'salesStats', labelKey: 'admin.ribbon.salesStats', icon: BarChart3 },
        { key: 'typeStats', labelKey: 'admin.ribbon.typeStats', icon: BarChart3 },
        { key: 'reviewStats', labelKey: 'admin.ribbon.reviewStats', icon: BarChart3 },
        { key: 'ambassadorStats', labelKey: 'admin.ribbon.ambassadorStats', icon: BarChart3, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'commerce.clients': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newClient', labelKey: 'admin.ribbon.newClient', icon: UserPlus, variant: 'primary', separator: true },
        { key: 'salesStats', labelKey: 'admin.ribbon.salesStats', icon: BarChart3 },
        { key: 'typeStats', labelKey: 'admin.ribbon.typeStats', icon: BarChart3 },
        { key: 'reviewStats', labelKey: 'admin.ribbon.reviewStats', icon: BarChart3 },
        { key: 'ambassadorStats', labelKey: 'admin.ribbon.ambassadorStats', icon: BarChart3, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'commerce.suppliers': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'addSupplier', labelKey: 'admin.ribbon.addSupplier', icon: Plus, variant: 'primary', separator: true },
        { key: 'openWebsite', labelKey: 'admin.ribbon.openWebsite', icon: ExternalLink },
        { key: 'edit', labelKey: 'admin.ribbon.edit', icon: Pencil },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'commerce.inventory': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'addStock', labelKey: 'admin.ribbon.addStock', icon: Package, variant: 'primary' },
        { key: 'adjust', labelKey: 'admin.ribbon.adjust', icon: Pencil, separator: true },
        { key: 'monthlyStats', labelKey: 'admin.ribbon.monthlyStats', icon: BarChart3 },
        { key: 'renewalList', labelKey: 'admin.ribbon.renewalList', icon: List },
        { key: 'submissions', labelKey: 'admin.ribbon.submissions', icon: FileText, separator: true },
        { key: 'orderOnline', labelKey: 'admin.ribbon.orderOnline', icon: ExternalLink },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ═══════════════════════════════════════════════════════════
  // CATALOG - Section fallback
  // ═══════════════════════════════════════════════════════════

  catalog: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newProduct', labelKey: 'admin.ribbon.newProduct', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy },
        { key: 'publish', labelKey: 'admin.ribbon.publish', icon: Eye, separator: true },
        { key: 'unpublish', labelKey: 'admin.ribbon.unpublish', icon: EyeOff },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ── Catalog sub-sections ───────────────────────────────────

  'catalog.products': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newProduct', labelKey: 'admin.ribbon.newProduct', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy },
        { key: 'publish', labelKey: 'admin.ribbon.publish', icon: Eye },
        { key: 'unpublish', labelKey: 'admin.ribbon.unpublish', icon: EyeOff, separator: true },
        { key: 'categoriesFilter', labelKey: 'admin.ribbon.categoriesFilter', icon: Filter, type: 'dropdown' },
        { key: 'popularPages', labelKey: 'admin.ribbon.popularPages', icon: BarChart3 },
        { key: 'pdfCatalog', labelKey: 'admin.ribbon.pdfCatalog', icon: FileText, separator: true },
        { key: 'importCsv', labelKey: 'admin.ribbon.importCsv', icon: FileUp },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActionsWithGrid,
    },
  },

  'catalog.categories': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newCategory', labelKey: 'admin.ribbon.newCategory', icon: Plus, variant: 'primary' },
        { key: 'newSubcategory', labelKey: 'admin.ribbon.newSubcategory', icon: Plus },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'visitStats', labelKey: 'admin.ribbon.visitStats', icon: BarChart3 },
        { key: 'reorganize', labelKey: 'admin.ribbon.reorganize', icon: Layers, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ═══════════════════════════════════════════════════════════
  // MARKETING - Section fallback
  // ═══════════════════════════════════════════════════════════

  marketing: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newPromo', labelKey: 'admin.ribbon.newPromo', icon: Plus, variant: 'primary' },
        { key: 'newCampaign', labelKey: 'admin.ribbon.newCampaign', icon: Megaphone, separator: true },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger' },
        { key: 'activate', labelKey: 'admin.ribbon.activate', icon: Power, separator: true },
        { key: 'deactivate', labelKey: 'admin.ribbon.deactivate', icon: XCircle },
      ],
      view: [],
    },
  },

  // ── Marketing sub-sections ─────────────────────────────────

  'marketing.promoCodes': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newPromo', labelKey: 'admin.ribbon.newPromo', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy },
        { key: 'activate', labelKey: 'admin.ribbon.activate', icon: Power },
        { key: 'deactivate', labelKey: 'admin.ribbon.deactivate', icon: XCircle, separator: true },
        { key: 'usageStats', labelKey: 'admin.ribbon.usageStats', icon: BarChart3 },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'marketing.promotions': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newPromotion', labelKey: 'admin.ribbon.newPromotion', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'schedule', labelKey: 'admin.ribbon.schedule', icon: Calendar },
        { key: 'activate', labelKey: 'admin.ribbon.activate', icon: Power },
        { key: 'deactivate', labelKey: 'admin.ribbon.deactivate', icon: XCircle },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy, separator: true },
        { key: 'performanceStats', labelKey: 'admin.ribbon.performanceStats', icon: BarChart3 },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'marketing.newsletter': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newNewsletter', labelKey: 'admin.ribbon.newNewsletter', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'scheduleDelivery', labelKey: 'admin.ribbon.scheduleDelivery', icon: Calendar },
        { key: 'sendNow', labelKey: 'admin.ribbon.sendNow', icon: Send },
        { key: 'preview', labelKey: 'admin.ribbon.preview', icon: Eye, separator: true },
        { key: 'openClickStats', labelKey: 'admin.ribbon.openClickStats', icon: BarChart3 },
        { key: 'manageSubscribers', labelKey: 'admin.ribbon.manageSubscribers', icon: Users },
      ],
      view: viewActions,
    },
  },

  'marketing.banners': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newBanner', labelKey: 'admin.ribbon.newBanner', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'uploadImage', labelKey: 'admin.ribbon.uploadImage', icon: Upload },
        { key: 'activate', labelKey: 'admin.ribbon.activate', icon: Power },
        { key: 'deactivate', labelKey: 'admin.ribbon.deactivate', icon: XCircle },
        { key: 'reorganize', labelKey: 'admin.ribbon.reorganize', icon: Layers, separator: true },
        { key: 'preview', labelKey: 'admin.ribbon.preview', icon: Eye },
      ],
      view: viewActions,
    },
  },

  'marketing.upsell': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newRule', labelKey: 'admin.ribbon.newRule', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'activate', labelKey: 'admin.ribbon.activate', icon: Power },
        { key: 'deactivate', labelKey: 'admin.ribbon.deactivate', icon: XCircle },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy, separator: true },
        { key: 'conversionStats', labelKey: 'admin.ribbon.conversionStats', icon: Target },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ═══════════════════════════════════════════════════════════
  // COMMUNITY - Section fallback
  // ═══════════════════════════════════════════════════════════

  community: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'reply', labelKey: 'admin.ribbon.reply', icon: Reply, variant: 'primary' },
        { key: 'archive', labelKey: 'admin.ribbon.archive', icon: Archive, separator: true },
        { key: 'flag', labelKey: 'admin.ribbon.flag', icon: Flag },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger' },
      ],
      view: [],
    },
  },

  // ── Community sub-sections ─────────────────────────────────

  'community.reviews': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'respond', labelKey: 'admin.ribbon.respond', icon: MessageSquare, variant: 'primary' },
        { key: 'approve', labelKey: 'admin.ribbon.approve', icon: CheckCircle },
        { key: 'reject', labelKey: 'admin.ribbon.reject', icon: Ban, variant: 'danger', separator: true },
        { key: 'reportContent', labelKey: 'admin.ribbon.reportContent', icon: Flag },
        { key: 'convertTestimonial', labelKey: 'admin.ribbon.convertTestimonial', icon: Bookmark, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'community.questions': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'respond', labelKey: 'admin.ribbon.respond', icon: MessageSquare, variant: 'primary' },
        { key: 'markResolved', labelKey: 'admin.ribbon.markResolved', icon: CheckCircle },
        { key: 'archive', labelKey: 'admin.ribbon.archive', icon: Archive, separator: true },
        { key: 'reportContent', labelKey: 'admin.ribbon.reportContent', icon: Flag },
        { key: 'convertFaq', labelKey: 'admin.ribbon.convertFaq', icon: Bookmark, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'community.chat': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newMessage', labelKey: 'admin.ribbon.newMessage', icon: Mail, variant: 'primary' },
        { key: 'closeConversation', labelKey: 'admin.ribbon.closeConversation', icon: XCircle },
        { key: 'transfer', labelKey: 'admin.ribbon.transfer', icon: Forward, separator: true },
        { key: 'markResolved', labelKey: 'admin.ribbon.markResolved', icon: CheckCircle },
        { key: 'archive', labelKey: 'admin.ribbon.archive', icon: Archive, separator: true },
        { key: 'exportHistory', labelKey: 'admin.ribbon.exportHistory', icon: Download },
      ],
      view: viewActions,
    },
  },

  'community.ambassadors': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newAmbassador', labelKey: 'admin.ribbon.newAmbassador', icon: UserPlus, variant: 'primary' },
        { key: 'approveCandidacy', labelKey: 'admin.ribbon.approveCandidacy', icon: CheckCircle },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'manageCommission', labelKey: 'admin.ribbon.manageCommission', icon: DollarSign },
        { key: 'salesStats', labelKey: 'admin.ribbon.salesStats', icon: BarChart3, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ═══════════════════════════════════════════════════════════
  // LOYALTY - Section fallback
  // ═══════════════════════════════════════════════════════════

  loyalty: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newTier', labelKey: 'admin.ribbon.newTier', icon: Plus, variant: 'primary' },
        { key: 'addPoints', labelKey: 'admin.ribbon.addPoints', icon: Star, separator: true },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger' },
      ],
      view: [],
    },
  },

  // ── Loyalty sub-sections ───────────────────────────────────

  'loyalty.program': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newTier', labelKey: 'admin.ribbon.newTier', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'adjustPoints', labelKey: 'admin.ribbon.adjustPoints', icon: Pencil },
        { key: 'earningRules', labelKey: 'admin.ribbon.earningRules', icon: BookOpen },
        { key: 'exchangeHistory', labelKey: 'admin.ribbon.exchangeHistory', icon: History, separator: true },
        { key: 'memberStats', labelKey: 'admin.ribbon.memberStats', icon: BarChart3 },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'loyalty.subscriptions': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newSubscription', labelKey: 'admin.ribbon.newSubscription', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'suspend', labelKey: 'admin.ribbon.suspend', icon: Pause },
        { key: 'reactivate', labelKey: 'admin.ribbon.reactivate', icon: PlayCircle },
        { key: 'refund', labelKey: 'admin.ribbon.refund', icon: RotateCcw, separator: true },
        { key: 'mrrStats', labelKey: 'admin.ribbon.mrrStats', icon: BarChart3 },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'loyalty.webinars': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newWebinar', labelKey: 'admin.ribbon.newWebinar', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'schedule', labelKey: 'admin.ribbon.schedule', icon: Calendar },
        { key: 'launchNow', labelKey: 'admin.ribbon.launchNow', icon: PlayCircle },
        { key: 'recording', labelKey: 'admin.ribbon.recording', icon: Video, separator: true },
        { key: 'participantStats', labelKey: 'admin.ribbon.participantStats', icon: BarChart3 },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ═══════════════════════════════════════════════════════════
  // MEDIA - Section fallback
  // ═══════════════════════════════════════════════════════════

  media: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'upload', labelKey: 'admin.ribbon.upload', icon: Upload, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'play', labelKey: 'admin.ribbon.play', icon: Play },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ── Media sub-sections ─────────────────────────────────────

  'media.apis': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'configure', labelKey: 'admin.ribbon.configure', icon: Wrench, variant: 'primary' },
        { key: 'testConnection', labelKey: 'admin.ribbon.testConnection', icon: CheckCircle, separator: true },
        { key: 'refreshToken', labelKey: 'admin.ribbon.refreshToken', icon: RefreshCw },
        { key: 'viewLogs', labelKey: 'admin.ribbon.viewLogs', icon: FileText, separator: true },
        { key: 'documentation', labelKey: 'admin.ribbon.documentation', icon: ExternalLink },
      ],
      view: viewActions,
    },
  },

  'media.ads': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newAdCampaign', labelKey: 'admin.ribbon.newAdCampaign', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'pause', labelKey: 'admin.ribbon.pause', icon: Pause },
        { key: 'resume', labelKey: 'admin.ribbon.resume', icon: PlayCircle },
        { key: 'modifyBudget', labelKey: 'admin.ribbon.modifyBudget', icon: DollarSign, separator: true },
        { key: 'syncData', labelKey: 'admin.ribbon.syncData', icon: RefreshCw },
        { key: 'performanceStats', labelKey: 'admin.ribbon.performanceStats', icon: BarChart3 },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'media.management': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'upload', labelKey: 'admin.ribbon.upload', icon: Upload, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'rename', labelKey: 'admin.ribbon.rename', icon: Pencil },
        { key: 'organize', labelKey: 'admin.ribbon.organize', icon: Layers },
        { key: 'optimize', labelKey: 'admin.ribbon.optimize', icon: Wand2, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActionsWithGrid,
    },
  },

  // ═══════════════════════════════════════════════════════════
  // EMAILS - Section fallback (mail)
  // ═══════════════════════════════════════════════════════════

  emails: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newMessage', labelKey: 'admin.ribbon.newMessage', icon: Mail, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger' },
        { key: 'archive', labelKey: 'admin.ribbon.archive', icon: Archive, separator: true },
        { key: 'reply', labelKey: 'admin.ribbon.reply', icon: Reply },
        { key: 'replyAll', labelKey: 'admin.ribbon.replyAll', icon: ReplyAll },
        { key: 'forward', labelKey: 'admin.ribbon.forward', icon: Forward, separator: true },
        { key: 'flag', labelKey: 'admin.ribbon.flag', icon: Flag },
        { key: 'markRead', labelKey: 'admin.ribbon.markRead', icon: MailOpen },
        { key: 'moveTo', labelKey: 'admin.ribbon.moveTo', icon: FolderInput },
      ],
      view: viewActions,
    },
  },

  // ── Emails sub-sections ────────────────────────────────────

  'emails.mail': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newMessage', labelKey: 'admin.ribbon.newMessage', icon: Mail, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger' },
        { key: 'archive', labelKey: 'admin.ribbon.archive', icon: Archive, separator: true },
        { key: 'reply', labelKey: 'admin.ribbon.reply', icon: Reply },
        { key: 'replyAll', labelKey: 'admin.ribbon.replyAll', icon: ReplyAll },
        { key: 'forward', labelKey: 'admin.ribbon.forward', icon: Forward, separator: true },
        { key: 'flag', labelKey: 'admin.ribbon.flag', icon: Flag },
        { key: 'markRead', labelKey: 'admin.ribbon.markRead', icon: MailOpen },
        { key: 'moveTo', labelKey: 'admin.ribbon.moveTo', icon: FolderInput },
      ],
      view: viewActions,
    },
  },

  'emails.templates': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newTemplate', labelKey: 'admin.ribbon.newTemplate', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy },
        { key: 'preview', labelKey: 'admin.ribbon.preview', icon: Eye },
        { key: 'testSend', labelKey: 'admin.ribbon.testSend', icon: Send, separator: true },
        { key: 'variables', labelKey: 'admin.ribbon.variables', icon: FileText },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'emails.campaigns': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newEmailCampaign', labelKey: 'admin.ribbon.newEmailCampaign', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'schedule', labelKey: 'admin.ribbon.schedule', icon: Calendar },
        { key: 'sendNow', labelKey: 'admin.ribbon.sendNow', icon: Send },
        { key: 'abTest', labelKey: 'admin.ribbon.abTest', icon: Zap, separator: true },
        { key: 'stats', labelKey: 'admin.ribbon.stats', icon: BarChart3 },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'emails.flows': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newFlow', labelKey: 'admin.ribbon.newFlow', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'activate', labelKey: 'admin.ribbon.activate', icon: Power },
        { key: 'deactivate', labelKey: 'admin.ribbon.deactivate', icon: XCircle },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy, separator: true },
        { key: 'triggerStats', labelKey: 'admin.ribbon.triggerStats', icon: BarChart3 },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'emails.analytics': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'refresh', labelKey: 'admin.ribbon.refresh', icon: RefreshCw, variant: 'primary', separator: true },
        { key: 'period', labelKey: 'admin.ribbon.period', icon: Clock, type: 'dropdown', dropdownItems: [
          { key: '7d', labelKey: 'admin.ribbon.period7d' },
          { key: '30d', labelKey: 'admin.ribbon.period30d' },
          { key: '90d', labelKey: 'admin.ribbon.period90d' },
          { key: '1y', labelKey: 'admin.ribbon.period1y' },
        ]},
        { key: 'comparePeriods', labelKey: 'admin.ribbon.comparePeriods', icon: Scale, separator: true },
        { key: 'exportReport', labelKey: 'admin.ribbon.exportReport', icon: Download },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
      ],
      view: viewActions,
    },
  },

  'emails.segments': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newSegment', labelKey: 'admin.ribbon.newSegment', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy },
        { key: 'refreshCount', labelKey: 'admin.ribbon.refreshCount', icon: RefreshCw, separator: true },
        { key: 'exportContacts', labelKey: 'admin.ribbon.exportContacts', icon: Download },
      ],
      view: viewActions,
    },
  },

  'emails.mailingList': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'addContact', labelKey: 'admin.ribbon.addContact', icon: UserPlus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'importCsv', labelKey: 'admin.ribbon.importCsv', icon: FileUp },
        { key: 'cleanBounces', labelKey: 'admin.ribbon.cleanBounces', icon: AlertTriangle, separator: true },
        { key: 'unsubscribe', labelKey: 'admin.ribbon.unsubscribe', icon: XCircle },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ═══════════════════════════════════════════════════════════
  // ACCOUNTING - Section fallback
  // ═══════════════════════════════════════════════════════════

  accounting: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newEntry', labelKey: 'admin.ribbon.newEntry', icon: Plus, variant: 'primary' },
        { key: 'validate', labelKey: 'admin.ribbon.validate', icon: CheckCircle, separator: true },
        { key: 'cancel', labelKey: 'admin.ribbon.cancel', icon: XCircle, variant: 'danger' },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ── Accounting sub-sections ────────────────────────────────

  'accounting.dashboard': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'refresh', labelKey: 'admin.ribbon.refresh', icon: RefreshCw, variant: 'primary', separator: true },
        { key: 'period', labelKey: 'admin.ribbon.period', icon: Clock, type: 'dropdown', dropdownItems: [
          { key: '7d', labelKey: 'admin.ribbon.period7d' },
          { key: '30d', labelKey: 'admin.ribbon.period30d' },
          { key: '90d', labelKey: 'admin.ribbon.period90d' },
          { key: '1y', labelKey: 'admin.ribbon.period1y' },
        ]},
        { key: 'exportReport', labelKey: 'admin.ribbon.exportReport', icon: Download, separator: true },
        { key: 'closePeriod', labelKey: 'admin.ribbon.closePeriod', icon: Lock, variant: 'danger' },
      ],
      view: viewActions,
    },
  },

  'accounting.entries': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newEntry', labelKey: 'admin.ribbon.newEntry', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'validate', labelKey: 'admin.ribbon.validate', icon: CheckCircle },
        { key: 'cancel', labelKey: 'admin.ribbon.cancel', icon: XCircle },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy, separator: true },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'accounting.ocr': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'scanDocument', labelKey: 'admin.ribbon.scanDocument', icon: Scan, variant: 'primary' },
        { key: 'upload', labelKey: 'admin.ribbon.upload', icon: Upload, separator: true },
        { key: 'validateReading', labelKey: 'admin.ribbon.validateReading', icon: CheckCircle },
        { key: 'correct', labelKey: 'admin.ribbon.correct', icon: Pencil, separator: true },
        { key: 'scanHistory', labelKey: 'admin.ribbon.scanHistory', icon: History },
      ],
      view: viewActions,
    },
  },

  'accounting.expenses': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newExpense', labelKey: 'admin.ribbon.newExpense', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'categorize', labelKey: 'admin.ribbon.categorize', icon: Layers },
        { key: 'approve', labelKey: 'admin.ribbon.approve', icon: CheckCircle, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
      ],
      view: viewActions,
    },
  },

  'accounting.accounts': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'search', labelKey: 'admin.ribbon.search', icon: Search, variant: 'primary', separator: true },
        { key: 'filterPeriod', labelKey: 'admin.ribbon.filterPeriod', icon: Clock },
        { key: 'exportPdf', labelKey: 'admin.ribbon.exportPdf', icon: Download },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer, separator: true },
        { key: 'newAccount', labelKey: 'admin.ribbon.newAccount', icon: Plus },
      ],
      view: viewActions,
    },
  },

  'accounting.customerInvoices': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newInvoice', labelKey: 'admin.ribbon.newInvoice', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'sendByEmail', labelKey: 'admin.ribbon.sendByEmail', icon: Send },
        { key: 'markPaid', labelKey: 'admin.ribbon.markPaid', icon: CheckCircle },
        { key: 'creditNote', labelKey: 'admin.ribbon.creditNote', icon: CreditCard, separator: true },
        { key: 'exportPdf', labelKey: 'admin.ribbon.exportPdf', icon: Download },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
      ],
      view: viewActions,
    },
  },

  'accounting.supplierInvoices': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'enterInvoice', labelKey: 'admin.ribbon.enterInvoice', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'approve', labelKey: 'admin.ribbon.approve', icon: CheckCircle },
        { key: 'markPaid', labelKey: 'admin.ribbon.markPaid', icon: CheckCircle },
        { key: 'schedulePay', labelKey: 'admin.ribbon.schedulePay', icon: Calendar, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
      ],
      view: viewActions,
    },
  },

  'accounting.creditNotes': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newCreditNote', labelKey: 'admin.ribbon.newCreditNote', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'apply', labelKey: 'admin.ribbon.apply', icon: CheckCircle },
        { key: 'cancel', labelKey: 'admin.ribbon.cancel', icon: XCircle, separator: true },
        { key: 'exportPdf', labelKey: 'admin.ribbon.exportPdf', icon: Download },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
      ],
      view: viewActions,
    },
  },

  'accounting.aging': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'refresh', labelKey: 'admin.ribbon.refresh', icon: RefreshCw, variant: 'primary', separator: true },
        { key: 'sendReminders', labelKey: 'admin.ribbon.sendReminders', icon: AlertTriangle },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
      ],
      view: viewActions,
    },
  },

  'accounting.bank': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'synchronize', labelKey: 'admin.ribbon.synchronize', icon: RefreshCw, variant: 'primary' },
        { key: 'importStatement', labelKey: 'admin.ribbon.importStatement', icon: FileUp, separator: true },
        { key: 'reconcile', labelKey: 'admin.ribbon.reconcile', icon: Scale },
        { key: 'autoMatch', labelKey: 'admin.ribbon.autoMatch', icon: Zap, separator: true },
        { key: 'bankRules', labelKey: 'admin.ribbon.bankRules', icon: BookOpen },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'accounting.reports': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'generateReport', labelKey: 'admin.ribbon.generateReport', icon: FileText, variant: 'primary' },
        { key: 'schedule', labelKey: 'admin.ribbon.schedule', icon: Calendar, separator: true },
        { key: 'comparePeriods', labelKey: 'admin.ribbon.comparePeriods', icon: Scale },
        { key: 'exportPdf', labelKey: 'admin.ribbon.exportPdf', icon: Download },
        { key: 'exportExcel', labelKey: 'admin.ribbon.exportExcel', icon: FileUp, separator: true },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
      ],
      view: viewActions,
    },
  },

  'accounting.compliance': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'verifyBalances', labelKey: 'admin.ribbon.verifyBalances', icon: Scale, variant: 'primary' },
        { key: 'auditTrail', labelKey: 'admin.ribbon.auditTrail', icon: BookOpen, separator: true },
        { key: 'closePeriod', labelKey: 'admin.ribbon.closePeriod', icon: Lock, variant: 'danger' },
        { key: 'reopen', labelKey: 'admin.ribbon.reopen', icon: Unlock, variant: 'danger', separator: true },
        { key: 'fiscalCalendar', labelKey: 'admin.ribbon.fiscalCalendar', icon: Calendar },
        { key: 'taxReturn', labelKey: 'admin.ribbon.taxReturn', icon: FileText },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  // ═══════════════════════════════════════════════════════════
  // SYSTEM - Section fallback
  // ═══════════════════════════════════════════════════════════

  system: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'save', labelKey: 'admin.ribbon.save', icon: Save, variant: 'primary' },
        { key: 'reload', labelKey: 'admin.ribbon.reload', icon: RefreshCw, separator: true },
        { key: 'exportConfig', labelKey: 'admin.ribbon.exportConfig', icon: Download },
      ],
      view: [],
    },
  },

  // ── System sub-sections ────────────────────────────────────

  'system.access': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newRole', labelKey: 'admin.ribbon.newRole', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'modifyPermissions', labelKey: 'admin.ribbon.modifyPermissions', icon: Shield },
        { key: 'duplicateRole', labelKey: 'admin.ribbon.duplicateRole', icon: Copy, separator: true },
        { key: 'accessAudit', labelKey: 'admin.ribbon.accessAudit', icon: BookOpen },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: viewActions,
    },
  },

  'system.config': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'save', labelKey: 'admin.ribbon.save', icon: Save, variant: 'primary' },
        { key: 'resetDefaults', labelKey: 'admin.ribbon.resetDefaults', icon: RotateCcw, variant: 'danger', separator: true },
        { key: 'importConfig', labelKey: 'admin.ribbon.importConfig', icon: FileUp },
        { key: 'exportConfig', labelKey: 'admin.ribbon.exportConfig', icon: Download, separator: true },
        { key: 'test', labelKey: 'admin.ribbon.test', icon: CheckCircle },
      ],
      view: viewActions,
    },
  },

  'system.tools': {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'launch', labelKey: 'admin.ribbon.launch', icon: Play, variant: 'primary' },
        { key: 'refresh', labelKey: 'admin.ribbon.refresh', icon: RefreshCw, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
        { key: 'purge', labelKey: 'admin.ribbon.purge', icon: Trash2, variant: 'danger', separator: true },
        { key: 'settings', labelKey: 'admin.ribbon.settings', icon: Settings },
      ],
      view: viewActions,
    },
  },
};

// ── Sub-section detection ─────────────────────────────────────

/** Map a pathname (+ optional search params) to a granular sub-section id */
export function getSubSectionId(
  pathname: string,
  searchParams?: URLSearchParams | null,
): string | null {
  // ── Commerce ────────────────────────────────────
  if (pathname.startsWith('/admin/commandes')) return 'commerce.orders';
  if (pathname.startsWith('/admin/customers')) return 'commerce.customers';
  if (pathname.startsWith('/admin/clients')) return 'commerce.clients';
  if (pathname.startsWith('/admin/fournisseurs')) return 'commerce.suppliers';
  if (pathname.startsWith('/admin/inventaire')) return 'commerce.inventory';

  // ── Catalog ─────────────────────────────────────
  if (pathname.startsWith('/admin/produits')) return 'catalog.products';
  if (pathname.startsWith('/admin/categories')) return 'catalog.categories';

  // ── Marketing ───────────────────────────────────
  if (pathname.startsWith('/admin/promo-codes')) return 'marketing.promoCodes';
  if (pathname.startsWith('/admin/promotions')) return 'marketing.promotions';
  if (pathname.startsWith('/admin/newsletter')) return 'marketing.newsletter';
  if (pathname.startsWith('/admin/bannieres')) return 'marketing.banners';
  if (pathname.startsWith('/admin/upsell')) return 'marketing.upsell';

  // ── Community ───────────────────────────────────
  if (pathname.startsWith('/admin/avis')) return 'community.reviews';
  if (pathname.startsWith('/admin/questions')) return 'community.questions';
  if (pathname.startsWith('/admin/chat')) return 'community.chat';
  if (pathname.startsWith('/admin/ambassadeurs')) return 'community.ambassadors';

  // ── Loyalty ─────────────────────────────────────
  if (pathname.startsWith('/admin/fidelite')) return 'loyalty.program';
  if (pathname.startsWith('/admin/abonnements')) return 'loyalty.subscriptions';
  if (pathname.startsWith('/admin/webinaires')) return 'loyalty.webinars';

  // ── Media ───────────────────────────────────────
  if (pathname.startsWith('/admin/media/api-')) return 'media.apis';
  if (pathname.startsWith('/admin/media/pub-')) return 'media.ads';
  if (
    pathname.startsWith('/admin/media/videos') ||
    pathname.startsWith('/admin/media/images') ||
    pathname.startsWith('/admin/media/library')
  ) return 'media.management';

  // ── Emails (query-param based) ──────────────────
  if (pathname === '/admin/emails' || pathname.startsWith('/admin/emails/')) {
    const tab = searchParams?.get('tab');
    if (tab === 'templates') return 'emails.templates';
    if (tab === 'campaigns') return 'emails.campaigns';
    if (tab === 'flows') return 'emails.flows';
    if (tab === 'analytics') return 'emails.analytics';
    if (tab === 'segments') return 'emails.segments';
    if (tab === 'mailing-list') return 'emails.mailingList';
    return 'emails.mail';
  }

  // ── Accounting ──────────────────────────────────
  if (pathname === '/admin/comptabilite') return 'accounting.dashboard';
  if (
    pathname.startsWith('/admin/comptabilite/saisie-rapide') ||
    pathname.startsWith('/admin/comptabilite/ecritures') ||
    pathname.startsWith('/admin/comptabilite/recurrentes')
  ) return 'accounting.entries';
  if (pathname.startsWith('/admin/comptabilite/ocr')) return 'accounting.ocr';
  if (pathname.startsWith('/admin/comptabilite/depenses')) return 'accounting.expenses';
  if (
    pathname.startsWith('/admin/comptabilite/grand-livre') ||
    pathname.startsWith('/admin/comptabilite/plan-comptable') ||
    pathname.startsWith('/admin/comptabilite/immobilisations')
  ) return 'accounting.accounts';
  if (pathname.startsWith('/admin/comptabilite/factures-clients')) return 'accounting.customerInvoices';
  if (pathname.startsWith('/admin/comptabilite/factures-fournisseurs')) return 'accounting.supplierInvoices';
  if (pathname.startsWith('/admin/comptabilite/notes-credit')) return 'accounting.creditNotes';
  if (pathname.startsWith('/admin/comptabilite/aging')) return 'accounting.aging';
  if (
    pathname.startsWith('/admin/comptabilite/banques') ||
    pathname.startsWith('/admin/comptabilite/import-bancaire') ||
    pathname.startsWith('/admin/comptabilite/regles-bancaires') ||
    pathname.startsWith('/admin/comptabilite/rapprochement') ||
    pathname.startsWith('/admin/comptabilite/devises')
  ) return 'accounting.bank';
  if (
    pathname.startsWith('/admin/comptabilite/etats-financiers') ||
    pathname.startsWith('/admin/comptabilite/previsions') ||
    pathname.startsWith('/admin/comptabilite/budget') ||
    pathname.startsWith('/admin/comptabilite/rapports') ||
    pathname.startsWith('/admin/comptabilite/exports')
  ) return 'accounting.reports';
  if (
    pathname.startsWith('/admin/comptabilite/audit') ||
    pathname.startsWith('/admin/comptabilite/cloture') ||
    pathname.startsWith('/admin/comptabilite/parametres') ||
    pathname.startsWith('/admin/comptabilite/calendrier-fiscal') ||
    pathname.startsWith('/admin/comptabilite/declaration-tps-tvq')
  ) return 'accounting.compliance';

  // ── System ──────────────────────────────────────
  if (
    pathname.startsWith('/admin/permissions') ||
    pathname.startsWith('/admin/employes')
  ) return 'system.access';
  if (
    pathname.startsWith('/admin/fiscal') ||
    pathname.startsWith('/admin/livraison') ||
    pathname.startsWith('/admin/devises') ||
    pathname.startsWith('/admin/seo') ||
    pathname.startsWith('/admin/traductions') ||
    pathname.startsWith('/admin/contenu')
  ) return 'system.config';
  if (
    pathname.startsWith('/admin/rapports') ||
    pathname.startsWith('/admin/logs') ||
    pathname.startsWith('/admin/uat') ||
    pathname.startsWith('/admin/navigateur') ||
    pathname.startsWith('/admin/parametres')
  ) return 'system.tools';

  return null;
}

// ── Public API ────────────────────────────────────────────────

/** Get the ribbon config for the current page. Sub-section takes priority, falls back to section. */
export function getRibbonConfig(
  railId: string,
  pathname?: string,
  searchParams?: URLSearchParams | null,
): RibbonConfig {
  if (pathname) {
    const subSectionId = getSubSectionId(pathname, searchParams);
    if (subSectionId && ribbonConfigs[subSectionId]) {
      return ribbonConfigs[subSectionId];
    }
  }
  return ribbonConfigs[railId] ?? ribbonConfigs.dashboard;
}
