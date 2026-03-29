'use client';

/**
 * PAGE SOLUTIONS - Principale
 */

import Link from 'next/link';
import { MotionDiv } from '@/components/koraline/MotionDiv';

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
    <div style={{ background: 'var(--k-bg-base, #0a0a0f)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.10) 100%)',
          borderBottom: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <MotionDiv animation="slideUp">
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="font-heading" style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
              Des solutions adaptées à vos besoins
            </h1>
            <p style={{ fontSize: '18px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', lineHeight: 1.7 }}>
              Que vous soyez une entreprise, un professionnel indépendant ou un partenaire,
              nous avons une solution pour vous.
            </p>
          </div>
        </MotionDiv>
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
              <MotionDiv key={i} animation="fadeInOnScroll" delay={i * 0.1}>
                <Link
                  href={solution.href}
                  style={{
                    display: 'block',
                    background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                    border: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    padding: '40px',
                    textDecoration: 'none',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,0,0,0.32)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'var(--k-border-subtle, rgba(255,255,255,0.06))';
                  }}
                >
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '20px' }}>{solution.icon}</span>
                  <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
                    {solution.title}
                  </h2>
                  <p style={{ fontSize: '15px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', lineHeight: 1.7, marginBottom: '24px' }}>
                    {solution.description}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {solution.features.map((feature, j) => (
                      <li
                        key={j}
                        style={{
                          fontSize: '14px',
                          color: 'var(--k-text-secondary, rgba(255,255,255,0.60))',
                          padding: '8px 0',
                          borderTop: j === 0 ? 'none' : '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
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
                      color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                      fontWeight: 600,
                      fontSize: '14px',
                    }}
                  >
                    En savoir plus →
                  </span>
                </Link>
              </MotionDiv>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section
        style={{
          background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
          borderTop: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          borderBottom: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          padding: '64px 24px',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <MotionDiv animation="fadeInOnScroll">
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
              Solutions par industrie
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', textAlign: 'center', marginBottom: '40px' }}>
              Des formations spécialisées pour chaque secteur d'activité.
            </p>
          </MotionDiv>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '16px',
            }}
          >
            {industries.map((industry, i) => (
              <MotionDiv key={i} animation="fadeInOnScroll" delay={i * 0.08}>
                <Link
                  href={`/catalogue?industrie=${encodeURIComponent(industry.name)}`}
                  style={{
                    display: 'block',
                    padding: '24px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
                    borderRadius: '12px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    transition: 'background 0.2s ease, border-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.borderColor = 'var(--k-border-subtle, rgba(255,255,255,0.06))';
                  }}
                >
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>{industry.icon}</span>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--k-text-primary, rgba(255,255,255,0.95))', marginBottom: '4px' }}>
                    {industry.name}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{industry.count} formations</span>
                </Link>
              </MotionDiv>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <MotionDiv animation="fadeInOnScroll">
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            Besoin d'aide pour choisir?
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', marginBottom: '24px' }}>
            Nos conseillers sont disponibles pour vous accompagner dans votre choix.
          </p>
          <Link href="/contact" className="btn btn-primary" style={{ padding: '14px 32px' }}>
            Contactez-nous
          </Link>
        </MotionDiv>
      </section>
    </div>
  );
}
