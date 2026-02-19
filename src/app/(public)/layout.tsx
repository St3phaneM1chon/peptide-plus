'use client';

/**
 * LAYOUT PUBLIC - Utilise le même header que (shop)
 * Pour cohérence visuelle sur tout le site Peptide Plus+
 */

import { CartProvider } from '@/contexts/CartContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { Header, Footer, DisclaimerModal } from '@/components/shop';
import SkipToContent from '@/components/ui/SkipToContent';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CurrencyProvider>
      <CartProvider>
        <div className="min-h-screen flex flex-col bg-white">
          <SkipToContent />
          <Header />
          <main id="main-content" className="flex-1" tabIndex={-1}>{children}</main>
          <Footer />
          <DisclaimerModal />
        </div>
      </CartProvider>
    </CurrencyProvider>
  );
}
