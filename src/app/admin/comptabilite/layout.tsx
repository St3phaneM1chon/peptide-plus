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
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';

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
};

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

interface NavSection {
  id: string;
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
      ],
    },
    {
      id: 'bank',
      title: t('admin.accountingLayout.sectionBank'),
      icon: 'bank',
      items: [
        { name: t('admin.accountingLayout.bankAccounts'), href: '/admin/comptabilite/banques', icon: 'bank' },
        { name: t('admin.accountingLayout.bankImport'), href: '/admin/comptabilite/import-bancaire', icon: 'download' },
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
      ],
    },
  ];

  // Find which section contains the active page
  const activeSectionId = navSections.find(section =>
    section.items.some(item =>
      item.href === pathname ||
      (item.href !== '/admin/comptabilite' && pathname.startsWith(item.href))
    )
  )?.id || 'overview';

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
        <div className="flex items-center gap-1 py-1 overflow-x-auto scrollbar-none">
          {navSections.map((section) => {
            const isActiveSection = section.id === activeSectionId;
            const isOpen = openDropdown === section.id;
            const SectionIcon = icons[section.icon];

            return (
              <div key={section.id} className="relative">
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : section.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActiveSection
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  {SectionIcon && <SectionIcon className={`w-4 h-4 ${isActiveSection ? 'text-sky-600' : 'text-slate-400'}`} />}
                  <span>{section.title}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isActiveSection ? 'text-sky-500' : 'text-slate-400'}`} />
                </button>

                {/* Dropdown */}
                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 min-w-[220px] z-30 transition-all">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href ||
                        (item.href !== '/admin/comptabilite' && pathname.startsWith(item.href));
                      const Icon = icons[item.icon];

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2.5 px-3.5 py-2 mx-1.5 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-sky-50 text-sky-700 font-medium'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />}
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

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                >
                  {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />}
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content - full width now */}
      {children}
    </div>
  );
}
