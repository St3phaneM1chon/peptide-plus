export const dynamic = 'force-dynamic';
/**
 * PAGE ACTUALITÉS / COMMUNIQUÉS DE PRESSE
 */

import Link from 'next/link';

export const metadata = {
  title: 'Actualités | Formations Pro',
  description: 'Communiqués de presse, annonces et actualités de l\'entreprise.',
};

const news = [
  {
    id: '1',
    date: '15 janvier 2026',
    type: 'Communiqué',
    title: 'Formations Pro lève 10M$ pour accélérer son expansion internationale',
    excerpt: 'Ce financement de série B permettra d\'étendre notre présence en Europe et de renforcer notre plateforme technologique.',
    featured: true,
  },
  {
    id: '2',
    date: '10 janvier 2026',
    type: 'Partenariat',
    title: 'Partenariat stratégique avec Microsoft pour l\'intégration de Teams',
    excerpt: 'Les formations seront désormais accessibles directement depuis Microsoft Teams.',
    featured: true,
  },
  {
    id: '3',
    date: '5 janvier 2026',
    type: 'Produit',
    title: 'Lancement de notre nouvelle plateforme IA de personnalisation',
    excerpt: 'Des parcours d\'apprentissage adaptés en temps réel grâce à l\'intelligence artificielle.',
    featured: false,
  },
  {
    id: '4',
    date: '20 décembre 2025',
    type: 'Récompense',
    title: 'Formations Pro élue meilleure plateforme LMS 2025',
    excerpt: 'Reconnaissance par le magazine EdTech pour notre innovation et notre impact.',
    featured: false,
  },
  {
    id: '5',
    date: '15 décembre 2025',
    type: 'Événement',
    title: 'Conférence annuelle: 500 participants réunis à Montréal',
    excerpt: 'Retour sur notre événement phare dédié à l\'avenir de la formation professionnelle.',
    featured: false,
  },
  {
    id: '6',
    date: '1 décembre 2025',
    type: 'Certification',
    title: 'Obtention de la certification ISO 27001',
    excerpt: 'Notre engagement pour la sécurité des données reconnu à l\'international.',
    featured: false,
  },
];

const typeColors: Record<string, string> = {
  'Communiqué': '#3b82f6',
  'Partenariat': '#8b5cf6',
  'Produit': '#22c55e',
  'Récompense': '#f59e0b',
  'Événement': '#ec4899',
  'Certification': '#06b6d4',
};

export default function NewsPage() {
  const featuredNews = news.filter(n => n.featured);
  const otherNews = news.filter(n => !n.featured);

  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>Actualités</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          Communiqués de presse, annonces et nouveautés
        </p>
      </section>

      {/* Featured */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
            À la une
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {featuredNews.map((item) => (
              <Link
                key={item.id}
                href={`/actualites/${item.id}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '32px',
                  textDecoration: 'none',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      backgroundColor: typeColors[item.type] || 'var(--gray-500)',
                      color: 'white',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {item.type}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>{item.date}</span>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-500)' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6 }}>
                  {item.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
            Toutes les actualités
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {otherNews.map((item) => (
              <Link
                key={item.id}
                href={`/actualites/${item.id}`}
                style={{
                  display: 'flex',
                  gap: '24px',
                  padding: '24px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ width: '100px', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>{item.date}</span>
                </div>
                <div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        backgroundColor: typeColors[item.type] || 'var(--gray-500)',
                        color: 'white',
                        borderRadius: '8px',
                        fontSize: '10px',
                        fontWeight: 600,
                      }}
                    >
                      {item.type}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--gray-500)' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{item.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Press Contact */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Contact presse
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Pour toute demande média, contactez notre équipe de relations publiques.
        </p>
        <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
          📧 presse@formationspro.com • 📞 514-555-0199
        </p>
      </section>
    </div>
  );
}
