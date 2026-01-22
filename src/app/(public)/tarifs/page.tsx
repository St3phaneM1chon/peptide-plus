/**
 * PAGE TARIFS
 */

import Link from 'next/link';

export const metadata = {
  title: 'Tarifs | Formations Pro',
  description: 'Découvrez nos plans et tarifs pour particuliers et entreprises.',
};

const individualPlans = [
  {
    name: 'Gratuit',
    price: '0',
    period: '',
    description: 'Pour découvrir la plateforme',
    features: ['5 formations gratuites', 'Accès limité aux ressources', 'Certificats basiques', 'Support par email'],
    cta: 'Commencer',
    href: '/auth/signup',
    popular: false,
  },
  {
    name: 'Pro',
    price: '29',
    period: '/mois',
    description: 'Pour les professionnels ambitieux',
    features: ['Accès illimité aux formations', 'Toutes les ressources', 'Certificats reconnus', 'Support prioritaire', 'Téléchargements'],
    cta: 'Essai gratuit 14 jours',
    href: '/auth/signup?plan=pro',
    popular: true,
  },
  {
    name: 'Annuel',
    price: '249',
    period: '/an',
    description: 'Économisez 30% avec le plan annuel',
    features: ['Tout du plan Pro', '2 mois offerts', 'Parcours certifiants', 'Coaching mensuel', 'Accès anticipé'],
    cta: 'Économiser 30%',
    href: '/auth/signup?plan=annual',
    popular: false,
  },
];

const enterprisePlans = [
  {
    name: 'Starter',
    price: '499',
    period: '/mois',
    description: 'Pour les petites équipes',
    employees: 'Jusqu\'à 25 employés',
    features: ['50 formations', 'Tableaux de bord', 'Rapports basiques', 'Support email'],
  },
  {
    name: 'Business',
    price: '1499',
    period: '/mois',
    description: 'Pour les entreprises en croissance',
    employees: 'Jusqu\'à 100 employés',
    features: ['Toutes les formations', 'SSO / SAML', 'API', 'Support prioritaire', 'Gestionnaire dédié'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Sur mesure',
    period: '',
    description: 'Pour les grandes organisations',
    employees: 'Illimité',
    features: ['Formations personnalisées', 'On-premise possible', 'SLA garanti', 'Intégrations', 'Formation des formateurs'],
  },
];

export default function PricingPage() {
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
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>
          Tarifs simples et transparents
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          Choisissez le plan adapté à vos besoins. Sans engagement.
        </p>
      </section>

      {/* Individual Plans */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: 'var(--gray-500)' }}>
            Pour les particuliers
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', textAlign: 'center', marginBottom: '48px' }}>
            Développez vos compétences à votre rythme.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {individualPlans.map((plan, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: plan.popular ? 'var(--gray-500)' : 'white',
                  color: plan.popular ? 'white' : 'inherit',
                  borderRadius: '16px',
                  padding: '40px',
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
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>{plan.name}</h3>
                <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '16px' }}>{plan.description}</p>
                <p style={{ fontSize: '48px', fontWeight: 700, marginBottom: '24px' }}>
                  ${plan.price}
                  <span style={{ fontSize: '16px', fontWeight: 400, opacity: 0.7 }}>{plan.period}</span>
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                  {plan.features.map((feature, j) => (
                    <li
                      key={j}
                      style={{
                        padding: '10px 0',
                        borderTop: j === 0 ? 'none' : `1px solid ${plan.popular ? 'rgba(255,255,255,0.1)' : 'var(--gray-100)'}`,
                        fontSize: '14px',
                      }}
                    >
                      ✓ {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
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

      {/* Enterprise Plans */}
      <section style={{ backgroundColor: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: 'var(--gray-500)' }}>
            Pour les entreprises
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', textAlign: 'center', marginBottom: '48px' }}>
            Solutions complètes pour former vos équipes.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {enterprisePlans.map((plan, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: plan.popular ? 'var(--gray-500)' : 'var(--gray-50)',
                  color: plan.popular ? 'white' : 'inherit',
                  borderRadius: '16px',
                  padding: '40px',
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
                    RECOMMANDÉ
                  </span>
                )}
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>{plan.name}</h3>
                <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>{plan.description}</p>
                <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '16px' }}>{plan.employees}</p>
                <p style={{ fontSize: '40px', fontWeight: 700, marginBottom: '24px' }}>
                  {plan.price.startsWith('Sur') ? plan.price : `$${plan.price}`}
                  <span style={{ fontSize: '16px', fontWeight: 400, opacity: 0.7 }}>{plan.period}</span>
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                  {plan.features.map((feature, j) => (
                    <li
                      key={j}
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                      }}
                    >
                      ✓ {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.price.startsWith('Sur') ? '/contact' : '/demo'}
                  className="btn"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px',
                    backgroundColor: plan.popular ? 'white' : 'var(--gray-500)',
                    color: plan.popular ? 'var(--gray-500)' : 'white',
                  }}
                >
                  {plan.price.startsWith('Sur') ? 'Contactez-nous' : 'Demander une démo'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Questions sur les tarifs?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Consultez notre FAQ ou contactez-nous.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/faq" className="btn btn-secondary">
            Voir la FAQ
          </Link>
          <Link href="/contact" className="btn btn-primary">
            Nous contacter
          </Link>
        </div>
      </section>
    </div>
  );
}
