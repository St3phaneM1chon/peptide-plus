'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/i18n/client';
import { locales, localeNames, localeFlags } from '@/i18n/config';
import CartDrawer from './CartDrawer';
import SearchModal from './SearchModal';


// Build languages array from config (all 22 languages)
const LANGUAGES = locales.map(code => ({
  code,
  name: localeNames[code],
  flag: localeFlags[code],
}));


export default function Header() {
  const { itemCount } = useCart();
  const { t, locale } = useI18n();
  const { currency, currencies, setCurrency } = useCurrency();
  const { data: session, status } = useSession();
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const pathname = usePathname();


  // Close dropdowns on route change
  useEffect(() => {
    setOpenDropdown(null);
    setIsMobileMenuOpen(false);

  }, [pathname]);

  // Close dropdowns on ESC key or scroll (throttled with rAF)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
      }
    };
    let scrollTicking = false;
    const handleScroll = () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(() => {
          setOpenDropdown(null);
          scrollTicking = false;
        });
      }
    };
    document.addEventListener('keydown', handleEsc);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLanguageChange = (code: string) => {
    setOpenDropdown(null);
    setIsMobileMenuOpen(false);

    // Save to localStorage
    localStorage.setItem('locale', code);

    // Set cookie (1 year, works on both HTTP and HTTPS)
    const isSecure = window.location.protocol === 'https:';
    const cookieOptions = [
      `locale=${code}`,
      'path=/',
      'max-age=31536000',
      'SameSite=Lax',
    ];
    if (isSecure) cookieOptions.push('Secure');
    document.cookie = cookieOptions.join(';');

    // Save to DB if user is authenticated
    if (session?.user) {
      fetch('/api/user/locale', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: code }),
      }).catch(() => {});
    }

    // Reload to apply new locale
    window.location.assign(window.location.href);
  };

  const handleSignOut = async () => {
    setOpenDropdown(null);
    await signOut({ callbackUrl: '/' });
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const currentLanguage = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  return (
    <>
      <header className="bg-black text-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo - Compact */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">BC</span>
              </div>
              <span className="font-bold text-lg hidden sm:block">BioCycle</span>
            </Link>

            {/* Desktop Navigation - Simplified */}
            <nav aria-label={t('nav.aria.mainNavigation')} className="hidden lg:flex items-center gap-1">
              <NavLink href="/">{t('nav.home') || 'Home'}</NavLink>

              <NavLink href="/shop">{t('nav.shop') || 'Shop'}</NavLink>

              <NavLink href="/calculator">{t('nav.calculator') || 'Calculator'}</NavLink>

              {/* Resources Dropdown */}
              <div className="relative" data-dropdown="resources">
                <button
                  onClick={() => toggleDropdown('resources')}
                  aria-expanded={openDropdown === 'resources'}
                  aria-haspopup="menu"
                  aria-label={t('nav.aria.resourcesMenu')}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                    openDropdown === 'resources'
                      ? 'text-orange-400 bg-white/10'
                      : 'text-gray-100 hover:text-orange-400 hover:bg-white/10'
                  }`}
                >
                  {t('nav.resources') || 'Resources'}
                  <ChevronIcon isOpen={openDropdown === 'resources'} />
                </button>
                {openDropdown === 'resources' && (
                  <DropdownMenu>
                    <DropdownItem href="/lab-results">
                      🔬 {t('nav.labResults') || 'Lab Results'}
                    </DropdownItem>
                    <DropdownItem href="/calculator">
                      🧮 {t('nav.injectionCalculator') || 'Injection Calculator'}
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem href="/learn">
                      📚 {t('nav.articles') || 'Articles'}
                    </DropdownItem>
                    <DropdownItem href="/videos">
                      🎬 {t('nav.videos') || 'Videos'}
                    </DropdownItem>
                    <DropdownItem href="/faq">
                      ❓ {t('nav.faq') || 'FAQ'}
                    </DropdownItem>
                    <DropdownDivider />
                    <DropdownItem href="/rewards" highlight>
                      🎁 {t('nav.rewards') || 'Rewards'}
                    </DropdownItem>
                  </DropdownMenu>
                )}
              </div>

              <NavLink href="/contact">{t('nav.contact') || 'Contact'}</NavLink>
            </nav>

            {/* Right Actions - Compact */}
            <div className="flex items-center gap-1">
              
              {/* Search */}
              <IconButton onClick={() => setIsSearchOpen(true)} label="Search">
                <SearchIcon />
              </IconButton>

              {/* Currency - Desktop only */}
              <div className="relative hidden md:block" data-dropdown="currency">
                <button
                  onClick={() => toggleDropdown('currency')}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium hover:bg-white/10 rounded transition-colors"
                >
                  {currency.code}
                  <ChevronIcon isOpen={openDropdown === 'currency'} small />
                </button>
                {openDropdown === 'currency' && (
                  <div className="currency-dropdown absolute top-full end-0 mt-2 w-32 bg-white text-black rounded-lg shadow-xl overflow-hidden z-50">
                    {currencies.map((curr) => (
                      <button
                        key={curr.code}
                        onClick={() => { setCurrency(curr); setOpenDropdown(null); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 ${
                          currency.code === curr.code ? 'bg-orange-50 text-orange-600' : ''
                        }`}
                      >
                        <span>{curr.symbol}</span>
                        <span>{curr.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Language */}
              <div className="relative" data-dropdown="lang">
                <button
                  onClick={() => toggleDropdown('lang')}
                  aria-expanded={openDropdown === 'lang'}
                  aria-haspopup="listbox"
                  aria-label={t('nav.aria.languageSelector')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                    openDropdown === 'lang'
                      ? 'text-orange-400 bg-white/10'
                      : 'text-gray-200 hover:text-orange-400 hover:bg-white/10'
                  }`}
                >
                  <span className="text-base">{currentLanguage.flag}</span>
                  <span className="hidden sm:inline">{currentLanguage.code.toUpperCase()}</span>
                  <ChevronIcon isOpen={openDropdown === 'lang'} small />
                </button>
                {openDropdown === 'lang' && (
                  <div className="language-dropdown absolute top-full end-0 mt-2 w-48 bg-white text-black rounded-lg shadow-xl overflow-hidden z-50">
                    <div role="listbox" aria-label={t('nav.aria.languageSelector')} className="max-h-80 overflow-y-auto">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => handleLanguageChange(lang.code)}
                          role="option"
                          aria-selected={locale === lang.code}
                          aria-label={t('nav.aria.selectLanguage', { language: lang.name })}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                            locale === lang.code ? 'bg-orange-50 text-orange-600 font-medium' : ''
                          }`}
                        >
                          <span className="text-base">{lang.flag}</span>
                          <span className="truncate">{lang.name}</span>
                          {locale === lang.code && (
                            <svg className="w-4 h-4 ms-auto text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="relative" data-dropdown="profile">
                {status === 'authenticated' && session?.user ? (
                  <>
                    <button
                      onClick={() => toggleDropdown('profile')}
                      aria-label={t('nav.aria.accountMenu')}
                      aria-expanded={openDropdown === 'profile'}
                      aria-haspopup="true"
                      className={`flex items-center p-1.5 min-w-[44px] min-h-[44px] justify-center rounded-lg transition-all ${
                        openDropdown === 'profile' ? 'bg-white/10' : 'hover:bg-white/10'
                      }`}
                    >
                      {session.user.image ? (
                        <Image src={session.user.image} alt={session.user.name || 'User profile'} width={28} height={28} className="w-7 h-7 rounded-full border-2 border-orange-500" unoptimized />
                      ) : (
                        <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {(session.user.name || session.user.email || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </button>
                    {openDropdown === 'profile' && (
                      <div role="menu" className="absolute top-full end-0 mt-2 w-52 bg-white text-black rounded-lg shadow-xl overflow-hidden z-50">
                        <div className="px-4 py-3 bg-gray-50 border-b">
                          <p className="font-medium text-sm truncate">{session.user.name || 'User'}</p>
                          <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                        </div>
                        <div className="py-1">
                          {session.user.role === 'OWNER' && (
                            <DropdownItem href="/admin" icon="⚙️" highlight>
                              {t('nav.adminPanel')}
                            </DropdownItem>
                          )}
                          {session.user.role === 'EMPLOYEE' && (
                            <DropdownItem href="/dashboard/employee" icon="⚙️" highlight>
                              {t('nav.adminPanel')}
                            </DropdownItem>
                          )}
                          <DropdownItem href="/account" icon="🏠">
                            {t('account.dashboard') || 'Dashboard'}
                          </DropdownItem>
                          <DropdownItem href="/account/orders" icon="📦">
                            {t('account.orders') || 'Orders'}
                          </DropdownItem>
                          <DropdownItem href="/account/inventory" icon="🔬">
                            {t('account.inventory') || 'Inventory'}
                          </DropdownItem>
                          <DropdownItem href="/account/profile" icon="👤">
                            {t('account.profile') || 'Profile'}
                          </DropdownItem>
                          <DropdownItem href="/account/referrals" icon="🎁">
                            {t('customerRewards.referral') || 'Refer Friends'}
                          </DropdownItem>
                        </div>
                        <div className="border-t py-1">
                          <button
                            onClick={handleSignOut}
                            role="menuitem"
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <span>🚪</span>
                            {t('account.signOut') || 'Sign Out'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <Link href="/auth/signin" aria-label={t('nav.aria.signIn')} className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded transition-colors">
                    <UserIcon />
                  </Link>
                )}
              </div>

              {/* Cart */}
              <button
                onClick={() => setIsCartOpen(true)}
                aria-label={itemCount > 0 ? t('nav.aria.cartItems', { count: itemCount }) : t('nav.aria.cartEmpty')}
                className="relative p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded transition-colors"
              >
                <CartIcon />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" aria-hidden="true">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? t('nav.aria.closeMenu') : t('nav.aria.openMenu')}
                aria-expanded={isMobileMenuOpen}
                className="lg:hidden p-2 text-gray-200 hover:text-orange-400 hover:bg-white/10 rounded-lg transition-all"
              >
                {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-white/10 animate-slide-down" style={{ animation: 'slideDown 0.2s ease-out' }}>
              <nav aria-label={t('nav.aria.mobileNavigation')} className="flex flex-col gap-1">
                <MobileNavLink href="/" onClick={() => setIsMobileMenuOpen(false)}>
                  {t('nav.home') || 'Home'}
                </MobileNavLink>
                <MobileNavLink href="/shop" onClick={() => setIsMobileMenuOpen(false)}>
                  {t('nav.shop') || 'Shop'}
                </MobileNavLink>

                <MobileNavLink href="/calculator" onClick={() => setIsMobileMenuOpen(false)}>
                  🧮 {t('nav.calculator') || 'Calculator'}
                </MobileNavLink>
                <MobileNavLink href="/lab-results" onClick={() => setIsMobileMenuOpen(false)}>
                  🔬 {t('nav.labResults') || 'Lab Results'}
                </MobileNavLink>
                <MobileNavLink href="/learn" onClick={() => setIsMobileMenuOpen(false)}>
                  📚 {t('nav.articles') || 'Articles'}
                </MobileNavLink>
                <MobileNavLink href="/faq" onClick={() => setIsMobileMenuOpen(false)}>
                  ❓ {t('nav.faq') || 'FAQ'}
                </MobileNavLink>
                <MobileNavLink href="/rewards" onClick={() => setIsMobileMenuOpen(false)}>
                  🎁 {t('nav.rewards') || 'Rewards'}
                </MobileNavLink>
                <MobileNavLink href="/contact" onClick={() => setIsMobileMenuOpen(false)}>
                  {t('nav.contact') || 'Contact'}
                </MobileNavLink>
                
                {/* Mobile Currency Selector */}
                <div className="border-t border-white/10 pt-3 mt-2 mb-2">
                  <p className="text-xs text-gray-400 px-3 mb-1">{t('nav.currency') || 'Currency'}</p>
                  <div className="flex flex-wrap gap-1 px-3">
                    {currencies.map((curr) => (
                      <button
                        key={curr.code}
                        onClick={() => { setCurrency(curr); setIsMobileMenuOpen(false); }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          currency.code === curr.code
                            ? 'bg-orange-500 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        {curr.symbol} {curr.code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Language Selector */}
                <div className="border-t border-white/10 pt-3 mt-2 mb-2">
                  <p className="text-xs text-gray-400 px-3 mb-1">{t('nav.language') || 'Language'}</p>
                  <div className="max-h-48 overflow-y-auto px-1">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          locale === lang.code
                            ? 'bg-orange-500/20 text-orange-400 font-medium'
                            : 'text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-base">{lang.flag}</span>
                        <span className="truncate">{lang.name}</span>
                        {locale === lang.code && (
                          <svg className="w-4 h-4 ms-auto text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Account */}
                <div className="border-t border-white/10 pt-3 mt-2">
                  {status === 'authenticated' && session?.user ? (
                    <>
                      <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-lg mb-2">
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-white text-sm font-bold">
                            {(session.user.name || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{session.user.name || 'User'}</p>
                          <p className="text-xs text-gray-400 truncate">{session.user.email}</p>
                        </div>
                      </div>
                      {(session.user.role === 'OWNER' || session.user.role === 'EMPLOYEE') && (
                        <MobileNavLink href={session.user.role === 'OWNER' ? '/admin' : '/dashboard/employee'} onClick={() => setIsMobileMenuOpen(false)}>
                          ⚙️ {t('nav.adminPanel')}
                        </MobileNavLink>
                      )}
                      <MobileNavLink href="/account" onClick={() => setIsMobileMenuOpen(false)}>
                        🏠 {t('account.dashboard') || 'Dashboard'}
                      </MobileNavLink>
                      <MobileNavLink href="/account/orders" onClick={() => setIsMobileMenuOpen(false)}>
                        📦 {t('account.orders') || 'My Orders'}
                      </MobileNavLink>
                      <MobileNavLink href="/account/inventory" onClick={() => setIsMobileMenuOpen(false)}>
                        🔬 {t('account.inventory') || 'My Inventory'}
                      </MobileNavLink>
                      <MobileNavLink href="/account/referrals" onClick={() => setIsMobileMenuOpen(false)}>
                        🎁 {t('customerRewards.referral') || 'Refer Friends'}
                      </MobileNavLink>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-start px-3 py-2 text-red-400 hover:bg-white/5 rounded text-sm"
                      >
                        🚪 {t('account.signOut') || 'Sign Out'}
                      </button>
                    </>
                  ) : (
                    <MobileNavLink href="/auth/signin" onClick={() => setIsMobileMenuOpen(false)}>
                      👤 {t('account.signIn') || 'Sign In'}
                    </MobileNavLink>
                  )}
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <SearchModal open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
        isActive
          ? 'text-orange-400 bg-white/10 underline underline-offset-4'
          : 'text-gray-100 hover:text-orange-400 hover:bg-white/10'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  children,
  onClick,
  indent
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  indent?: boolean;
}) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`block w-full text-start px-3 py-2 hover:bg-white/5 rounded text-sm ${
        indent ? 'ps-6 text-gray-400' : ''
      } ${
        isActive ? 'text-orange-400 font-semibold bg-white/10' : ''
      }`}
    >
      {children}
    </Link>
  );
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  return (
    <div role="menu" className="absolute top-full start-0 mt-1 w-48 bg-white text-black rounded-lg shadow-xl overflow-hidden z-50">
      {children}
    </div>
  );
}

function DropdownItem({
  href,
  children,
  icon,
  highlight
}: {
  href: string;
  children: React.ReactNode;
  icon?: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-start hover:bg-gray-100 transition-colors cursor-pointer ${
        highlight ? 'text-orange-600 font-medium' : ''
      }`}
    >
      {icon && <span>{icon}</span>}
      {children}
    </Link>
  );
}

function DropdownDivider() {
  return <div className="border-t border-gray-100 my-1" />;
}

function IconButton({
  onClick,
  children,
  label
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-200 hover:text-orange-400 hover:bg-white/10 rounded-lg transition-all"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function ChevronIcon({ isOpen, small }: { isOpen: boolean; small?: boolean }) {
  return (
    <svg 
      className={`${small ? 'w-3 h-3' : 'w-4 h-4'} transition-transform ${isOpen ? 'rotate-180' : ''}`} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
