/**
 * PAGE ÉTUDES DE CAS
 */

'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function CaseStudiesPage() {
  const { t } = useI18n();

  const caseStudies = [
    {
      id: 'desjardins-transformation',
      company: 'Desjardins',
      industry: t('clients.industryFinance'),
      title: t('caseStudies.study1Title'),
      summary: t('caseStudies.study1Summary'),
      results: ['+45% productivité', '98% satisfaction', '6 mois d\'avance'],
      image: null,
      featured: true,
    },
    {
      id: 'cgi-leadership',
      company: 'CGI',
      industry: t('clients.industryTech'),
      title: t('caseStudies.study2Title'),
      summary: t('caseStudies.study2Summary'),
      results: ['+30% engagement', 'Promotion interne x2', '92% completion'],
      image: null,
      featured: true,
    },
    {
      id: 'hydro-conformite',
      company: 'Hydro-Québec',
      industry: t('clients.industryEnergy'),
      title: t('caseStudies.study3Title'),
      summary: t('caseStudies.study3Summary'),
      results: ['100% conformité', 'Zéro incident', 'ROI 300%'],
      image: null,
      featured: false,
    },
    {
      id: 'bell-onboarding',
      company: 'Bell Canada',
      industry: t('clients.industryTelecom'),
      title: t('caseStudies.study4Title'),
      summary: t('caseStudies.study4Summary'),
      results: ['-40% temps intégration', '+25% rétention', 'Standardisation'],
      image: null,
      featured: false,
    },
    {
      id: 'bombardier-technique',
      company: 'Bombardier',
      industry: t('clients.industryAerospace'),
      title: t('caseStudies.study5Title'),
      summary: t('caseStudies.study5Summary'),
      results: ['300 certifiés', '-20% erreurs', 'Innovation accélérée'],
      image: null,
      featured: false,
    },
  ];

  const featuredStudies = caseStudies.filter(cs => cs.featured);
  const otherStudies = caseStudies.filter(cs => !cs.featured);

  return (
    <div style={{ background: 'var(--k-bg-base, #0a0a0f)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(59,130,246,0.10))',
          color: 'white',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 className="font-heading" style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            {t('caseStudies.title')}
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            {t('caseStudies.heroText')}
          </p>
        </div>
      </section>

      {/* Featured */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '40px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            {t('caseStudies.featured')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '32px' }}>
            {featuredStudies.map((study) => (
              <Link
                key={study.id}
                href={`/clients/etudes-de-cas/${study.id}`}
                style={{
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  textDecoration: 'none',
                  display: 'block',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    height: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '64px' }}>📊</span>
                </div>
                <div style={{ padding: '32px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
                      {study.company}
                    </span>
                    <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
                      {study.industry}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
                    {study.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', lineHeight: 1.6, marginBottom: '20px' }}>
                    {study.summary}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {study.results.map((result, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#22c55e',
                          padding: '6px 12px',
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: '6px',
                        }}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Other case studies */}
      <section style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', backdropFilter: 'blur(20px)', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '40px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            {t('caseStudies.otherStudies')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {otherStudies.map((study) => (
              <Link
                key={study.id}
                href={`/clients/etudes-de-cas/${study.id}`}
                style={{
                  padding: '24px',
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '24px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{study.company}</span>
                    <span style={{ fontSize: '12px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>• {study.industry}</span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--k-text-primary, rgba(255,255,255,0.95))', marginBottom: '4px' }}>
                    {study.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{study.summary}</p>
                </div>
                <span style={{ fontSize: '14px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))', fontWeight: 500, flexShrink: 0 }}>
                  {t('caseStudies.readMore')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
          {t('caseStudies.ctaTitle')}
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', marginBottom: '24px' }}>
          {t('caseStudies.ctaText')}
        </p>
        <Link href="/demo" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          {t('caseStudies.requestDemo')}
        </Link>
      </section>
    </div>
  );
}
