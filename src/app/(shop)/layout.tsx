import Header from '@/components/shop/Header';
import Footer from '@/components/shop/Footer';
import FreeShippingBanner from '@/components/shop/FreeShippingBanner';
import SkipToContent from '@/components/ui/SkipToContent';
import ShopClientProviders from './ShopClientProviders';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShopClientProviders>
      <div className="min-h-screen flex flex-col bg-white">
        <SkipToContent />
        <FreeShippingBanner />
        <Header />
        <main id="main-content" className="flex-1 relative z-0" tabIndex={-1}>{children}</main>
        <Footer />
      </div>
    </ShopClientProviders>
  );
}
