import Link from 'next/link';
import Image from 'next/image';
import { getTenantBranding } from '@/lib/tenant-branding';
import { PlatformHeaderClient } from './PlatformHeaderClient';
import PlatformClientProviders from './PlatformClientProviders';

/**
 * LAYOUT PLATFORM — Clean SaaS layout for Koraline landing pages
 * No shop header/footer. Dedicated branding for the SaaS landing experience.
 * Used on attitudes.vip for: landing page, pricing, demo request
 *
 * Company identity (name, logo, location) is loaded from the tenant branding
 * so each tenant sees their own company behind the Koraline product.
 * Product name "Kor@line" / "Suite Koraline" stays constant.
 */

export interface CompanyBranding {
  companyName: string;
  logoUrl: string | null;
  city: string;
  province: string;
  country: string;
  legalName: string;
}

function PlatformFooter({ company }: { company: CompanyBranding }) {
  const location = [company.city, company.province, company.country].filter(Boolean).join(', ');

  return (
    <footer className="bg-[#003366] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              {company.logoUrl ? (
                <Image
                  src={company.logoUrl}
                  alt={company.companyName}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-lg object-contain"
                />
              ) : (
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  K
                </div>
              )}
              <span className="text-lg font-bold">Kor@line</span>
            </div>
            <p className="text-sm text-blue-200 leading-relaxed mb-4">
              Suite Koraline par {company.companyName}.
              Votre boutique en ligne, cle en main.
            </p>
            {location && (
              <p className="text-xs text-blue-300 mb-4">
                {location}
              </p>
            )}
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
              >
                <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="X (Twitter)"
              >
                <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Fonctionnalites */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Fonctionnalites</h3>
            <ul className="space-y-2.5">
              <li><Link href="/platform/features" className="text-sm text-blue-200 hover:text-white transition-colors">Vue d&apos;ensemble</Link></li>
              <li><Link href="/platform/features/commerce" className="text-sm text-blue-200 hover:text-white transition-colors">Commerce</Link></li>
              <li><Link href="/platform/features/crm" className="text-sm text-blue-200 hover:text-white transition-colors">CRM</Link></li>
              <li><Link href="/platform/features/comptabilite" className="text-sm text-blue-200 hover:text-white transition-colors">Comptabilite</Link></li>
              <li><Link href="/platform/features/formation" className="text-sm text-blue-200 hover:text-white transition-colors">Formation (LMS)</Link></li>
              <li><Link href="/pricing" className="text-sm text-blue-200 hover:text-white transition-colors">Tarifs</Link></li>
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Solutions</h3>
            <ul className="space-y-2.5">
              <li><Link href="/platform/pour/ecommerce" className="text-sm text-blue-200 hover:text-white transition-colors">Pour le e-commerce</Link></li>
              <li><Link href="/platform/pour/services" className="text-sm text-blue-200 hover:text-white transition-colors">Pour les services</Link></li>
              <li><Link href="/platform/pour/coaching" className="text-sm text-blue-200 hover:text-white transition-colors">Pour le coaching</Link></li>
              <li><Link href="/platform/calculateur-roi" className="text-sm text-blue-200 hover:text-white transition-colors">Calculateur ROI</Link></li>
              <li><Link href="/platform/comparer" className="text-sm text-blue-200 hover:text-white transition-colors">Comparaison</Link></li>
            </ul>
          </div>

          {/* Entreprise */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Entreprise</h3>
            <ul className="space-y-2.5">
              <li><Link href="/a-propos" className="text-sm text-blue-200 hover:text-white transition-colors">A propos</Link></li>
              <li><Link href="/a-propos/mission" className="text-sm text-blue-200 hover:text-white transition-colors">Mission</Link></li>
              <li><Link href="/a-propos/equipe" className="text-sm text-blue-200 hover:text-white transition-colors">Equipe</Link></li>
              <li><Link href="/carrieres" className="text-sm text-blue-200 hover:text-white transition-colors">Carrieres</Link></li>
              <li><Link href="/contact" className="text-sm text-blue-200 hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/blog" className="text-sm text-blue-200 hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2.5">
              <li><Link href="/privacy" className="text-sm text-blue-200 hover:text-white transition-colors">Confidentialite</Link></li>
              <li><Link href="/terms" className="text-sm text-blue-200 hover:text-white transition-colors">Conditions</Link></li>
              <li><Link href="/securite" className="text-sm text-blue-200 hover:text-white transition-colors">Securite</Link></li>
              <li><Link href="/accessibilite" className="text-sm text-blue-200 hover:text-white transition-colors">Accessibilite</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-blue-300">
            &copy; {new Date().getFullYear()} {company.legalName || `${company.companyName} inc.`} Tous droits reserves.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs text-blue-300">Fait au Quebec</span>
            <span className="text-xs text-blue-300">22 langues</span>
            <span className="text-xs text-blue-300">Support bilingue FR/EN</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getTenantBranding();

  const company: CompanyBranding = {
    companyName: branding.name || 'Attitudes VIP',
    logoUrl: branding.logoUrl,
    city: branding.city || 'Montreal',
    province: branding.province || 'QC',
    country: branding.country || 'Canada',
    legalName: branding.legalName || '',
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PlatformHeaderClient company={company} />
      <PlatformClientProviders>
        <main className="flex-1">{children}</main>
      </PlatformClientProviders>
      <PlatformFooter company={company} />
    </div>
  );
}
