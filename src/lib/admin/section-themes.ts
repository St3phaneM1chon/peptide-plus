/**
 * Accounting Section Theme System
 *
 * Each accounting nav section has a unique color identity for visual wayfinding.
 * Colors chosen for professional, corporate feel with clear section differentiation.
 */

export type AccountingSectionId = 'overview' | 'entry' | 'accounts' | 'bank' | 'reports' | 'compliance';

export interface SectionTheme {
  id: AccountingSectionId;
  /** Nav button: active background */
  navBg: string;
  /** Nav button: active text */
  navText: string;
  /** Nav button: active border */
  navBorder: string;
  /** Nav button: active icon */
  navIcon: string;
  /** Dropdown chevron active */
  navChevron: string;
  /** Sub-nav pill: active background */
  pillBg: string;
  /** Sub-nav pill: active text */
  pillText: string;
  /** Page header accent bar (left border) */
  accentBar: string;
  /** Page header accent bg (subtle) */
  accentBg: string;
  /** StatCard icon background */
  statIconBg: string;
  /** StatCard icon color */
  statIconColor: string;
  /** Primary action button */
  btnPrimary: string;
  /** Primary action button hover */
  btnPrimaryHover: string;
  /** Section indicator dot */
  dotColor: string;
  /** Light surface for cards/highlights */
  surfaceLight: string;
  /** Border for themed elements */
  borderLight: string;
}

export const sectionThemes: Record<AccountingSectionId, SectionTheme> = {
  overview: {
    id: 'overview',
    navBg: 'bg-slate-100',
    navText: 'text-slate-800',
    navBorder: 'border-slate-300',
    navIcon: 'text-slate-600',
    navChevron: 'text-slate-500',
    pillBg: 'bg-slate-700',
    pillText: 'text-white',
    accentBar: 'border-l-slate-700',
    accentBg: 'bg-slate-50',
    statIconBg: 'bg-slate-100',
    statIconColor: 'text-slate-600',
    btnPrimary: 'bg-slate-700 hover:bg-slate-800',
    btnPrimaryHover: 'hover:bg-slate-800',
    dotColor: 'bg-slate-600',
    surfaceLight: 'bg-slate-50',
    borderLight: 'border-slate-200',
  },
  entry: {
    id: 'entry',
    navBg: 'bg-emerald-50',
    navText: 'text-emerald-800',
    navBorder: 'border-emerald-200',
    navIcon: 'text-emerald-600',
    navChevron: 'text-emerald-500',
    pillBg: 'bg-emerald-600',
    pillText: 'text-white',
    accentBar: 'border-l-emerald-500',
    accentBg: 'bg-emerald-50/50',
    statIconBg: 'bg-emerald-50',
    statIconColor: 'text-emerald-600',
    btnPrimary: 'bg-emerald-600 hover:bg-emerald-700',
    btnPrimaryHover: 'hover:bg-emerald-700',
    dotColor: 'bg-emerald-500',
    surfaceLight: 'bg-emerald-50',
    borderLight: 'border-emerald-200',
  },
  accounts: {
    id: 'accounts',
    navBg: 'bg-indigo-50',
    navText: 'text-indigo-800',
    navBorder: 'border-indigo-200',
    navIcon: 'text-indigo-600',
    navChevron: 'text-indigo-500',
    pillBg: 'bg-indigo-600',
    pillText: 'text-white',
    accentBar: 'border-l-indigo-500',
    accentBg: 'bg-indigo-50/50',
    statIconBg: 'bg-indigo-50',
    statIconColor: 'text-indigo-600',
    btnPrimary: 'bg-indigo-600 hover:bg-indigo-700',
    btnPrimaryHover: 'hover:bg-indigo-700',
    dotColor: 'bg-indigo-500',
    surfaceLight: 'bg-indigo-50',
    borderLight: 'border-indigo-200',
  },
  bank: {
    id: 'bank',
    navBg: 'bg-sky-50',
    navText: 'text-sky-800',
    navBorder: 'border-sky-200',
    navIcon: 'text-sky-600',
    navChevron: 'text-sky-500',
    pillBg: 'bg-sky-600',
    pillText: 'text-white',
    accentBar: 'border-l-sky-500',
    accentBg: 'bg-sky-50/50',
    statIconBg: 'bg-sky-50',
    statIconColor: 'text-sky-600',
    btnPrimary: 'bg-sky-600 hover:bg-sky-700',
    btnPrimaryHover: 'hover:bg-sky-700',
    dotColor: 'bg-sky-500',
    surfaceLight: 'bg-sky-50',
    borderLight: 'border-sky-200',
  },
  reports: {
    id: 'reports',
    navBg: 'bg-violet-50',
    navText: 'text-violet-800',
    navBorder: 'border-violet-200',
    navIcon: 'text-violet-600',
    navChevron: 'text-violet-500',
    pillBg: 'bg-violet-600',
    pillText: 'text-white',
    accentBar: 'border-l-violet-500',
    accentBg: 'bg-violet-50/50',
    statIconBg: 'bg-violet-50',
    statIconColor: 'text-violet-600',
    btnPrimary: 'bg-violet-600 hover:bg-violet-700',
    btnPrimaryHover: 'hover:bg-violet-700',
    dotColor: 'bg-violet-500',
    surfaceLight: 'bg-violet-50',
    borderLight: 'border-violet-200',
  },
  compliance: {
    id: 'compliance',
    navBg: 'bg-amber-50',
    navText: 'text-amber-800',
    navBorder: 'border-amber-200',
    navIcon: 'text-amber-600',
    navChevron: 'text-amber-500',
    pillBg: 'bg-amber-600',
    pillText: 'text-white',
    accentBar: 'border-l-amber-500',
    accentBg: 'bg-amber-50/50',
    statIconBg: 'bg-amber-50',
    statIconColor: 'text-amber-600',
    btnPrimary: 'bg-amber-600 hover:bg-amber-700',
    btnPrimaryHover: 'hover:bg-amber-700',
    dotColor: 'bg-amber-500',
    surfaceLight: 'bg-amber-50',
    borderLight: 'border-amber-200',
  },
};

