/**
 * PROVIDERS
 * Wrapper pour tous les providers de l'application
 */

'use client';

import { SessionProvider } from 'next-auth/react';
import { I18nProvider } from '@/i18n/client';
import { CartProvider } from '@/components/cart/CartDrawer';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { LoyaltyProvider } from '@/contexts/LoyaltyContext';
import { type Locale, defaultLocale } from '@/i18n/config';
import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
  locale?: Locale;
  messages?: Record<string, any>;
}

export function Providers({ children, locale = defaultLocale, messages = {} }: ProvidersProps) {
  return (
    <SessionProvider>
      <I18nProvider locale={locale} messages={messages}>
        <CurrencyProvider>
          <LoyaltyProvider>
            <CartProvider>
              {children}
            </CartProvider>
          </LoyaltyProvider>
        </CurrencyProvider>
      </I18nProvider>
    </SessionProvider>
  );
}

export default Providers;
