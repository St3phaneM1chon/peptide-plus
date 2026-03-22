import Link from 'next/link';

/**
 * LAYOUT PLATFORM — Clean SaaS layout for Attitudes VIP / Koraline pages
 * No shop header/footer. Dedicated branding for the SaaS landing experience.
 * Used on attitudes.vip for: landing page, pricing, demo request
 */

function PlatformHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-[#0066CC] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:shadow-md transition-shadow">
              K
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-gray-900 tracking-tight">Kor@line</span>
              <span className="text-[11px] text-gray-400 font-medium">par Attitudes VIP</span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Fonctionnalites
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Tarifs
            </Link>
            <Link href="/demo" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Demo
            </Link>
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center px-4 py-2 bg-[#0066CC] text-white text-sm font-semibold rounded-full hover:bg-[#0052A3] transition-colors shadow-sm hover:shadow-md"
            >
              Commencer
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function PlatformFooter() {
  return (
    <footer className="bg-[#003366] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                K
              </div>
              <span className="text-lg font-bold">Kor@line</span>
            </div>
            <p className="text-sm text-blue-200 leading-relaxed mb-4">
              Suite Koraline par Attitudes VIP.
              Votre boutique en ligne, cle en main.
            </p>
            <p className="text-xs text-blue-300">
              Montreal, QC, Canada
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Produit</h3>
            <ul className="space-y-2.5">
              <li><Link href="/#features" className="text-sm text-blue-200 hover:text-white transition-colors">Fonctionnalites</Link></li>
              <li><Link href="/pricing" className="text-sm text-blue-200 hover:text-white transition-colors">Tarifs</Link></li>
              <li><Link href="/#modules" className="text-sm text-blue-200 hover:text-white transition-colors">Modules</Link></li>
              <li><Link href="/demo" className="text-sm text-blue-200 hover:text-white transition-colors">Demande de demo</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Entreprise</h3>
            <ul className="space-y-2.5">
              <li><Link href="/a-propos" className="text-sm text-blue-200 hover:text-white transition-colors">A propos</Link></li>
              <li><Link href="/contact" className="text-sm text-blue-200 hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/blog" className="text-sm text-blue-200 hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/carrieres" className="text-sm text-blue-200 hover:text-white transition-colors">Carrieres</Link></li>
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
            &copy; {new Date().getFullYear()} Attitudes VIP inc. Tous droits reserves.
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

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PlatformHeader />
      <main className="flex-1">{children}</main>
      <PlatformFooter />
    </div>
  );
}
