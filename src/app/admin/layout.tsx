'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, ShoppingCart, Users, Package, FolderOpen, Archive,
  Tag, Percent, Mail, ImageIcon, Star, HelpCircle, MessageCircle, Award,
  Gift, RefreshCw, Video, Truck, DollarSign, Send, Search, FileText,
  Briefcase, Calculator, PenLine, FileSpreadsheet, Landmark, TrendingUp,
  BarChart2, Activity, UserCheck, Settings, Menu, X, ChevronDown,
  ChevronLeft, ExternalLink, Shield, Bell, FlaskConical
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
};

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: 'home' },
      { href: '/admin/commandes', label: 'Commandes', icon: 'shopping-cart', badge: true },
      { href: '/admin/clients', label: 'Clients', icon: 'users' },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { href: '/admin/produits', label: 'Produits', icon: 'package' },
      { href: '/admin/categories', label: 'Categories', icon: 'folder' },
      { href: '/admin/inventaire', label: 'Inventaire', icon: 'archive' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { href: '/admin/promo-codes', label: 'Codes Promo', icon: 'tag' },
      { href: '/admin/promotions', label: 'Promotions', icon: 'percent' },
      { href: '/admin/newsletter', label: 'Newsletter', icon: 'mail' },
      { href: '/admin/bannieres', label: 'Bannieres', icon: 'image' },
    ],
  },
  {
    title: 'Communaute',
    items: [
      { href: '/admin/avis', label: 'Avis', icon: 'star' },
      { href: '/admin/questions', label: 'Questions', icon: 'help-circle' },
      { href: '/admin/chat', label: 'Chat Support', icon: 'message-circle' },
      { href: '/admin/ambassadeurs', label: 'Ambassadeurs', icon: 'award' },
    ],
  },
  {
    title: 'Fidelite',
    items: [
      { href: '/admin/fidelite', label: 'Programme Fidelite', icon: 'gift' },
      { href: '/admin/abonnements', label: 'Abonnements', icon: 'refresh-cw' },
      { href: '/admin/webinaires', label: 'Webinaires', icon: 'video' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { href: '/admin/livraison', label: 'Zones Livraison', icon: 'truck' },
      { href: '/admin/devises', label: 'Devises', icon: 'dollar-sign' },
      { href: '/admin/emails', label: 'Emails', icon: 'send' },
      { href: '/admin/seo', label: 'SEO', icon: 'search' },
      { href: '/admin/contenu', label: 'Contenu/Pages', icon: 'file-text' },
      { href: '/admin/medias', label: 'Medias', icon: 'image' },
    ],
  },
  {
    title: 'Comptabilite',
    items: [
      { href: '/admin/comptabilite', label: 'Dashboard Comptable', icon: 'calculator' },
      { href: '/admin/comptabilite/ecritures', label: 'Ecritures', icon: 'edit-3' },
      { href: '/admin/comptabilite/factures-clients', label: 'Factures Clients', icon: 'file-invoice' },
      { href: '/admin/comptabilite/banques', label: 'Banques', icon: 'bank' },
      { href: '/admin/comptabilite/etats-financiers', label: 'Etats Financiers', icon: 'trending-up' },
    ],
  },
  {
    title: 'Systeme',
    items: [
      { href: '/admin/permissions', label: 'Permissions', icon: 'shield' },
      { href: '/admin/fiscal', label: 'Fiscal & Taxes', icon: 'briefcase' },
      { href: '/admin/rapports', label: 'Rapports', icon: 'bar-chart-2' },
      { href: '/admin/logs', label: 'Logs/Audit', icon: 'activity' },
      { href: '/admin/employes', label: 'Employes', icon: 'user-check' },
      { href: '/admin/parametres', label: 'Parametres', icon: 'settings' },
      { href: '/admin/uat', label: 'UAT Testing', icon: 'flask' },
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
  const [expandedSections, setExpandedSections] = useState<string[]>(['Principal', 'Catalogue']);
  const pathname = usePathname();
  const { data: session } = useSession();

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
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
              <span className="font-semibold text-[15px] text-slate-100">BioCycle Admin</span>
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
            <div key={section.title} className="mb-1">
              {sidebarOpen && (
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
                >
                  {section.title}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedSections.includes(section.title) ? '' : '-rotate-90'}`}
                  />
                </button>
              )}

              {(expandedSections.includes(section.title) || !sidebarOpen) && (
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
                      title={!sidebarOpen ? item.label : undefined}
                    >
                      <NavIcon name={item.icon} className="w-[18px] h-[18px] flex-shrink-0" />
                      {sidebarOpen && <span className="text-[13px] font-medium truncate">{item.label}</span>}
                      {item.badge && sidebarOpen && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                          3
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
            {sidebarOpen && <span>Voir le site</span>}
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
            <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Notifications">
              <Bell className="w-[18px] h-[18px] text-slate-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Orders */}
            <Link
              href="/admin/commandes"
              className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Commandes"
            >
              <ShoppingCart className="w-[18px] h-[18px] text-slate-500" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center leading-none px-1">
                3
              </span>
            </Link>

            {/* Chat */}
            <Link
              href="/admin/chat"
              className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Chat"
            >
              <MessageCircle className="w-[18px] h-[18px] text-slate-500" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-sky-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center leading-none px-1">
                2
              </span>
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
    </div>
  );
}
