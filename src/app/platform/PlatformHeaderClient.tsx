'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { CompanyBranding } from './layout';

interface DropdownItem {
  label: string;
  href: string;
  description?: string;
}

// Left column: overview + core modules
const produitCol1: DropdownItem[] = [
  { label: 'Vue d\u2019ensemble', href: '/platform/features', description: 'Toutes les fonctionnalit\u00e9s' },
  { label: 'Commerce', href: '/platform/features/commerce', description: 'E-commerce & ventes' },
  { label: 'CRM', href: '/platform/features/crm', description: 'Gestion de la relation client' },
  { label: 'Comptabilit\u00e9', href: '/platform/features/comptabilite', description: 'Finances & rapports' },
  { label: 'Marketing', href: '/platform/features/marketing', description: 'Campagnes & automatisation' },
  { label: 'T\u00e9l\u00e9phonie', href: '/platform/features/telephonie', description: 'VoIP & centre d\u2019appels' },
  { label: 'Formation', href: '/platform/features/formation', description: 'LMS & apprentissage' },
];

// Right column: secondary modules + cross-cutting
const produitCol2: DropdownItem[] = [
  { label: 'Emails', href: '/platform/features/emails', description: 'Messagerie & templates' },
  { label: 'M\u00e9dias', href: '/platform/features/media', description: 'Biblioth\u00e8que & gestion' },
  { label: 'Fid\u00e9lit\u00e9', href: '/platform/features/fidelite', description: 'Points & r\u00e9compenses' },
  { label: 'Communaut\u00e9', href: '/platform/features/communaute', description: 'Forum & \u00e9changes' },
  { label: 'IA Aur\u00e9lia', href: '/platform/features/ia', description: 'Intelligence artificielle' },
  { label: 'Int\u00e9grations', href: '/platform/integrations', description: 'Connecteurs & API' },
  { label: 'S\u00e9curit\u00e9', href: '/securite', description: 'Protection & conformit\u00e9' },
];

// Combined flat list for mobile menu
const produitItems: DropdownItem[] = [...produitCol1, ...produitCol2];

const solutionsItems: DropdownItem[] = [
  { label: 'Pour le e-commerce', href: '/platform/pour/ecommerce' },
  { label: 'Pour les services', href: '/platform/pour/services' },
  { label: 'Pour le coaching', href: '/platform/pour/coaching' },
  { label: 'Pour la formation', href: '/platform/pour/formation' },
  { label: 'Pour le B2B', href: '/platform/pour/b2b' },
  { label: 'Calculateur ROI', href: '/platform/calculateur-roi' },
  { label: 'Comparaison', href: '/platform/comparer' },
];

const entrepriseItems: DropdownItem[] = [
  { label: 'A propos', href: '/a-propos' },
  { label: 'Mission', href: '/a-propos/mission' },
  { label: 'Equipe', href: '/a-propos/equipe' },
  { label: 'Carrieres', href: '/carrieres' },
  { label: 'Contact', href: '/contact' },
  { label: 'Partenaires', href: '/platform/partenaires' },
  { label: 'Blog', href: '/blog' },
];

function NavDropdown({ label, items }: { label: string; items: DropdownItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProduitMegaMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Produit
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full -left-4 mt-2 w-[520px] bg-white rounded-xl shadow-lg border border-gray-100 p-4 z-50">
          <div className="grid grid-cols-2 gap-x-4">
            {/* Column 1 */}
            <div className="space-y-0.5">
              {produitCol1.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  onClick={() => setOpen(false)}
                >
                  <span className="block text-sm font-medium text-gray-900 group-hover:text-[#0066CC] transition-colors">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="block text-xs text-gray-400 mt-0.5">{item.description}</span>
                  )}
                </Link>
              ))}
            </div>
            {/* Column 2 */}
            <div className="space-y-0.5">
              {produitCol2.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  onClick={() => setOpen(false)}
                >
                  <span className="block text-sm font-medium text-gray-900 group-hover:text-[#0066CC] transition-colors">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="block text-xs text-gray-400 mt-0.5">{item.description}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileMenuSection({
  label,
  items,
  onClose,
}: {
  label: string;
  items: DropdownItem[];
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-2.5 text-sm font-medium text-gray-900"
      >
        {label}
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="pl-4 space-y-1 pb-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-2 text-sm text-gray-600 hover:text-gray-900"
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="md:hidden bg-white border-b border-gray-100 shadow-lg">
      <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
        <MobileMenuSection label="Produit" items={produitItems} onClose={onClose} />
        <MobileMenuSection label="Solutions" items={solutionsItems} onClose={onClose} />
        <MobileMenuSection label="Entreprise" items={entrepriseItems} onClose={onClose} />

        {/* Direct links */}
        <Link
          href="/pricing"
          className="block py-2.5 text-sm font-medium text-gray-900"
          onClick={onClose}
        >
          Tarifs
        </Link>

        {/* Mobile CTA */}
        <div className="pt-4 border-t border-gray-100 space-y-2">
          <Link
            href="/auth/signin"
            className="block w-full text-center py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            onClick={onClose}
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="block w-full text-center py-2.5 bg-[#0066CC] text-white text-sm font-semibold rounded-full hover:bg-[#0052A3] transition-colors"
            onClick={onClose}
          >
            Commencer
          </Link>
        </div>
      </nav>
    </div>
  );
}

export function PlatformHeaderClient({ company }: { company: CompanyBranding }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            {company.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={company.companyName}
                width={36}
                height={36}
                className="w-9 h-9 rounded-xl object-contain"
              />
            ) : (
              <div className="w-9 h-9 bg-[#0066CC] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:shadow-md transition-shadow">
                K
              </div>
            )}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-gray-900 tracking-tight">Kor@line</span>
              <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">par {company.companyName}</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <ProduitMegaMenu />
            <NavDropdown label="Solutions" items={solutionsItems} />
            <NavDropdown label="Entreprise" items={entrepriseItems} />
            <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Tarifs
            </Link>
          </nav>

          {/* CTA + Hamburger */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="hidden sm:inline-flex items-center px-4 py-2 bg-[#0066CC] text-white text-sm font-semibold rounded-full hover:bg-[#0052A3] transition-colors shadow-sm hover:shadow-md"
            >
              Commencer
            </Link>

            {/* Hamburger button (mobile) */}
            <button
              type="button"
              className="md:hidden p-2 -mr-2 text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && <MobileMenu onClose={() => setMobileMenuOpen(false)} />}
    </header>
  );
}
