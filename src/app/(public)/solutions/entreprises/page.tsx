/**
 * PAGE SOLUTIONS ENTREPRISES
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Solutions peptidiques pour entreprises et laboratoires | Koraline',
  description: 'Approvisionnement en produits pour entreprises et laboratoires. Volume, comptes dedies, support technique et livraison rapide au Canada.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/solutions/entreprises`,
  },
  openGraph: {
    title: 'Solutions peptidiques pour entreprises et laboratoires | Koraline',
    description: 'Approvisionnement en produits pour entreprises et laboratoires. Volume, comptes dedies et support technique.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/solutions/entreprises`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solutions peptidiques pour entreprises et laboratoires | Koraline',
    description: 'Approvisionnement en produits pour entreprises et laboratoires. Volume, comptes dedies et support technique.',
  },
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
    <div style={{ background: 'var(--k-bg-base, #0a0a0f)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.10) 100%)',
          borderBottom: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
          padding: '80px 24px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', display: 'block', marginBottom: '16px', letterSpacing: '0.08em' }}>
              SOLUTIONS ENTREPRISES
            </span>
            <h1 className="font-heading" style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
              Développez les compétences de vos équipes
            </h1>
            <p style={{ fontSize: '18px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', lineHeight: 1.7, marginBottom: '32px' }}>
              Une plateforme complète pour gérer la formation de vos employés,
              suivre leur progression et mesurer l'impact sur votre organisation.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Link
                href="/demo"
                className="btn"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.20)',
                  color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                  padding: '14px 28px',
                  backdropFilter: 'blur(8px)',
                }}
              >
                Demander une démo
              </Link>
              <Link
                href="/contact"
                className="btn"
                style={{
                  border: '2px solid rgba(255,255,255,0.30)',
                  color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                  padding: '14px 28px',
                  background: 'transparent',
                }}
              >
                Nous contacter
              </Link>
            </div>
          </div>
          <div
            style={{
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              border: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              aspectRatio: '4/3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '80px' }}>🏢</span>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
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
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  border: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
                  backdropFilter: 'blur(20px)',
                  padding: '32px',
                  borderRadius: '12px',
                  display: 'flex',
                  gap: '16px',
                }}
              >
                <span style={{ fontSize: '32px' }}>{benefit.icon}</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
                    {benefit.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', lineHeight: 1.6 }}>{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        style={{
          background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
          borderTop: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          borderBottom: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          padding: '80px 24px',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            Tarification simple et transparente
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', textAlign: 'center', marginBottom: '48px' }}>
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
                  background: plan.popular
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.30) 0%, rgba(168,85,247,0.20) 100%)'
                    : 'rgba(255,255,255,0.04)',
                  border: plan.popular
                    ? '1px solid rgba(99,102,241,0.50)'
                    : '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
                  backdropFilter: 'blur(20px)',
                  color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
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
                        borderTop: j === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                        fontSize: '14px',
                        color: 'var(--k-text-secondary, rgba(255,255,255,0.60))',
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
                    background: plan.popular
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(99,102,241,0.20)',
                    border: plan.popular
                      ? '1px solid rgba(255,255,255,0.25)'
                      : '1px solid rgba(99,102,241,0.40)',
                    color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                    borderRadius: '10px',
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
        <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', marginBottom: '32px' }}>
          Ils nous font confiance
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '48px', opacity: 0.5 }}>
          {['Desjardins', 'Hydro-Québec', 'Bell', 'Bombardier', 'CGI'].map((company, i) => (
            <span key={i} style={{ fontSize: '20px', fontWeight: 600, color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{company}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
