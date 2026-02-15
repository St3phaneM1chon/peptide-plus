'use client';

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

export default function ComptabiliteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const navSections = [
    {
      title: t('admin.accountingLayout.sectionOverview'),
      items: [
        { name: t('admin.accountingLayout.dashboard'), href: '/admin/comptabilite', icon: 'dashboard' },
        { name: t('admin.accountingLayout.search'), href: '/admin/comptabilite/recherche', icon: 'search' },
      ],
    },
    {
      title: t('admin.accountingLayout.sectionEntry'),
      items: [
        { name: t('admin.accountingLayout.quickEntry'), href: '/admin/comptabilite/saisie-rapide', icon: 'zap' },
        { name: t('admin.accountingLayout.entries'), href: '/admin/comptabilite/ecritures', icon: 'edit' },
        { name: t('admin.accountingLayout.recurring'), href: '/admin/comptabilite/recurrentes', icon: 'repeat' },
        { name: t('admin.accountingLayout.ocrInvoices'), href: '/admin/comptabilite/ocr', icon: 'camera' },
      ],
    },
    {
      title: t('admin.accountingLayout.sectionAccounts'),
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
      title: t('admin.accountingLayout.sectionBank'),
      items: [
        { name: t('admin.accountingLayout.bankAccounts'), href: '/admin/comptabilite/banques', icon: 'bank' },
        { name: t('admin.accountingLayout.bankImport'), href: '/admin/comptabilite/import-bancaire', icon: 'download' },
        { name: t('admin.accountingLayout.reconciliation'), href: '/admin/comptabilite/rapprochement', icon: 'check' },
        { name: t('admin.accountingLayout.currencies'), href: '/admin/comptabilite/devises', icon: 'currency' },
      ],
    },
    {
      title: t('admin.accountingLayout.sectionReports'),
      items: [
        { name: t('admin.accountingLayout.financialStatements'), href: '/admin/comptabilite/etats-financiers', icon: 'chart' },
        { name: t('admin.accountingLayout.forecasts'), href: '/admin/comptabilite/previsions', icon: 'trending' },
        { name: t('admin.accountingLayout.budget'), href: '/admin/comptabilite/budget', icon: 'target' },
        { name: t('admin.accountingLayout.reports'), href: '/admin/comptabilite/rapports', icon: 'report' },
        { name: t('admin.accountingLayout.exports'), href: '/admin/comptabilite/exports', icon: 'upload' },
      ],
    },
    {
      title: t('admin.accountingLayout.sectionCompliance'),
      items: [
        { name: t('admin.accountingLayout.auditTrail'), href: '/admin/comptabilite/audit', icon: 'shield' },
        { name: t('admin.accountingLayout.closing'), href: '/admin/comptabilite/cloture', icon: 'lock' },
        { name: t('admin.accountingLayout.settings'), href: '/admin/comptabilite/parametres', icon: 'settings' },
      ],
    },
  ];

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <aside className="w-52 flex-shrink-0">
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-2 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
          {navSections.map((section, sectionIdx) => (
            <div key={section.title} className={sectionIdx > 0 ? 'mt-3 pt-3 border-t border-neutral-700' : ''}>
              <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider px-2 mb-1">
                {section.title}
              </h2>
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/admin/comptabilite' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-sky-600/20 text-sky-400'
                          : 'text-neutral-400 hover:bg-neutral-700 hover:text-white'
                      }`}
                    >
                      {(() => {
                        const Icon = icons[item.icon];
                        return Icon ? <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-neutral-500'}`} /> : null;
                      })()}
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
