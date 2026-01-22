/**
 * PAGE PRESSE
 */

import Link from 'next/link';

export const metadata = {
  title: 'Presse | Formations Pro',
  description: 'Espace presse: communiqués, ressources médias et contact.',
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
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
          Espace Presse
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
          Communiqués de presse, ressources médias et informations pour les journalistes.
        </p>
      </section>

      {/* Press releases */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
            Communiqués de presse
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pressReleases.map((release, i) => (
              <Link
                key={i}
                href="#"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px 24px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  textDecoration: 'none',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>{release.date}</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gray-500)', marginTop: '4px' }}>
                    {release.title}
                  </h3>
                </div>
                <span style={{ color: 'var(--gray-400)' }}>→</span>
              </Link>
            ))}
          </div>
          <Link
            href="/actualites"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: '24px',
              color: 'var(--gray-500)',
              fontWeight: 500,
            }}
          >
            Voir tous les communiqués →
          </Link>
        </div>
      </section>

      {/* Media assets */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
            Kit média
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '32px' }}>
            Téléchargez nos ressources officielles pour vos publications.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {mediaAssets.map((asset, i) => (
              <a
                key={i}
                href="#"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 20px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: '24px' }}>📁</span>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)' }}>{asset.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{asset.size}</p>
                </div>
              </a>
            ))}
          </div>
          <div style={{ marginTop: '32px', textAlign: 'center' }}>
            <Link href="#" className="btn btn-secondary">
              Télécharger le kit complet (ZIP)
            </Link>
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
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
                  backgroundColor: 'white',
                  borderRadius: '12px',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-500)' }}>{item.outlet}</span>
                  <h3 style={{ fontSize: '15px', color: 'var(--gray-400)', marginTop: '4px' }}>
                    {item.title}
                  </h3>
                </div>
                <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>{item.date}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px' }}>📰</span>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
            Contact presse
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            Pour toute demande média, interview ou information complémentaire.
          </p>
          <div style={{ fontSize: '15px', color: 'var(--gray-500)' }}>
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
