'use client';

import { SessionProvider } from 'next-auth/react';
import { CartProvider } from '@/contexts/CartContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { LoyaltyProvider } from '@/contexts/LoyaltyContext';
import { UpsellProvider } from '@/contexts/UpsellContext';
import { Header, Footer, DisclaimerModal, NewsletterPopup, CookieConsent } from '@/components/shop';
import FreeShippingBanner from '@/components/shop/FreeShippingBanner';
import ChatWidget from '@/components/chat/ChatWidget';
import BackToTop from '@/components/ui/BackToTop';
import CompareBar from '@/components/shop/CompareBar';
import InstallPWA from '@/components/ui/InstallPWA';
import TextToSpeechButton from '@/components/shop/TextToSpeechButton';
import { Toaster } from 'sonner';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <CurrencyProvider>
        <CartProvider>
          <UpsellProvider>
            <LoyaltyProvider>
            <div className="min-h-screen flex flex-col bg-white">
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-lg focus:font-semibold focus:text-sm"
              >
                Skip to content
              </a>
              <FreeShippingBanner />
              <Header />
              <main id="main-content" className="flex-1 relative z-0" tabIndex={-1}>{children}</main>
              <Footer />
              <DisclaimerModal />
              <NewsletterPopup />
              <CookieConsent />
              <ChatWidget />
              <TextToSpeechButton />
              <BackToTop />
              <CompareBar />
              <InstallPWA />
              <Toaster position="bottom-right" richColors closeButton />
            </div>
            </LoyaltyProvider>
          </UpsellProvider>
        </CartProvider>
      </CurrencyProvider>
    </SessionProvider>
  );
}
