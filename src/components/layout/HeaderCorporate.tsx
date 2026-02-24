/**
 * HEADER CORPORATE
 * Navigation complète pour sites corporatifs
 * Avec mega-menu, recherche, et CTA
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/i18n/client';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { CartIcon } from '@/components/cart/CartDrawer';
import { mainNavigation, ctaNavigation, dashboardNavigation, type NavItem } from '@/config/navigation';

export function HeaderCorporate() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = status === 'authenticated';
  const userRole = session?.user?.role || 'CUSTOMER';

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [pathname]);

  const getNavLabel = (key: string) => {
    // Try nav.key first, then fallback to other sections
    const label = t(`nav.${key}`);
    if (label !== `nav.${key}`) return label;
    return t(`navigation.${key}`) || key;
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: isScrolled ? 'rgba(255,255,255,0.98)' : 'white',
        borderBottom: '1px solid var(--gray-200)',
        backdropFilter: isScrolled ? 'blur(8px)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Top bar (optionnel) */}
      <div
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          fontSize: '13px',
          padding: '8px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {process.env.NEXT_PUBLIC_PHONE && <span>📞 {process.env.NEXT_PUBLIC_PHONE}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/aide" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
            {t('footer.help')}
          </Link>
          <LanguageSelector variant="minimal" showFlag={true} showName={false} />
        </div>
      </div>

      {/* Main header */}
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '72px',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--gray-500)',
            textDecoration: 'none',
            letterSpacing: '-0.5px',
          }}
        >
          {process.env.NEXT_PUBLIC_SITE_NAME || 'FORMATIONS'}
        </Link>

        {/* Desktop Navigation */}
        <nav
          ref={dropdownRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          className="hidden lg:flex"
        >
          {mainNavigation.slice(1, 7).map((item) => (
            <NavItemComponent
              key={item.key}
              item={item}
              isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
              getLabel={getNavLabel}
            />
          ))}
        </nav>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Search */}
          <button
            style={{
              padding: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--gray-400)',
            }}
            aria-label={t('common.search')}
          >
            <SearchIcon />
          </button>

          {/* Cart */}
          <CartIcon />

          {/* Auth */}
          {isAuthenticated ? (
            <UserMenu session={session} userRole={userRole} t={t} />
          ) : (
            <Link
              href="/auth/signin"
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                color: 'var(--gray-500)',
                textDecoration: 'none',
              }}
            >
              {t('nav.login')}
            </Link>
          )}

          {/* CTA */}
          <Link
            href={ctaNavigation.href}
            className="btn btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {t('navigation.requestDemo')}
          </Link>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              padding: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            className="hidden max-lg:block"
            aria-label={t('nav.aria.menu')}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <MobileMenu
          navigation={mainNavigation}
          isAuthenticated={isAuthenticated}
          session={session}
          userRole={userRole}
          onClose={() => setMobileMenuOpen(false)}
          getLabel={getNavLabel}
          t={t}
        />
      )}

    </header>
  );
}

