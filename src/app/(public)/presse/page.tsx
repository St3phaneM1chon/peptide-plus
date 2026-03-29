/**
 * PAGE PRESSE
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Espace presse | Koraline',
  description: 'Espace presse Koraline : communiqués de presse, ressources médias et contact pour les journalistes et professionnels.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/presse`,
  },
  openGraph: {
    title: 'Espace presse | Koraline',
    description: 'Espace presse Koraline : communiqués de presse, ressources médias et contact pour les journalistes et professionnels.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/presse`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Espace presse | Koraline',
    description: 'Communiqués de presse, ressources médias et contact pour les journalistes.',
  },
};

const pressReleases = [
  {
    date: '15 janvier 2026',
    title: 'Formations Pro lève 10M$ pour accélérer son expansion internationale',
  },
  {
    date: '10 janvier 2026',
    title: 'Partenariat stratégique avec Microsoft pour l\'intégration de Teams',
  },
  {
    date: '5 janvier 2026',
    title: 'Lancement de notre nouvelle plateforme IA de personnalisation',
  },
  {
    date: '20 décembre 2025',
    title: 'Formations Pro élue meilleure plateforme LMS 2025 par EdTech Magazine',
  },
];

const mediaAssets = [
  { name: 'Logo (PNG, SVG)', size: '2.5 MB' },
  { name: 'Photos de l\'équipe', size: '15 MB' },
  { name: 'Captures d\'écran produit', size: '8 MB' },
  { name: 'Guide de marque', size: '3 MB' },
];

const coverage = [
  { outlet: 'Les Affaires', title: 'Les edtech québécoises qui montent', date: 'Janvier 2026' },
  { outlet: 'TechCrunch', title: 'Canadian EdTech raises $10M Series B', date: 'Janvier 2026' },
  { outlet: 'Le Devoir', title: 'La formation professionnelle se réinvente', date: 'Décembre 2025' },
];

export default function PressPage() {
  return (
    <div style={{ background: 'var(--k-bg-base, #0a0a0f)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(168,85,247,0.15) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          color: 'white',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <h1 className="font-heading" style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
          Espace Presse
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
          Communiqués de presse, ressources médias et informations pour les journalistes.
        </p>
      </section>

      {/* Press releases */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', color: 'var(--k-text-primary)' }}>
            Communiqués de presse
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pressReleases.map((release, i) => (
              <Link
                key={i}
                href="/actualites"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px 24px',
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  textDecoration: 'none',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--k-text-secondary)' }}>{release.date}</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--k-text-primary)', marginTop: '4px' }}>
                    {release.title}
                  </h3>
                </div>
                <span style={{ color: 'var(--k-text-secondary)' }}>→</span>
              </Link>
            ))}
          </div>
          <Link
            href="/actualites"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: '24px',
              color: 'var(--k-text-primary)',
              fontWeight: 500,
            }}
          >
            Voir tous les communiqués →
          </Link>
        </div>
      </section>

      {/* Media assets */}
      <section style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', color: 'var(--k-text-primary)' }}>
            Kit média
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--k-text-secondary)', marginBottom: '32px' }}>
            Téléchargez nos ressources officielles pour vos publications.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {mediaAssets.map((asset, i) => (
              <a
                key={i}
                href="/contact"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 20px',
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: '24px' }}>📁</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--k-text-primary)' }}>{asset.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--k-text-secondary)' }}>{asset.size}</p>
                </div>
              </a>
            ))}
          </div>
          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <Link href="/contact" className="btn btn-secondary">
              Demander le kit complet (ZIP)
            </Link>
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', color: 'var(--k-text-primary)' }}>
            Dans les médias
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {coverage.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px 24px',
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--k-text-primary)' }}>{item.outlet}</span>
                  <h3 style={{ fontSize: '15px', color: 'var(--k-text-secondary)', marginTop: '4px' }}>
                    {item.title}
                  </h3>
                </div>
                <span style={{ fontSize: '13px', color: 'var(--k-text-secondary)' }}>{item.date}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px' }}>📰</span>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--k-text-primary)' }}>
            Contact presse
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--k-text-secondary)', marginBottom: '24px' }}>
            Pour toute demande média, interview ou information complémentaire.
          </p>
          <div style={{ fontSize: '15px', color: 'var(--k-text-primary)' }}>
            <p>📧 presse@formationspro.com</p>
            <p>📞 514-555-0199</p>
          </div>
          <Link
            href="/contact?subject=press"
            className="btn btn-primary"
            style={{ marginTop: '24px', padding: '14px 32px' }}
          >
            Contacter l'équipe presse
          </Link>
        </div>
      </section>
    </div>
  );
}
