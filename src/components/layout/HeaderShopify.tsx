/**
 * HEADER - Style Shopify Ton sur Ton
 * Navigation minimaliste avec panier et sélecteur de langue
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { CartIcon } from '@/components/cart/CartDrawer';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { useTranslation } from '@/i18n/client';

export function HeaderShopify() {
  const { status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  const isAuthenticated = status === 'authenticated';

  return (
    <header className="header">
      <div className="header__inner">
        {/* Logo */}
        <Link href="/" className="header__logo">
          FORMATIONS
        </Link>

        {/* Navigation Desktop */}
        <nav className="header__nav hidden md:flex">
          <Link href="/catalogue">{t('nav.catalog')}</Link>
          <Link href="/catalogue/securite">{t('nav.security')}</Link>
          <Link href="/catalogue/formation">{t('nav.courses')}</Link>
          <Link href="/contact">{t('nav.contact')}</Link>
        </nav>

        {/* Actions */}
        <div className="header__actions">
          {/* Language Selector */}
          <LanguageSelector variant="dropdown" showFlag={true} showName={false} />

          {/* Search */}
          <button className="header__icon" aria-label={t('common.search')}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </button>

          {/* Account */}
          {isAuthenticated ? (
            <Link href="/dashboard" className="header__icon" aria-label={t('nav.myAccount')}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
            </Link>
          ) : (
            <Link href="/auth/signin" className="header__icon" aria-label={t('nav.login')}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
            </Link>
          )}

          {/* Cart */}
          <CartIcon />

          {/* Mobile Menu Toggle */}
          <button
            className="header__icon md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={t('nav.aria.menu')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 animate-fade-in">
          <nav className="flex flex-col py-4 px-6 space-y-4">
            <Link
              href="/catalogue"
              className="text-gray-500 hover:text-gray-900 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.catalog')}
            </Link>
            <Link
              href="/catalogue/securite"
              className="text-gray-500 hover:text-gray-900 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.security')}
            </Link>
            <Link
              href="/catalogue/formation"
              className="text-gray-500 hover:text-gray-900 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.courses')}
            </Link>
            <Link
              href="/contact"
              className="text-gray-500 hover:text-gray-900 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.contact')}
            </Link>
            <hr className="border-gray-200" />
            
            {/* Language selector mobile */}
            <div className="py-2">
              <p className="text-sm text-gray-400 mb-2">{t('nav.language')}</p>
              <LanguageSelector variant="list" />
            </div>
            
            <hr className="border-gray-200" />
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-500 hover:text-gray-900 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.myAccount')}
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-start text-gray-500 hover:text-gray-900 font-medium"
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="text-gray-500 hover:text-gray-900 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.login')}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export default HeaderShopify;
