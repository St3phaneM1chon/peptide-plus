'use client';

/**
 * PAGE SOLUTIONS - Principale
 */

import Link from 'next/link';

// metadata moved to layout for client components

const solutions = [
  {
    title: 'Pour les entreprises',
    description: 'Programmes de formation sur mesure pour développer les compétences de vos équipes.',
    href: '/solutions/entreprises',
    icon: '🏢',
    features: ['Formations personnalisées', 'Suivi des progrès', 'Rapports détaillés', 'Support dédié'],
  },
  {
    title: 'Pour les particuliers',
    description: 'Formations accessibles pour booster votre carrière et acquérir de nouvelles compétences.',
    href: '/solutions/particuliers',
    icon: '👤',
    features: ['Apprentissage flexible', 'Certifications reconnues', 'Accompagnement personnalisé', 'Tarifs accessibles'],
  },
  {
    title: 'Pour les partenaires',
    description: 'Rejoignez notre réseau de partenaires et proposez nos formations à vos clients.',
    href: '/solutions/partenaires',
    icon: '🤝',
    features: ['Programme d\'affiliation', 'Formation des formateurs', 'Co-branding', 'Revenus partagés'],
  },
];

const industries = [
  { name: 'Finance & Assurance', icon: '💰', count: 45 },
  { name: 'Technologie', icon: '💻', count: 62 },
  { name: 'Santé', icon: '🏥', count: 38 },
  { name: 'Vente au détail', icon: '🛒', count: 29 },
  { name: 'Manufacturier', icon: '🏭', count: 34 },
  { name: 'Services professionnels', icon: '📊', count: 51 },
];

export default function SolutionsPage() {
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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            Des solutions adaptées à vos besoins
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Que vous soyez une entreprise, un professionnel indépendant ou un partenaire, 
            nous avons une solution pour vous.
          </p>
        </div>
      </section>

      {/* Solutions */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '32px',
            }}
          >
            {solutions.map((solution, i) => (
              <Link
                key={i}
                href={solution.href}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '40px',
                  textDecoration: 'none',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '20px' }}>{solution.icon}</span>
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', color: 'var(--gray-500)' }}>
                  {solution.title}
                </h2>
                <p style={{ fontSize: '15px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: '24px' }}>
                  {solution.description}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {solution.features.map((feature, j) => (
                    <li
                      key={j}
                      style={{
                        fontSize: '14px',
                        color: 'var(--gray-500)',
                        padding: '8px 0',
                        borderTop: j === 0 ? 'none' : '1px solid var(--gray-100)',
                      }}
                    >
                      ✓ {feature}
                    </li>
                  ))}
                </ul>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '24px',
                    color: 'var(--gray-500)',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                >
                  En savoir plus →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: 'var(--gray-500)' }}>
            Solutions par industrie
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', textAlign: 'center', marginBottom: '40px' }}>
            Des formations spécialisées pour chaque secteur d'activité.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '16px',
            }}
          >
            {industries.map((industry, i) => (
              <Link
                key={i}
                href={`/catalogue?industrie=${encodeURIComponent(industry.name)}`}
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  transition: 'background 0.2s ease',
                }}
              >
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>{industry.icon}</span>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                  {industry.name}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{industry.count} formations</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Besoin d'aide pour choisir?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Nos conseillers sont disponibles pour vous accompagner dans votre choix.
        </p>
        <Link href="/contact" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Contactez-nous
        </Link>
      </section>
    </div>
  );
}
