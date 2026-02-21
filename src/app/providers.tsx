/**
 * PROVIDERS
 * Wrapper pour tous les providers de l'application
 */

'use client';

import { SessionProvider } from 'next-auth/react';
import { I18nProvider } from '@/i18n/client';
import { CartProvider } from '@/contexts/CartContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { LoyaltyProvider } from '@/contexts/LoyaltyContext';
import { WishlistProvider } from '@/contexts/WishlistContext';
import { type Locale, defaultLocale } from '@/i18n/config';
import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
  locale?: Locale;
  messages?: Record<string, unknown>;
}

export function Providers({ children, locale = defaultLocale, messages = {} }: ProvidersProps) {
  return (
    <SessionProvider>
      <I18nProvider locale={locale} messages={messages}>
        <CurrencyProvider>
          <LoyaltyProvider>
            <WishlistProvider>
              <CartProvider>
                {children}
              </CartProvider>
            </WishlistProvider>
          </LoyaltyProvider>
        </CurrencyProvider>
      </I18nProvider>
    </SessionProvider>
  );
}

export default Providers;
