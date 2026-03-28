import Header from '@/components/shop/Header';
import Footer from '@/components/shop/Footer';
import FreeShippingBanner from '@/components/shop/FreeShippingBanner';
import PwaInstallPrompt from '@/components/shop/PwaInstallPrompt';
import SkipToContent from '@/components/ui/SkipToContent';
import ShopClientProviders from './ShopClientProviders';
import { TenantBrandingProvider } from '@/components/shop/TenantBrandingProvider';
import { getTenantBranding } from '@/lib/tenant-branding';
import { headers } from 'next/headers';
import { prisma, setCurrentTenantId } from '@/lib/db';

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inject tenant context into Prisma so all queries are scoped to the correct tenant
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug');
  if (tenantSlug) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true },
      });
      if (tenant) {
        setCurrentTenantId(tenant.id);
      }
    } catch { /* tenant lookup failed — continue without scoping */ }
  }

  const branding = await getTenantBranding();

  return (
    <TenantBrandingProvider branding={branding}>
      <ShopClientProviders>
        <div className="min-h-screen flex flex-col bg-[var(--k-bg-base,#ffffff)]">
          <SkipToContent />
          <FreeShippingBanner />
          <Header />
          <main id="main-content" className="flex-1 relative z-0" tabIndex={-1}>{children}</main>
          <Footer />
          <PwaInstallPrompt />
        </div>
      </ShopClientProviders>
    </TenantBrandingProvider>
  );
}
