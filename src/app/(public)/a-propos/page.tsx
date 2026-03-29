export const revalidate = 300; // ISR: revalidate every 5 minutes

import { Metadata } from 'next';
import Link from 'next/link';
import { getContentPage, getSiteSettings } from '@/lib/content-pages';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContentPage('about');
  const title = page?.metaTitle || `À propos | ${siteName}`;
  const description = page?.metaDescription || `Découvrez l'équipe et la mission d'${siteName}, votre partenaire en transformation numérique.`;
  const url = `${appUrl}/a-propos`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName,
      locale: 'fr_CA',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
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
                Dernière mise à jour: {new Date(page.updatedAt).toLocaleDateString('fr-CA')}
              </p>
            )}
          </div>
        ) : (
          /* No DB content -- show branded about page with trust signals */
          <div className="space-y-8">
            <div
              className="rounded-2xl p-12 text-center"
              style={{
                background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <h2
                className="text-2xl font-bold mb-4"
                style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
              >
                {companyName}
              </h2>
              <p
                className="text-lg mb-8 max-w-lg mx-auto leading-relaxed"
                style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
              >
                {settings.companyDescription || `Nous accompagnons les entreprises québécoises dans leur transformation numérique depuis notre fondation. Notre mission: rendre la technologie accessible à tous.`}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center px-6 py-3 rounded-xl font-semibold transition-colors"
                  style={{ background: 'var(--k-accent, #6366f1)', color: '#fff' }}
                >
                  Nous contacter
                </Link>
                <Link
                  href="/solutions"
                  className="inline-flex items-center px-6 py-3 rounded-xl font-semibold transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
                >
                  Nos solutions
                </Link>
              </div>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { value: '500+', label: 'Clients satisfaits' },
                { value: '99%', label: 'Taux de satisfaction' },
                { value: '24/7', label: 'Support disponible' },
                { value: '11', label: 'Modules intégrés' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 text-center"
                  style={{
                    background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="text-2xl md:text-3xl font-bold mb-1"
                    style={{ color: 'var(--k-accent, #6366f1)' }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
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
            En savoir plus
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            <AboutNavLink href="/a-propos/mission">Mission</AboutNavLink>
            <AboutNavLink href="/a-propos/valeurs">Valeurs</AboutNavLink>
            <AboutNavLink href="/a-propos/histoire">Histoire</AboutNavLink>
            <AboutNavLink href="/a-propos/engagements">Engagements</AboutNavLink>
            <AboutNavLink href="/a-propos/equipe">Équipe</AboutNavLink>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/tarifs"
            className="inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-lg transition-colors"
            style={{
              background: 'var(--k-accent, #6366f1)',
              color: '#fff',
            }}
          >
            Découvrir nos solutions
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
