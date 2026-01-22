/**
 * PAGE SOLUTIONS PARTENAIRES
 */

import Link from 'next/link';

export const metadata = {
  title: 'Programme Partenaires | Formations Pro',
  description: 'Rejoignez notre réseau de partenaires et proposez nos formations à vos clients.',
};

const partnerTypes = [
  {
    title: 'Affiliés',
    icon: '🔗',
    description: 'Recommandez nos formations et gagnez des commissions sur chaque vente.',
    benefits: ['Commission de 20% sur chaque vente', 'Tableau de bord de suivi', 'Matériel marketing fourni', 'Paiements mensuels'],
  },
  {
    title: 'Revendeurs',
    icon: '🏪',
    description: 'Intégrez nos formations dans votre offre et proposez-les à vos clients.',
    benefits: ['Tarifs préférentiels', 'Co-branding possible', 'Support technique', 'Formation commerciale'],
  },
  {
    title: 'Formateurs certifiés',
    icon: '👨‍🏫',
    description: 'Devenez formateur certifié et animez nos programmes en présentiel ou en ligne.',
    benefits: ['Certification officielle', 'Accès aux contenus', 'Revenus attractifs', 'Communauté de formateurs'],
  },
];

const stats = [
  { value: '150+', label: 'Partenaires actifs' },
  { value: '2M$', label: 'Commissions versées' },
  { value: '12', label: 'Pays couverts' },
  { value: '98%', label: 'Satisfaction partenaires' },
];

export default function PartnerSolutionsPage() {
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
          <span style={{ fontSize: '14px', fontWeight: 600, opacity: 0.8, display: 'block', marginBottom: '16px' }}>
            PROGRAMME PARTENAIRES
          </span>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            Développons ensemble
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7, marginBottom: '32px' }}>
            Rejoignez notre réseau de partenaires et bénéficiez de revenus récurrents 
            en proposant des formations de qualité à vos clients.
          </p>
          <Link href="/contact?subject=partnership" className="btn" style={{ backgroundColor: 'white', color: 'var(--gray-500)', padding: '14px 28px' }}>
            Devenir partenaire
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section style={{ backgroundColor: 'white', padding: '48px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '32px', textAlign: 'center' }}>
            {stats.map((stat, i) => (
              <div key={i}>
                <p style={{ fontSize: '36px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '4px' }}>{stat.value}</p>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Types */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--gray-500)' }}>
            Types de partenariat
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '32px',
            }}
          >
            {partnerTypes.map((type, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '40px',
                }}
              >
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '20px' }}>{type.icon}</span>
                <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-500)' }}>
                  {type.title}
                </h3>
                <p style={{ fontSize: '15px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: '24px' }}>
                  {type.description}
                </p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {type.benefits.map((benefit, j) => (
                    <li
                      key={j}
                      style={{
                        fontSize: '14px',
                        color: 'var(--gray-500)',
                        padding: '10px 0',
                        borderTop: j === 0 ? 'none' : '1px solid var(--gray-100)',
                      }}
                    >
                      ✓ {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--gray-500)' }}>
            Comment ça marche?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {[
              { step: '1', title: 'Candidature', desc: 'Remplissez le formulaire de candidature avec vos informations.' },
              { step: '2', title: 'Validation', desc: 'Notre équipe examine votre candidature sous 48h.' },
              { step: '3', title: 'Onboarding', desc: 'Accès à votre portail partenaire et formation commerciale.' },
              { step: '4', title: 'Démarrage', desc: 'Commencez à promouvoir nos formations et générez des revenus.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: 'var(--gray-500)',
                    color: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '18px',
                    flexShrink: 0,
                  }}
                >
                  {item.step}
                </span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', color: 'var(--gray-500)' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Prêt à rejoindre notre réseau?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Contactez-nous pour discuter de votre projet de partenariat.
        </p>
        <Link href="/contact?subject=partnership" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Contactez-nous
        </Link>
      </section>
    </div>
  );
}