// Nav Item with dropdown
function NavItemComponent({
  item,
  isActive,
  activeDropdown,
  setActiveDropdown,
  getLabel,
}: {
  item: NavItem;
  isActive: boolean;
  activeDropdown: string | null;
  setActiveDropdown: (key: string | null) => void;
  getLabel: (key: string) => string;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isOpen = activeDropdown === item.key;

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => hasChildren && setActiveDropdown(item.key)}
      onMouseLeave={() => hasChildren && setActiveDropdown(null)}
    >
      <Link
        href={item.href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 14px',
          fontSize: '14px',
          fontWeight: isActive ? 600 : 500,
          color: isActive ? 'var(--gray-500)' : 'var(--gray-400)',
          textDecoration: 'none',
          borderRadius: '6px',
          transition: 'all 0.2s ease',
        }}
      >
        {getLabel(item.key)}
        {hasChildren && <ChevronIcon />}
      </Link>

      {/* Dropdown */}
      {hasChildren && isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            minWidth: '220px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            padding: '8px 0',
            zIndex: 1000,
          }}
        >
          {item.children!.map((child) => (
            <Link
              key={child.key}
              href={child.href}
              style={{
                display: 'block',
                padding: '10px 20px',
                fontSize: '14px',
                color: 'var(--gray-500)',
                textDecoration: 'none',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--gray-50)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {getLabel(child.key)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// User Menu
function UserMenu({ session, userRole, t }: { session: { user?: { name?: string | null; email?: string | null; image?: string | null } }; userRole: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  const [open, setOpen] = useState(false);
  const dashboardItems = dashboardNavigation[userRole] || dashboardNavigation.CUSTOMER;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--gray-100)',
          border: 'none',
          borderRadius: '20px',
          cursor: 'pointer',
        }}
      >
        {session.user?.image ? (
          <Image
            src={session.user.image}
            alt=""
            width={28}
            height={28}
            style={{ borderRadius: '50%' }}
            unoptimized
          />
        ) : (
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--gray-300)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 600,
              color: 'white',
            }}
          >
            {session.user?.name?.[0] || session.user?.email?.[0] || '?'}
          </div>
        )}
        <ChevronIcon />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '200px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            padding: '8px 0',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)' }}>
              {session.user?.name || 'Utilisateur'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{session.user?.email}</p>
          </div>
          {dashboardItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              style={{
                display: 'block',
                padding: '10px 16px',
                fontSize: '14px',
                color: 'var(--gray-500)',
                textDecoration: 'none',
              }}
              onClick={() => setOpen(false)}
            >
              {t(`dashboard.${item.key}`) || t(`navigation.${item.key}`) || item.key}
            </Link>
          ))}
          <div style={{ borderTop: '1px solid var(--gray-100)', marginTop: '4px', paddingTop: '4px' }}>
            <button
              onClick={() => signOut()}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                fontSize: '14px',
                color: 'var(--gray-400)',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mobile Menu
function MobileMenu({
  navigation,
  isAuthenticated,
  session,
  userRole: _userRole,
  onClose,
  getLabel,
  t,
}: {
  navigation: NavItem[];
  isAuthenticated: boolean;
  session: { user?: { name?: string | null; email?: string | null; image?: string | null; role?: string } } | null;
  userRole: string;
  onClose: () => void;
  getLabel: (key: string) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        zIndex: 9999,
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '20px', fontWeight: 700 }}>Menu</span>
        <button onClick={onClose} aria-label={t('nav.closeMenu')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <CloseIcon />
        </button>
      </div>

      <nav style={{ padding: '16px 0' }}>
        {navigation.map((item) => (
          <div key={item.key}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
              }}
            >
              <Link
                href={item.href}
                onClick={onClose}
                style={{ fontSize: '16px', color: 'var(--gray-500)', textDecoration: 'none', fontWeight: 500 }}
              >
                {getLabel(item.key)}
              </Link>
              {item.children && (
                <button
                  onClick={() => toggleExpand(item.key)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <ChevronIcon style={{ transform: expandedItems.includes(item.key) ? 'rotate(180deg)' : 'none' }} />
                </button>
              )}
            </div>
            {item.children && expandedItems.includes(item.key) && (
              <div style={{ backgroundColor: 'var(--gray-50)', padding: '8px 0' }}>
                {item.children.map((child) => (
                  <Link
                    key={child.key}
                    href={child.href}
                    onClick={onClose}
                    style={{
                      display: 'block',
                      padding: '12px 40px',
                      fontSize: '14px',
                      color: 'var(--gray-400)',
                      textDecoration: 'none',
                    }}
                  >
                    {getLabel(child.key)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div style={{ padding: '24px', borderTop: '1px solid var(--gray-200)' }}>
        {isAuthenticated ? (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '12px' }}>
              Connecté en tant que {session?.user?.email}
            </p>
            <Link href="/dashboard" className="btn btn-secondary" style={{ display: 'block', textAlign: 'center', marginBottom: '12px' }} onClick={onClose}>
              {t('nav.dashboard')}
            </Link>
            <button onClick={() => signOut()} className="btn" style={{ width: '100%', color: 'var(--gray-400)' }}>
              {t('nav.logout')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link href="/auth/signin" className="btn btn-secondary" style={{ textAlign: 'center' }} onClick={onClose}>
              {t('nav.login')}
            </Link>
            <Link href="/demo" className="btn btn-primary" style={{ textAlign: 'center' }} onClick={onClose}>
              {t('navigation.requestDemo')}
            </Link>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-200)' }}>
        <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: '12px' }}>{t('nav.language')}</p>
        <LanguageSelector variant="list" />
      </div>
    </div>
  );
}

// Icons
function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="24" height="24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="24" height="24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="14" height="14" style={{ transition: 'transform 0.2s ease', ...style }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export default HeaderCorporate;
