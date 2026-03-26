export const revalidate = 300; // ISR: revalidate every 5 minutes

import { Metadata } from 'next';
import Link from 'next/link';
import { getContentPage } from '@/lib/content-pages';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContentPage('refund-policy');
  return {
    title: page?.metaTitle || `Refund Policy - ${siteName}`,
    description: page?.metaDescription || `Refund and return policy for ${siteName}.`,
    alternates: { canonical: `${appUrl}/refund-policy` },
  };
}

export default async function RefundPolicyPage() {
  const page = await getContentPage('refund-policy');

  return (
    <div className="min-h-screen" style={{ background: 'var(--k-bg, #0a0a0f)' }}>
      {/* Hero */}
      <section
        className="py-16 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.10) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
          >
            {page?.title || 'Refund Policy'}
          </h1>
          {page?.excerpt && (
            <p
              className="text-lg max-w-2xl mx-auto"
              style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
            >
              {page.excerpt}
            </p>
          )}
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {page ? (
          /* DB content found -- render admin-authored HTML */
          <div
            className="rounded-2xl p-8 md:p-12"
            style={{
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div
              className="prose prose-invert max-w-none"
              style={{
                color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                lineHeight: '1.8',
              }}
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
            {page.updatedAt && (
              <p
                className="text-sm mt-8 pt-4 text-center"
                style={{
                  color: 'var(--k-text-tertiary, rgba(255,255,255,0.40))',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                Last updated: {new Date(page.updatedAt).toLocaleDateString('fr-CA')}
              </p>
            )}
          </div>
        ) : (
          /* No DB content -- show "coming soon" placeholder */
          <div
            className="rounded-2xl p-12 text-center"
            style={{
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="text-5xl mb-6">↩️</div>
            <h2
              className="text-2xl font-bold mb-4"
              style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
            >
              Refund Policy
            </h2>
            <p
              className="text-lg mb-8 max-w-lg mx-auto"
              style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
            >
              Our refund policy is being prepared. Please contact us for any return or refund questions.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center px-6 py-3 rounded-xl font-semibold transition-colors"
                style={{
                  background: 'var(--k-accent, #6366f1)',
                  color: '#fff',
                }}
              >
                Contact Us
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center px-6 py-3 rounded-xl font-semibold transition-colors"
                style={{
                  background: 'var(--k-glass-thick, rgba(255,255,255,0.12))',
                  color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                FAQ
              </Link>
            </div>
          </div>
        )}

        {/* Navigation links -- always visible */}
        <div
          className="mt-8 rounded-2xl p-6 flex flex-wrap justify-center gap-4"
          style={{
            background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Link
            href="/contact"
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              color: 'var(--k-text-secondary, rgba(255,255,255,0.60))',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Contact Support
          </Link>
          <Link
            href="/faq"
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              color: 'var(--k-text-secondary, rgba(255,255,255,0.60))',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            FAQ
          </Link>
          <Link
            href="/shipping-policy"
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              color: 'var(--k-text-secondary, rgba(255,255,255,0.60))',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Shipping Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
