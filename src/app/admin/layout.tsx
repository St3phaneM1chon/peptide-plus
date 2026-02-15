'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from '@/hooks/useTranslations';
import { Toaster } from 'sonner';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, ShoppingCart, Users, Package, FolderOpen, Archive,
  Tag, Percent, Mail, ImageIcon, Star, HelpCircle, MessageCircle, Award,
  Gift, RefreshCw, Video, Truck, DollarSign, Send, Search, FileText,
  Briefcase, Calculator, PenLine, FileSpreadsheet, Landmark, TrendingUp,
  BarChart2, Activity, UserCheck, Settings, Menu, ChevronDown,
  ChevronLeft, ExternalLink, Shield, Bell, FlaskConical, Languages
} from 'lucide-react';

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  'home': LayoutDashboard,
  'shopping-cart': ShoppingCart,
  'users': Users,
  'package': Package,
  'folder': FolderOpen,
  'archive': Archive,
  'tag': Tag,
  'percent': Percent,
  'mail': Mail,
  'image': ImageIcon,
  'star': Star,
  'help-circle': HelpCircle,
  'message-circle': MessageCircle,
  'award': Award,
  'gift': Gift,
  'refresh-cw': RefreshCw,
  'video': Video,
  'truck': Truck,
  'dollar-sign': DollarSign,
  'send': Send,
  'search': Search,
  'file-text': FileText,
  'briefcase': Briefcase,
  'calculator': Calculator,
  'edit-3': PenLine,
  'file-invoice': FileSpreadsheet,
  'bank': Landmark,
  'trending-up': TrendingUp,
  'bar-chart-2': BarChart2,
  'activity': Activity,
  'user-check': UserCheck,
  'settings': Settings,
  'shield': Shield,
  'flask': FlaskConical,
  'languages': Languages,
};

interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
  badge?: boolean;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    titleKey: 'admin.nav.main',
    items: [
      { href: '/admin/dashboard', labelKey: 'admin.nav.dashboard', icon: 'home' },
      { href: '/admin/commandes', labelKey: 'admin.nav.orders', icon: 'shopping-cart', badge: true },
      { href: '/admin/customers', labelKey: 'admin.nav.customers', icon: 'users' },
      { href: '/admin/clients', labelKey: 'admin.nav.distributors', icon: 'briefcase' },
    ],
  },
  {
    titleKey: 'admin.nav.catalog',
    items: [
      { href: '/admin/produits', labelKey: 'admin.nav.products', icon: 'package' },
      { href: '/admin/categories', labelKey: 'admin.nav.categories', icon: 'folder' },
      { href: '/admin/inventaire', labelKey: 'admin.nav.inventory', icon: 'archive' },
    ],
  },
  {
    titleKey: 'admin.nav.marketing',
    items: [
      { href: '/admin/promo-codes', labelKey: 'admin.nav.promoCodes', icon: 'tag' },
      { href: '/admin/promotions', labelKey: 'admin.nav.promotions', icon: 'percent' },
      { href: '/admin/newsletter', labelKey: 'admin.nav.newsletter', icon: 'mail' },
      { href: '/admin/bannieres', labelKey: 'admin.nav.banners', icon: 'image' },
    ],
  },
  {
    titleKey: 'admin.nav.community',
    items: [
      { href: '/admin/avis', labelKey: 'admin.nav.reviews', icon: 'star' },
      { href: '/admin/questions', labelKey: 'admin.nav.questions', icon: 'help-circle' },
      { href: '/admin/chat', labelKey: 'admin.nav.chatSupport', icon: 'message-circle' },
      { href: '/admin/ambassadeurs', labelKey: 'admin.nav.ambassadors', icon: 'award' },
    ],
  },
  {
    titleKey: 'admin.nav.loyalty',
    items: [
      { href: '/admin/fidelite', labelKey: 'admin.nav.loyaltyProgram', icon: 'gift' },
      { href: '/admin/abonnements', labelKey: 'admin.nav.subscriptions', icon: 'refresh-cw' },
      { href: '/admin/webinaires', labelKey: 'admin.nav.webinars', icon: 'video' },
    ],
  },
  {
    titleKey: 'admin.nav.configuration',
    items: [
      { href: '/admin/livraison', labelKey: 'admin.nav.shippingZones', icon: 'truck' },
      { href: '/admin/devises', labelKey: 'admin.nav.currencies', icon: 'dollar-sign' },
      { href: '/admin/emails', labelKey: 'admin.nav.emails', icon: 'send' },
      { href: '/admin/seo', labelKey: 'admin.nav.seo', icon: 'search' },
      { href: '/admin/traductions', labelKey: 'admin.nav.translations', icon: 'languages' },
      { href: '/admin/contenu', labelKey: 'admin.nav.contentPages', icon: 'file-text' },
      { href: '/admin/medias', labelKey: 'admin.nav.media', icon: 'image' },
    ],
  },
  {
    titleKey: 'admin.nav.accounting',
    items: [
      { href: '/admin/comptabilite', labelKey: 'admin.nav.accountingDashboard', icon: 'calculator' },
      { href: '/admin/comptabilite/ecritures', labelKey: 'admin.nav.entries', icon: 'edit-3' },
      { href: '/admin/comptabilite/factures-clients', labelKey: 'admin.nav.customerInvoices', icon: 'file-invoice' },
      { href: '/admin/comptabilite/banques', labelKey: 'admin.nav.banks', icon: 'bank' },
      { href: '/admin/comptabilite/etats-financiers', labelKey: 'admin.nav.financialStatements', icon: 'trending-up' },
    ],
  },
  {
    titleKey: 'admin.nav.system',
    items: [
      { href: '/admin/permissions', labelKey: 'admin.nav.permissions', icon: 'shield' },
      { href: '/admin/fiscal', labelKey: 'admin.nav.fiscalTaxes', icon: 'briefcase' },
      { href: '/admin/rapports', labelKey: 'admin.nav.reports', icon: 'bar-chart-2' },
      { href: '/admin/logs', labelKey: 'admin.nav.logsAudit', icon: 'activity' },
      { href: '/admin/employes', labelKey: 'admin.nav.employees', icon: 'user-check' },
      { href: '/admin/parametres', labelKey: 'admin.nav.settings', icon: 'settings' },
      { href: '/admin/uat', labelKey: 'admin.nav.uatTesting', icon: 'flask' },
    ],
  },
];

