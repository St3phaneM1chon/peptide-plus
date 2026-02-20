'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  Zap,
  Pencil,
  Repeat,
  Camera,
  Download,
  Upload,
  CircleDollarSign,
  TrendingUp,
  ShieldCheck,
  Clock,
  BookOpen,
  ClipboardList,
  FileText,
  Clipboard,
  Landmark,
  CheckCircle,
  BarChart3,
  FileBarChart,
  Target,
  Lock,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  CalendarDays,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { sectionThemes, getSectionFromPath, type AccountingSectionId } from '@/lib/admin/section-themes';

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  search: Search,
  zap: Zap,
  repeat: Repeat,
  camera: Camera,
  download: Download,
  upload: Upload,
  currency: CircleDollarSign,
  trending: TrendingUp,
  shield: ShieldCheck,
  clock: Clock,
  book: BookOpen,
  list: ClipboardList,
  edit: Pencil,
  invoice: FileText,
  receipt: Clipboard,
  bank: Landmark,
  check: CheckCircle,
  chart: BarChart3,
  report: FileBarChart,
  target: Target,
  lock: Lock,
  settings: Settings,
  building: Building2,
  calendar: CalendarDays,
  taxReceipt: Receipt,
};

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

interface NavSection {
  id: AccountingSectionId;
  title: string;
  icon: string;
  items: NavItem[];
}

