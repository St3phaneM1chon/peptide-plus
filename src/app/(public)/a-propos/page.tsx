export const revalidate = 300; // ISR: revalidate every 5 minutes

import { Metadata } from 'next';
import Link from 'next/link';
import { getContentPage, getSiteSettings } from '@/lib/content-pages';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContentPage('about');
  return {
    title: page?.metaTitle || `About - ${siteName}`,
    description: page?.metaDescription || `Learn more about ${siteName}.`,
    alternates: { canonical: `${appUrl}/a-propos` },
  };
}

export default async function AboutPage() {
  const [page, settings] = await Promise.all([
    getContentPage('about'),
    getSiteSettings(),
  ]);

  const companyName = settings.companyName;

  return (
    <div className="min-h-screen" style={{ background: 'var(--k-bg, #0a0a0f)' }}>
      {/* Hero Section */}
      <section
        className="py-20 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.10) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1
            className="font-heading text-4xl md:text-5xl font-bold mb-6"
            style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
          >
            {page?.title || companyName}
          </h1>
          {page?.excerpt && (
            <p
              className="text-lg"
              style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', lineHeight: '1.8' }}
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
          /* No DB content -- show branded "coming soon" page */
          <div
            className="rounded-2xl p-12 text-center"
            style={{
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="text-5xl mb-6">🏢</div>
            <h2
              className="text-2xl font-bold mb-4"
              style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
            >
              {companyName}
            </h2>
            <p
              className="text-lg mb-8 max-w-lg mx-auto"
              style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
            >
              {settings.companyDescription || `Welcome to ${companyName}. Our about page is being prepared.`}
            </p>
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
          </div>
        )}

        {/* Sub-page navigation -- always visible */}
        <div
          className="mt-8 rounded-2xl p-6 text-center"
          style={{
            background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h3
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
          >
            Learn More
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            <AboutNavLink href="/a-propos/mission">Mission</AboutNavLink>
            <AboutNavLink href="/a-propos/valeurs">Values</AboutNavLink>
            <AboutNavLink href="/a-propos/histoire">History</AboutNavLink>
            <AboutNavLink href="/a-propos/engagements">Commitments</AboutNavLink>
            <AboutNavLink href="/a-propos/equipe">Team</AboutNavLink>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/shop"
            className="inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-lg transition-colors"
            style={{
              background: 'var(--k-accent, #6366f1)',
              color: '#fff',
            }}
          >
            Explore Our Products
          </Link>
        </div>
      </div>
    </div>
  );
}

function AboutNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
        color: 'var(--k-text-secondary, rgba(255,255,255,0.60))',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {children}
    </Link>
  );
}
