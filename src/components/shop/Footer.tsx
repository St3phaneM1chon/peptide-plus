// TODO: Consider extracting non-interactive sections (links, disclaimers, trust badges)
// into a separate server component to reduce client-side JavaScript bundle size.
// Only the newsletter form requires client-side interactivity ('use client').
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';
import { addCSRFHeader } from '@/lib/csrf';
import { useTenantBranding } from './TenantBrandingProvider';

export default function Footer() {
  const { t } = useI18n();
  const tenant = useTenantBranding();
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
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
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

  // Build location string from SiteSettings fields
  const locationParts = [tenant.city, tenant.province, tenant.country].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : '';

  return (
    <footer className="bg-navy-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-2 md:grid-cols-3 gap-8 ${
          tenant.footerNav.length > 0
            ? tenant.footerNav.length <= 2
              ? 'lg:grid-cols-4'
              : tenant.footerNav.length <= 4
                ? 'lg:grid-cols-6'
                : 'lg:grid-cols-' + Math.min(tenant.footerNav.length + 2, 8)
            : 'lg:grid-cols-6'
        }`}>
          {/* Logo & Info — uses tenant branding */}
          <div className="col-span-2">
            <div className="mb-4">
              {tenant.logoUrl ? (
                <Image
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  width={600}
                  height={200}
                  className="h-10 w-auto brightness-0 invert"
                />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {tenant.name}
                </span>
              )}
            </div>
            {tenant.companyDescription && (
              <p className="text-neutral-300 text-sm leading-relaxed mb-4">
                {tenant.companyDescription}
              </p>
            )}
            {locationStr && (
              <p className="text-neutral-300 text-sm">
                {locationStr}
              </p>
            )}
            {tenant.phone && (
              <p className="text-neutral-300 text-sm mt-1">
                {tenant.phone}
              </p>
            )}

            {/* Trust Badges — dynamic from SiteSettings */}
            {tenant.trustBadges.length > 0 && (
              <div className="flex items-center gap-4 mt-4 text-xs text-neutral-300">
                {tenant.trustBadges.map((badge, i) => (
                  <span key={i}>{badge.icon ? `${badge.icon} ` : ''}{badge.label}</span>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic footer columns from SiteSettings footerNav */}
          {tenant.footerNav.map((column, idx) => (
            <nav key={idx} aria-label={column.title}>
              <h3 className="font-bold mb-4 text-white">{column.title}</h3>
              <ul className="space-y-2 text-neutral-300 text-sm">
                {column.links.map((link, linkIdx) => (
                  <li key={linkIdx}>
                    <Link href={link.href} className="hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Newsletter Section */}
        <div className="mt-12 pt-8 border-t border-neutral-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="font-bold text-lg mb-2 text-white">{t('footer.newsletter') || 'Stay Updated'}</h3>
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
                    aria-label={t('footer.placeholder.email') || 'Email address for newsletter'}
                    required
                    className="flex-1 px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-primary-500"
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === 'loading'}
                    className="px-6 py-2 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
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

        {/* Disclaimer — dynamic from SiteSettings */}
        <div className="mt-8 pt-8 border-t border-neutral-800">
          {tenant.disclaimerText && (
            <p className="text-xs text-neutral-300 leading-relaxed mb-4">
              <strong className="text-primary-400">DISCLAIMER:</strong> {tenant.disclaimerText}
            </p>
          )}

          {/* Company Legal Identification — from SiteSettings */}
          {(tenant.name || tenant.address || tenant.phone) && (
            <div className="mb-4 text-xs text-neutral-300 leading-relaxed">
              <p className="font-semibold text-neutral-200 mb-1">{tenant.name}</p>
              {tenant.address && <p>{tenant.address}</p>}
              {locationStr && <p>{locationStr}</p>}
              {tenant.phone && <p>{tenant.phone}</p>}
            </div>
          )}

          {/* Payment Methods */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-neutral-400">
                © {new Date().getFullYear()} {tenant.name}. {t('footer.copyright') || 'All rights reserved.'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-neutral-300">
              <span className="text-xs">{t('footer.securePayments')}:</span>
              <svg className="h-6 w-9" viewBox="0 0 36 24" fill="none"><rect width="36" height="24" rx="3" fill="#1A1F71"/><path d="M15.1 16.5l2.3-9h2.6l-2.3 9h-2.6zm10.3-9l-2.5 6.2-.3-1.5-1-4.8s-.1-.9-1.3-.9h-3.8l-.1.3s1.4.3 3 1.3l2.5 6.4h2.7l4.1-7h-3.3zm-14.2 0l-2.6 6.2-.3-1.5-1-4.8s-.1-.9-1.3-.9H2.2l-.1.3s1.4.3 3 1.3l2.5 6.4h2.7l4.1-7h-3.2z" fill="#fff"/><path d="M9.9 9l-1 4.8-.3 1.5L8 12.5C7 11.3 5.6 10.6 5.6 10.6l2.5 5.9h2.7l4.1-9H12L9.9 9z" fill="#F7B600"/></svg>
              <svg className="h-6 w-9" viewBox="0 0 36 24" fill="none"><rect width="36" height="24" rx="3" fill="#252525"/><circle cx="14" cy="12" r="7" fill="#EB001B"/><circle cx="22" cy="12" r="7" fill="#F79E1B"/><path d="M18 6.8A7 7 0 0 1 21 12a7 7 0 0 1-3 5.2A7 7 0 0 1 15 12a7 7 0 0 1 3-5.2z" fill="#FF5F00"/></svg>
              <svg className="h-6 w-9" viewBox="0 0 36 24" fill="none"><rect width="36" height="24" rx="3" fill="#003087"/><text x="18" y="15" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">PayPal</text></svg>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
