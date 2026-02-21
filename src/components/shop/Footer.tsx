// TODO: Consider extracting non-interactive sections (links, disclaimers, trust badges)
// into a separate server component to reduce client-side JavaScript bundle size.
// Only the newsletter form requires client-side interactivity ('use client').
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function Footer() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [newsletterMessage, setNewsletterMessage] = useState('');

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setNewsletterStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      
      if (data.success) {
        setNewsletterStatus('success');
        setNewsletterMessage(data.message || t('footer.newsletterSuccess'));
        setEmail('');
      } else {
        setNewsletterStatus('error');
        setNewsletterMessage(data.error || t('common.genericError'));
      }
    } catch {
      setNewsletterStatus('error');
      setNewsletterMessage(t('common.connectionError'));
    }

    // Reset après 5 secondes
    setTimeout(() => {
      setNewsletterStatus('idle');
      setNewsletterMessage('');
    }, 5000);
  };

  return (
    <footer className="bg-black text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {/* Logo & Info */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">BC</span>
              </div>
              <span className="font-bold text-xl">BioCycle Peptides</span>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed mb-4">
              {t('footer.description') || 'Canada\'s trusted source for high-purity research peptides. 99%+ purity guaranteed with third-party lab testing.'}
            </p>
            <p className="text-neutral-500 text-sm mb-2">
              📧 <a href="mailto:info@biocyclepeptides.com" className="text-orange-400 hover:underline">info@biocyclepeptides.com</a>
            </p>
            <p className="text-neutral-500 text-sm">
              📍 Montreal, Quebec, Canada
            </p>
            
            {/* Trust Badges */}
            <div className="flex items-center gap-4 mt-4 text-xs text-neutral-500">
              <span>✓ 99%+ Purity</span>
              <span>✓ Lab Tested</span>
              <span>✓ Made in Canada</span>
            </div>
          </div>

          {/* Shop */}
          <nav aria-label={t('footer.aria.shopLinks')}>
            <h3 className="font-bold mb-4">{t('footer.shop') || 'Shop'}</h3>
            <ul className="space-y-2 text-neutral-400 text-sm">
              <li>
                <Link href="/shop" className="hover:text-white transition-colors">{t('nav.allProducts') || 'All Products'}</Link>
              </li>
              <li>
                <Link href="/category/recovery-repair" className="hover:text-white transition-colors">{t('nav.recovery') || 'Recovery & Repair'}</Link>
              </li>
              <li>
                <Link href="/category/weight-loss" className="hover:text-white transition-colors">{t('nav.weightLoss') || 'Weight Loss'}</Link>
              </li>
              <li>
                <Link href="/category/anti-aging-longevity" className="hover:text-white transition-colors">{t('nav.antiAging') || 'Anti-Aging'}</Link>
              </li>
              <li>
                <Link href="/category/supplements" className="hover:text-white transition-colors">{t('nav.supplements') || 'Supplements'}</Link>
              </li>
              <li>
                <Link href="/category/accessories" className="hover:text-white transition-colors">{t('nav.accessories') || 'Accessories'}</Link>
              </li>
            </ul>
          </nav>

          {/* Resources */}
          <nav aria-label={t('footer.aria.resourcesLinks')}>
            <h3 className="font-bold mb-4">{t('footer.resources') || 'Resources'}</h3>
            <ul className="space-y-2 text-neutral-400 text-sm">
              <li>
                <Link href="/learn" className="hover:text-white transition-colors">{t('nav.learn') || 'Learning Center'}</Link>
              </li>
              <li>
                <Link href="/videos" className="hover:text-white transition-colors">{t('nav.videos') || 'Video Tutorials'}</Link>
              </li>
              <li>
                <Link href="/webinars" className="hover:text-white transition-colors">{t('nav.webinars') || 'Webinars'}</Link>
              </li>
              <li>
                <Link href="/lab-results" className="hover:text-white transition-colors">{t('nav.labResults') || 'Lab Results'}</Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-white transition-colors">{t('nav.faq') || 'FAQ'}</Link>
              </li>
            </ul>
          </nav>

          {/* Community */}
          <nav aria-label={t('footer.aria.communityLinks')}>
            <h3 className="font-bold mb-4">{t('footer.community') || 'Community'}</h3>
            <ul className="space-y-2 text-neutral-400 text-sm">
              <li>
                <Link href="/rewards" className="hover:text-orange-400 transition-colors flex items-center gap-1">
                  🎁 {t('nav.rewards') || 'Rewards Program'}
                </Link>
              </li>
              <li>
                <Link href="/subscriptions" className="hover:text-white transition-colors">{t('nav.subscriptions') || 'Subscribe & Save'}</Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-white transition-colors">{t('nav.community') || 'Forum'}</Link>
              </li>
              <li>
                <Link href="/ambassador" className="hover:text-white transition-colors">{t('nav.ambassador') || 'Become Ambassador'}</Link>
              </li>
            </ul>
          </nav>

          {/* Support */}
          <nav aria-label={t('footer.aria.supportLinks')}>
            <h3 className="font-bold mb-4">{t('footer.customerService') || 'Support'}</h3>
            <ul className="space-y-2 text-neutral-400 text-sm">
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">{t('nav.contact') || 'Contact Us'}</Link>
              </li>
              <li>
                <Link href="/track-order" className="hover:text-white transition-colors">{t('nav.trackOrder') || 'Track Order'}</Link>
              </li>
              <li>
                <Link href="/shipping-policy" className="hover:text-white transition-colors">{t('nav.shippingPolicy') || 'Shipping Policy'}</Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-white transition-colors">{t('nav.refundPolicy') || 'Refund Policy'}</Link>
              </li>
              <li>
                <Link href="/mentions-legales/conditions" className="hover:text-white transition-colors">{t('footer.terms') || 'Terms & Conditions'}</Link>
              </li>
              <li>
                <Link href="/mentions-legales/confidentialite" className="hover:text-white transition-colors">{t('footer.privacy') || 'Privacy Policy'}</Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Newsletter Section */}
        <div className="mt-12 pt-8 border-t border-neutral-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="font-bold text-lg mb-2">{t('footer.newsletter') || 'Stay Updated'}</h3>
              <p className="text-sm text-neutral-400">
                {t('footer.newsletterDesc') || 'Subscribe for exclusive offers, new products, and research insights.'}
              </p>
            </div>
            {newsletterStatus === 'success' ? (
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="animate-checkmark-draw" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{newsletterMessage}</span>
              </div>
            ) : (
              <div className="max-w-md">
                <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('footer.placeholder.email')}
                    required
                    className="flex-1 px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === 'loading'}
                    className="px-6 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                  >
                    {newsletterStatus === 'loading' ? '...' : (t('footer.subscribe') || 'Subscribe')}
                  </button>
                </form>
                {newsletterStatus === 'error' && (
                  <p className="text-red-400 text-sm mt-2">{newsletterMessage}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 pt-8 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 leading-relaxed mb-4">
            <strong className="text-orange-400">DISCLAIMER:</strong> {t('disclaimer.text') || 'All products are intended for laboratory and research use only. Not for human consumption. Products have not been evaluated by Health Canada or the FDA. Purchasers must be 18+ years of age. By using this website, you agree that these products are being purchased for research purposes only.'}
          </p>

          {/* Company Legal Identification */}
          <div className="mb-4 text-xs text-neutral-500 leading-relaxed">
            <p className="font-semibold text-neutral-400 mb-1">{t('footer.companyInfo')}</p>
            <p>{t('footer.companyName')}</p>
            <p>{t('footer.companyNeq')}</p>
            <p>{t('footer.companyAddress')}</p>
            <p>{t('footer.companyPhone')}</p>
          </div>

          {/* Payment Methods */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-sm text-neutral-500">
              © {new Date().getFullYear()} BioCycle Peptides. {t('footer.copyright') || 'All rights reserved.'}
            </p>
            <div className="flex items-center gap-3 text-neutral-400">
              <span className="text-xs">{t('footer.securePayments')}:</span>
              <span title={t('footer.paymentVisa')}>💳</span>
              <span title={t('footer.paymentMastercard')}>💳</span>
              <span title={t('footer.paymentPaypal')}>🅿️</span>
              <span title={t('footer.paymentApplePay')}>🍎</span>
              <span title={t('footer.paymentGooglePay')}>G</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
