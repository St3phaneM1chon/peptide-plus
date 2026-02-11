'use client';

import { SessionProvider } from 'next-auth/react';
import { CartProvider } from '@/contexts/CartContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { LoyaltyProvider } from '@/contexts/LoyaltyContext';
import { Header, Footer, DisclaimerModal, NewsletterPopup, CookieConsent } from '@/components/shop';
import FreeShippingBanner from '@/components/shop/FreeShippingBanner';
import ChatWidget from '@/components/chat/ChatWidget';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <CurrencyProvider>
        <CartProvider>
          <LoyaltyProvider>
            <div className="min-h-screen flex flex-col bg-white">
              <FreeShippingBanner />
              <Header />
              <main className="flex-1 relative z-0">{children}</main>
              <Footer />
              <DisclaimerModal />
              <NewsletterPopup />
              <CookieConsent />
              <ChatWidget />
            </div>
          </LoyaltyProvider>
        </CartProvider>
      </CurrencyProvider>
    </SessionProvider>
  );
}