export default function ComptabiliteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const navSections: NavSection[] = [
    {
      id: 'overview',
      title: t('admin.accountingLayout.sectionOverview'),
      icon: 'dashboard',
      items: [
        { name: t('admin.accountingLayout.dashboard'), href: '/admin/comptabilite', icon: 'dashboard' },
        { name: t('admin.accountingLayout.search'), href: '/admin/comptabilite/recherche', icon: 'search' },
      ],
    },
    {
      id: 'entry',
      title: t('admin.accountingLayout.sectionEntry'),
      icon: 'edit',
      items: [
        { name: t('admin.accountingLayout.quickEntry'), href: '/admin/comptabilite/saisie-rapide', icon: 'zap' },
        { name: t('admin.accountingLayout.entries'), href: '/admin/comptabilite/ecritures', icon: 'edit' },
        { name: t('admin.accountingLayout.recurring'), href: '/admin/comptabilite/recurrentes', icon: 'repeat' },
        { name: t('admin.accountingLayout.ocrInvoices'), href: '/admin/comptabilite/ocr', icon: 'camera' },
        { name: t('admin.accountingLayout.expenses') || 'Depenses', href: '/admin/comptabilite/depenses', icon: 'receipt' },
      ],
    },
    {
      id: 'accounts',
      title: t('admin.accountingLayout.sectionAccounts'),
      icon: 'book',
      items: [
        { name: t('admin.accountingLayout.generalLedger'), href: '/admin/comptabilite/grand-livre', icon: 'book' },
        { name: t('admin.accountingLayout.chartOfAccounts'), href: '/admin/comptabilite/plan-comptable', icon: 'list' },
        { name: t('admin.accountingLayout.clientInvoices'), href: '/admin/comptabilite/factures-clients', icon: 'invoice' },
        { name: t('admin.accountingLayout.supplierInvoices'), href: '/admin/comptabilite/factures-fournisseurs', icon: 'receipt' },
        { name: t('admin.accountingLayout.creditNotes'), href: '/admin/comptabilite/notes-credit', icon: 'invoice' },
        { name: t('admin.accountingLayout.aging'), href: '/admin/comptabilite/aging', icon: 'clock' },
        { name: t('admin.accountingLayout.fixedAssets') || 'Immobilisations', href: '/admin/comptabilite/immobilisations', icon: 'building' },
      ],
    },
    {
      id: 'bank',
      title: t('admin.accountingLayout.sectionBank'),
      icon: 'bank',
      items: [
        { name: t('admin.accountingLayout.bankAccounts'), href: '/admin/comptabilite/banques', icon: 'bank' },
        { name: t('admin.accountingLayout.bankImport'), href: '/admin/comptabilite/import-bancaire', icon: 'download' },
        { name: t('admin.accountingLayout.bankRules') || 'Bank Rules', href: '/admin/comptabilite/regles-bancaires', icon: 'zap' },
        { name: t('admin.accountingLayout.reconciliation'), href: '/admin/comptabilite/rapprochement', icon: 'check' },
        { name: t('admin.accountingLayout.currencies'), href: '/admin/comptabilite/devises', icon: 'currency' },
      ],
    },
    {
      id: 'reports',
      title: t('admin.accountingLayout.sectionReports'),
      icon: 'chart',
      items: [
        { name: t('admin.accountingLayout.financialStatements'), href: '/admin/comptabilite/etats-financiers', icon: 'chart' },
        { name: t('admin.accountingLayout.forecasts'), href: '/admin/comptabilite/previsions', icon: 'trending' },
        { name: t('admin.accountingLayout.budget'), href: '/admin/comptabilite/budget', icon: 'target' },
        { name: t('admin.accountingLayout.reports'), href: '/admin/comptabilite/rapports', icon: 'report' },
        { name: t('admin.accountingLayout.exports'), href: '/admin/comptabilite/exports', icon: 'upload' },
      ],
    },
    {
      id: 'compliance',
      title: t('admin.accountingLayout.sectionCompliance'),
      icon: 'shield',
      items: [
        { name: t('admin.accountingLayout.auditTrail'), href: '/admin/comptabilite/audit', icon: 'shield' },
        { name: t('admin.accountingLayout.closing'), href: '/admin/comptabilite/cloture', icon: 'lock' },
        { name: t('admin.accountingLayout.settings'), href: '/admin/comptabilite/parametres', icon: 'settings' },
        { name: t('admin.accountingLayout.fiscalCalendar') || 'Calendrier fiscal', href: '/admin/comptabilite/calendrier-fiscal', icon: 'calendar' },
        { name: t('admin.accountingLayout.gstQstReturn') || 'TPS/TVQ', href: '/admin/comptabilite/declaration-tps-tvq', icon: 'taxReceipt' },
      ],
    },
  ];

  const activeSectionId = getSectionFromPath(pathname);
  const activeSection = navSections.find(s => s.id === activeSectionId);
  const activeItem = activeSection?.items.find(
    item => item.href === pathname || (item.href !== '/admin/comptabilite' && pathname.startsWith(item.href))
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on navigation
  useEffect(() => {
    setOpenDropdown(null);
  }, [pathname]);

  return (
    <div>
      {/* Horizontal Navigation Bar */}
      <div ref={navRef} className="bg-white border-b border-slate-200 -mx-4 lg:-mx-6 -mt-4 lg:-mt-6 mb-6 px-4 lg:px-6 sticky top-14 z-20">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 pt-2.5 pb-1 text-xs text-slate-400">
          <Link href="/admin/dashboard" className="hover:text-slate-600 transition-colors">
            Admin
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/admin/comptabilite" className="hover:text-slate-600 transition-colors">
            {t('admin.nav.accounting')}
          </Link>
          {activeSection && activeSectionId !== 'overview' && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-500 font-medium">{activeSection.title}</span>
            </>
          )}
          {activeItem && activeItem.href !== '/admin/comptabilite' && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-600 font-medium">{activeItem.name}</span>
            </>
          )}
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 py-1 overflow-x-auto scrollbar-none">
          {navSections.map((section) => {
            const isActiveSection = section.id === activeSectionId;
            const isOpen = openDropdown === section.id;
            const SectionIcon = icons[section.icon];
            const theme = sectionThemes[section.id];

            return (
              <div key={section.id} className="relative">
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : section.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActiveSection
                      ? `${theme.navBg} ${theme.navText} border ${theme.navBorder}`
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'
                  }`}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                >
                  {SectionIcon && <SectionIcon className={`w-4 h-4 ${isActiveSection ? theme.navIcon : 'text-slate-400'}`} />}
                  <span>{section.title}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isActiveSection ? theme.navChevron : 'text-slate-400'}`} />
                </button>

                {/* Dropdown */}
                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 min-w-[220px] z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href ||
                        (item.href !== '/admin/comptabilite' && pathname.startsWith(item.href));
                      const Icon = icons[item.icon];
                      const itemTheme = sectionThemes[section.id];

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2.5 px-3.5 py-2 mx-1.5 rounded-lg text-sm transition-colors ${
                            isActive
                              ? `${itemTheme.navBg} ${itemTheme.navText} font-medium`
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? itemTheme.navIcon : 'text-slate-400'}`} />}
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Active section sub-nav pills */}
        {activeSectionId && (
          <div className="flex items-center gap-1 pb-2 overflow-x-auto scrollbar-none border-t border-slate-100 pt-2">
            {navSections.find(s => s.id === activeSectionId)?.items.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/admin/comptabilite' && pathname.startsWith(item.href));
              const Icon = icons[item.icon];
              const theme = sectionThemes[activeSectionId];

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? `${theme.pillBg} ${theme.pillText} shadow-sm`
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />}
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content */}
      {children}
    </div>
  );
}
