/**
 * PAGE SOLUTIONS ENTREPRISES
 */

import Link from 'next/link';

export const metadata = {
  title: 'Solutions Entreprises | Formations Pro',
  description: 'Programmes de formation sur mesure pour développer les compétences de vos équipes.',
};

const benefits = [
  { icon: '📊', title: 'Tableaux de bord', desc: 'Suivez les progrès de vos équipes en temps réel.' },
  { icon: '🎯', title: 'Formations sur mesure', desc: 'Programmes adaptés à vos objectifs spécifiques.' },
  { icon: '👥', title: 'Gestion des apprenants', desc: 'Ajoutez et gérez facilement vos employés.' },
  { icon: '📈', title: 'Rapports détaillés', desc: 'Analysez l\'impact des formations sur vos KPIs.' },
  { icon: '🔒', title: 'SSO & Sécurité', desc: 'Intégration avec votre infrastructure existante.' },
  { icon: '💬', title: 'Support dédié', desc: 'Un gestionnaire de compte à votre disposition.' },
];

const plans = [
  {
    name: 'Starter',
    price: '499',
    period: '/mois',
    features: ['Jusqu\'à 25 employés', '50 formations', 'Tableaux de bord', 'Support par courriel'],
    cta: 'Commencer',
    popular: false,
  },
  {
    name: 'Business',
    price: '1499',
    period: '/mois',
    features: ['Jusqu\'à 100 employés', 'Toutes les formations', 'Formations personnalisées', 'Support prioritaire', 'API', 'SSO'],
    cta: 'Commencer',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Sur mesure',
    period: '',
    features: ['Employés illimités', 'Formations exclusives', 'Contenu sur mesure', 'Gestionnaire dédié', 'SLA garanti', 'On-premise possible'],
    cta: 'Contactez-nous',
    popular: false,
  },
];

export default function EnterpriseSolutionsPage() {
  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '80px 24px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 600, opacity: 0.8, display: 'block', marginBottom: '16px' }}>
              SOLUTIONS ENTREPRISES
            </span>
            <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
              Développez les compétences de vos équipes
            </h1>
            <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7, marginBottom: '32px' }}>
              Une plateforme complète pour gérer la formation de vos employés, 
              suivre leur progression et mesurer l'impact sur votre organisation.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Link href="/demo" className="btn" style={{ backgroundColor: 'white', color: 'var(--gray-500)', padding: '14px 28px' }}>
                Demander une démo
              </Link>
              <Link href="/contact" className="btn" style={{ border: '2px solid white', color: 'white', padding: '14px 28px' }}>
                Nous contacter
              </Link>
            </div>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '16px', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '80px' }}>🏢</span>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--gray-500)' }}>
            Tout ce dont vous avez besoin
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            {benefits.map((benefit, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  padding: '32px',
                  borderRadius: '12px',
                  display: 'flex',
                  gap: '16px',
                }}
              >
                <span style={{ fontSize: '32px' }}>{benefit.icon}</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
                    {benefit.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6 }}>{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ backgroundColor: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: 'var(--gray-500)' }}>
            Tarification simple et transparente
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', textAlign: 'center', marginBottom: '48px' }}>
            Choisissez le plan adapté à la taille de votre entreprise.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
            }}
          >
            {plans.map((plan, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: plan.popular ? 'var(--gray-500)' : 'var(--gray-50)',
                  color: plan.popular ? 'white' : 'inherit',
                  padding: '40px',
                  borderRadius: '16px',
                  position: 'relative',
                }}
              >
                {plan.popular && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#22c55e',
                      color: 'white',
                      padding: '4px 16px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    POPULAIRE
                  </span>
                )}
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>{plan.name}</h3>
                <p style={{ fontSize: '40px', fontWeight: 700, marginBottom: '8px' }}>
                  {plan.price.startsWith('Sur') ? plan.price : `$${plan.price}`}
                  <span style={{ fontSize: '16px', fontWeight: 400, opacity: 0.7 }}>{plan.period}</span>
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0' }}>
                  {plan.features.map((feature, j) => (
                    <li
                      key={j}
                      style={{
                        padding: '10px 0',
                        borderTop: j === 0 ? 'none' : `1px solid ${plan.popular ? 'rgba(255,255,255,0.1)' : 'var(--gray-200)'}`,
                        fontSize: '14px',
                      }}
                    >
                      ✓ {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.price.startsWith('Sur') ? '/contact' : '/auth/signup?plan=' + plan.name.toLowerCase()}
                  className="btn"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px',
                    backgroundColor: plan.popular ? 'white' : 'var(--gray-500)',
                    color: plan.popular ? 'var(--gray-500)' : 'white',
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Logos */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '32px' }}>
          Ils nous font confiance
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '48px', opacity: 0.5 }}>
          {['Desjardins', 'Hydro-Québec', 'Bell', 'Bombardier', 'CGI'].map((company, i) => (
            <span key={i} style={{ fontSize: '20px', fontWeight: 600, color: 'var(--gray-400)' }}>{company}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
