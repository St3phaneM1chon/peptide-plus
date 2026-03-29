/**
 * PAGE CLIENTS - Principale
 */

'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function ClientsPage() {
  const { t } = useI18n();

  const clients = [
    { name: 'Desjardins', industry: t('clients.industryFinance'), logo: '🏦' },
    { name: 'Hydro-Québec', industry: t('clients.industryEnergy'), logo: '⚡' },
    { name: 'Bell Canada', industry: t('clients.industryTelecom'), logo: '📱' },
    { name: 'Bombardier', industry: t('clients.industryAerospace'), logo: '✈️' },
    { name: 'CGI', industry: t('clients.industryTech'), logo: '💻' },
    { name: 'Couche-Tard', industry: t('clients.industryRetail'), logo: '🏪' },
    { name: 'Saputo', industry: t('clients.industryFood'), logo: '🥛' },
    { name: 'National Bank', industry: t('clients.industryFinance'), logo: '🏛️' },
    { name: 'Loto-Québec', industry: t('clients.industryEntertainment'), logo: '🎰' },
    { name: 'SAQ', industry: t('clients.industryRetail'), logo: '🍷' },
    { name: 'Metro', industry: t('clients.industryGrocery'), logo: '🛒' },
    { name: 'Vidéotron', industry: t('clients.industryTelecom'), logo: '📺' },
  ];

  const stats = [
    { value: '500+', label: t('clients.statsCompanies') },
    { value: '50K+', label: t('clients.statsLearners') },
    { value: '98%', label: t('clients.statsSatisfaction') },
    { value: '92%', label: t('clients.statsRecommendation') },
  ];

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
            {t('clients.heroTitle')}
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            {t('clients.heroText')}
          </p>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', backdropFilter: 'blur(20px)', padding: '48px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '32px', textAlign: 'center' }}>
            {stats.map((stat, i) => (
              <div key={i}>
                <p style={{ fontSize: '40px', fontWeight: 700, color: 'var(--k-text-primary, rgba(255,255,255,0.95))', marginBottom: '4px' }}>{stat.value}</p>
                <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client logos */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            {t('clients.someClients')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
            }}
          >
            {clients.map((client, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(20px)',
                  padding: '24px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>{client.logo}</span>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--k-text-primary, rgba(255,255,255,0.95))', marginBottom: '2px' }}>
                  {client.name}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{client.industry}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Links */}
      <section style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', backdropFilter: 'blur(20px)', padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <Link
              href="/clients/temoignages"
              style={{
                padding: '32px',
                background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                backdropFilter: 'blur(20px)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <span style={{ fontSize: '40px' }}>💬</span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--k-text-primary, rgba(255,255,255,0.95))', marginBottom: '4px' }}>
                  {t('clients.testimonialsTitle')}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
                  {t('clients.testimonialsDesc')}
                </p>
              </div>
            </Link>
            <Link
              href="/clients/etudes-de-cas"
              style={{
                padding: '32px',
                background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                backdropFilter: 'blur(20px)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <span style={{ fontSize: '40px' }}>📊</span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--k-text-primary, rgba(255,255,255,0.95))', marginBottom: '4px' }}>
                  {t('clients.caseStudiesTitle')}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
                  {t('clients.caseStudiesDesc')}
                </p>
              </div>
            </Link>
            <Link
              href="/clients/references"
              style={{
                padding: '32px',
                background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                backdropFilter: 'blur(20px)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <span style={{ fontSize: '40px' }}>🏆</span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--k-text-primary, rgba(255,255,255,0.95))', marginBottom: '4px' }}>
                  {t('clients.referencesTitle')}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
                  {t('clients.referencesDesc')}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
          {t('clients.ctaTitle')}
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', marginBottom: '24px' }}>
          {t('clients.ctaText')}
        </p>
        <Link href="/demo" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          {t('clients.requestDemo')}
        </Link>
      </section>
    </div>
  );
}
