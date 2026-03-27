/**
 * LAYOUT PUBLIC - Utilise le même header que (shop)
 * Pour cohérence visuelle sur tout le site Peptide Plus+
 * Note: CurrencyProvider and CartProvider are already in the root providers.tsx,
 * so we do NOT re-wrap here (that would cause duplicate API calls).
 */

import Header from '@/components/shop/Header';
import Footer from '@/components/shop/Footer';
import DisclaimerModal from '@/components/shop/DisclaimerModal';
import SkipToContent from '@/components/ui/SkipToContent';
import { TenantBrandingProvider } from '@/components/shop/TenantBrandingProvider';
import { getTenantBranding } from '@/lib/tenant-branding';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getTenantBranding();

  return (
    <TenantBrandingProvider branding={branding}>
      <div className="min-h-screen flex flex-col bg-white">
        <SkipToContent />
        <Header />
        <main id="main-content" className="flex-1" tabIndex={-1}>{children}</main>
        <Footer />
        <DisclaimerModal />
      </div>
    </TenantBrandingProvider>
  );
}