function NavIcon({ name, className = 'w-[18px] h-[18px]' }: { name: string; className?: string }) {
  const LucideIcon = iconMap[name];
  if (!LucideIcon) return <HelpCircle className={className} />;
  return <LucideIcon className={className} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['admin.nav.main', 'admin.nav.catalog']);
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useTranslations();
  const { pendingOrders, unreadChats } = useAdminNotifications();

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(s => s !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full bg-slate-900 text-white transition-all duration-300
          ${sidebarOpen ? 'w-60' : 'w-[68px]'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800">
          {sidebarOpen ? (
            <Link href="/admin/dashboard" className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-sky-500 rounded-md flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">BC</span>
              </div>
              <span className="font-semibold text-[15px] text-slate-100">{t('admin.brandName')}</span>
            </Link>
          ) : (
            <Link href="/admin/dashboard" className="mx-auto">
              <div className="w-8 h-8 bg-sky-500 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-xs">BC</span>
              </div>
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-3 overflow-y-auto h-[calc(100vh-7rem)] scrollbar-thin scrollbar-thumb-slate-700">
          {navSections.map((section) => (
            <div key={section.titleKey} className="mb-1">
              {sidebarOpen && (
                <button
                  onClick={() => toggleSection(section.titleKey)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
                >
                  {t(section.titleKey)}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSections.includes(section.titleKey) ? '' : '-rotate-90'}`}
                  />
                </button>
              )}

              {(expandedSections.includes(section.titleKey) || !sidebarOpen) && (
                <div className="space-y-0.5 mt-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-md transition-colors relative
                        ${isActive(item.href)
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }
                        ${!sidebarOpen ? 'justify-center px-0' : ''}
                      `}
                      title={!sidebarOpen ? t(item.labelKey) : undefined}
                    >
                      <NavIcon name={item.icon} className="w-[18px] h-[18px] flex-shrink-0" />
                      {sidebarOpen && <span className="text-[13px] font-medium truncate">{t(item.labelKey)}</span>}
                      {item.badge && sidebarOpen && pendingOrders > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                          {pendingOrders}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3 border-t border-slate-800">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-[13px] transition-colors px-2.5 py-1.5"
          >
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && <span>{t('admin.viewSite')}</span>}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-[68px]'}`}>
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors" title={t('admin.notifications')}>
              <Bell className="w-[18px] h-[18px] text-slate-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Orders */}
            <Link
              href="/admin/commandes"
              className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title={t('admin.nav.orders')}
            >
              <ShoppingCart className="w-[18px] h-[18px] text-slate-500" />
              {pendingOrders > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center leading-none px-1">
                  {pendingOrders}
                </span>
              )}
            </Link>

            {/* Chat */}
            <Link
              href="/admin/chat"
              className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title={t('admin.chat')}
            >
              <MessageCircle className="w-[18px] h-[18px] text-slate-500" />
              {unreadChats > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-sky-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center leading-none px-1">
                  {unreadChats}
                </span>
              )}
            </Link>

            {/* Separator */}
            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* User menu */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                <span className="text-slate-200 font-medium text-sm">
                  {session?.user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-800 leading-tight">
                  {session?.user?.name || 'Admin'}
                </p>
                <p className="text-[11px] text-slate-400 leading-tight">
                  {session?.user?.role || 'OWNER'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
