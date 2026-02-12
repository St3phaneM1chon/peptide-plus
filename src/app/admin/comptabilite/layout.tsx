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

const navSections = [
  {
    title: 'Vue d\'ensemble',
    items: [
      { name: 'Dashboard', href: '/admin/comptabilite', icon: 'dashboard' },
      { name: 'Recherche', href: '/admin/comptabilite/recherche', icon: 'search' },
    ],
  },
  {
    title: 'Saisie',
    items: [
      { name: 'Saisie Rapide', href: '/admin/comptabilite/saisie-rapide', icon: 'zap' },
      { name: 'Écritures', href: '/admin/comptabilite/ecritures', icon: 'edit' },
      { name: 'Récurrentes', href: '/admin/comptabilite/recurrentes', icon: 'repeat' },
      { name: 'OCR Factures', href: '/admin/comptabilite/ocr', icon: 'camera' },
    ],
  },
  {
    title: 'Comptes',
    items: [
      { name: 'Grand Livre', href: '/admin/comptabilite/grand-livre', icon: 'book' },
      { name: 'Plan Comptable', href: '/admin/comptabilite/plan-comptable', icon: 'list' },
      { name: 'Factures Clients', href: '/admin/comptabilite/factures-clients', icon: 'invoice' },
      { name: 'Factures Fournisseurs', href: '/admin/comptabilite/factures-fournisseurs', icon: 'receipt' },
      { name: 'Notes de Credit', href: '/admin/comptabilite/notes-credit', icon: 'invoice' },
      { name: 'Aging', href: '/admin/comptabilite/aging', icon: 'clock' },
    ],
  },
  {
    title: 'Banque',
    items: [
      { name: 'Comptes Bancaires', href: '/admin/comptabilite/banques', icon: 'bank' },
      { name: 'Import Bancaire', href: '/admin/comptabilite/import-bancaire', icon: 'download' },
      { name: 'Rapprochement', href: '/admin/comptabilite/rapprochement', icon: 'check' },
      { name: 'Devises', href: '/admin/comptabilite/devises', icon: 'currency' },
    ],
  },
  {
    title: 'Rapports',
    items: [
      { name: 'États Financiers', href: '/admin/comptabilite/etats-financiers', icon: 'chart' },
      { name: 'Prévisions', href: '/admin/comptabilite/previsions', icon: 'trending' },
      { name: 'Budget', href: '/admin/comptabilite/budget', icon: 'target' },
      { name: 'Rapports', href: '/admin/comptabilite/rapports', icon: 'report' },
      { name: 'Exports', href: '/admin/comptabilite/exports', icon: 'upload' },
    ],
  },
  {
    title: 'Conformité',
    items: [
      { name: 'Piste d\'Audit', href: '/admin/comptabilite/audit', icon: 'shield' },
      { name: 'Clôture', href: '/admin/comptabilite/cloture', icon: 'lock' },
      { name: 'Paramètres', href: '/admin/comptabilite/parametres', icon: 'settings' },
    ],
  },
];

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