/** Map URL paths to section IDs */
const pathToSection: Record<string, AccountingSectionId> = {
  '/admin/comptabilite': 'overview',
  '/admin/comptabilite/recherche': 'overview',
  '/admin/comptabilite/saisie-rapide': 'entry',
  '/admin/comptabilite/ecritures': 'entry',
  '/admin/comptabilite/recurrentes': 'entry',
  '/admin/comptabilite/ocr': 'entry',
  '/admin/comptabilite/depenses': 'entry',
  '/admin/comptabilite/grand-livre': 'accounts',
  '/admin/comptabilite/plan-comptable': 'accounts',
  '/admin/comptabilite/factures-clients': 'accounts',
  '/admin/comptabilite/factures-fournisseurs': 'accounts',
  '/admin/comptabilite/notes-credit': 'accounts',
  '/admin/comptabilite/bons-commande': 'accounts',
  '/admin/comptabilite/aging': 'accounts',
  '/admin/comptabilite/immobilisations': 'accounts',
  '/admin/comptabilite/banques': 'bank',
  '/admin/comptabilite/import-bancaire': 'bank',
  '/admin/comptabilite/regles-bancaires': 'bank',
  '/admin/comptabilite/rapprochement': 'bank',
  '/admin/comptabilite/devises': 'bank',
  '/admin/comptabilite/etats-financiers': 'reports',
  '/admin/comptabilite/previsions': 'reports',
  '/admin/comptabilite/budget': 'reports',
  '/admin/comptabilite/rapports': 'reports',
  '/admin/comptabilite/exports': 'reports',
  '/admin/comptabilite/audit': 'compliance',
  '/admin/comptabilite/cloture': 'compliance',
  '/admin/comptabilite/parametres': 'compliance',
  '/admin/comptabilite/calendrier-fiscal': 'compliance',
  '/admin/comptabilite/declaration-tps-tvq': 'compliance',
  '/admin/comptabilite/multi-entite': 'compliance',
  '/admin/comptabilite/rsde': 'compliance',
};

/** Get section ID from pathname */
export function getSectionFromPath(pathname: string): AccountingSectionId {
  // Exact match first
  if (pathToSection[pathname]) return pathToSection[pathname];
  // Prefix match (for sub-routes)
  for (const [path, section] of Object.entries(pathToSection)) {
    if (path !== '/admin/comptabilite' && pathname.startsWith(path)) {
      return section;
    }
  }
  return 'overview';
}

/** Get theme for current section */
export function getSectionTheme(pathname: string): SectionTheme {
  return sectionThemes[getSectionFromPath(pathname)];
}
