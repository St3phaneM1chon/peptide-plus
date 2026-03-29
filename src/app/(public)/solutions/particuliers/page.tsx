/**
 * PAGE SOLUTIONS PARTICULIERS
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'produits pour chercheurs individuels | Koraline',
  description: 'Commandez des produits en petites quantites. Guides de reconstitution, certificats d\'analyse et support technique pour chercheurs.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/solutions/particuliers`,
  },
  openGraph: {
    title: 'produits pour chercheurs individuels | Koraline',
    description: 'Commandez des produits en petites quantites. Guides de reconstitution, certificats d\'analyse et support technique.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/solutions/particuliers`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'produits pour chercheurs individuels | Koraline',
    description: 'Commandez des produits en petites quantites. Guides de reconstitution, certificats d\'analyse et support technique.',
  },
};

const benefits = [
  { icon: '🕐', title: 'Apprenez à votre rythme', desc: 'Accédez aux cours 24/7, depuis n\'importe où.' },
  { icon: '📜', title: 'Certifications reconnues', desc: 'Obtenez des certifications valorisées par les employeurs.' },
  { icon: '👨‍🏫', title: 'Experts du domaine', desc: 'Apprenez auprès de professionnels expérimentés.' },
  { icon: '💼', title: 'Axé sur l\'emploi', desc: 'Compétences directement applicables en entreprise.' },
  { icon: '🎯', title: 'Parcours personnalisé', desc: 'Recommandations basées sur vos objectifs.' },
  { icon: '💬', title: 'Communauté active', desc: 'Échangez avec d\'autres apprenants et mentors.' },
];

const categories = [
  { name: 'Développement web', count: 45, icon: '💻' },
  { name: 'Marketing digital', count: 32, icon: '📱' },
  { name: 'Gestion de projet', count: 28, icon: '📋' },
  { name: 'Leadership', count: 24, icon: '🎯' },
  { name: 'Vente & négociation', count: 31, icon: '🤝' },
  { name: 'Finance personnelle', count: 18, icon: '💰' },
];

export default function IndividualSolutionsPage() {
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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', display: 'block', marginBottom: '16px', letterSpacing: '0.08em' }}>
            SOLUTIONS PARTICULIERS
          </span>
          <h1 className="font-heading" style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            Boostez votre carrière
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', lineHeight: 1.7, marginBottom: '32px' }}>
            Des formations conçues pour vous aider à acquérir de nouvelles compétences,
            obtenir des certifications reconnues et atteindre vos objectifs professionnels.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link
              href="/catalogue"
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.20)',
                color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                padding: '14px 28px',
                backdropFilter: 'blur(8px)',
              }}
            >
              Explorer les formations
            </Link>
            <Link
              href="/auth/signup"
              className="btn"
              style={{
                border: '2px solid rgba(255,255,255,0.30)',
                color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                padding: '14px 28px',
                background: 'transparent',
              }}
            >
              Créer un compte gratuit
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            Pourquoi nous choisir?
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

      {/* Categories */}
      <section
        style={{
          background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
          borderTop: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          borderBottom: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          padding: '64px 24px',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            Catégories populaires
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '16px',
            }}
          >
            {categories.map((cat, i) => (
              <Link
                key={i}
                href={`/catalogue?categorie=${encodeURIComponent(cat.name)}`}
                style={{
                  display: 'block',
                  padding: '24px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
                  borderRadius: '12px',
                  textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>{cat.icon}</span>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--k-text-primary, rgba(255,255,255,0.95))', marginBottom: '4px' }}>
                  {cat.name}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{cat.count} formations</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            Options d'achat flexibles
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
                backdropFilter: 'blur(20px)',
                padding: '40px',
                borderRadius: '16px',
                textAlign: 'center',
                color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
              }}
            >
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>🎓</span>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                À l'unité
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', marginBottom: '16px' }}>
                Achetez les formations qui vous intéressent, une à une.
              </p>
              <p style={{ fontSize: '28px', fontWeight: 700 }}>À partir de $49</p>
            </div>
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.30) 0%, rgba(168,85,247,0.20) 100%)',
                border: '1px solid rgba(99,102,241,0.50)',
                backdropFilter: 'blur(20px)',
                padding: '40px',
                borderRadius: '16px',
                textAlign: 'center',
                color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                position: 'relative',
              }}
            >
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
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>⭐</span>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                Abonnement Pro
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', marginBottom: '16px' }}>
                Accès illimité à toutes les formations.
              </p>
              <p style={{ fontSize: '28px', fontWeight: 700 }}>$29/mois</p>
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
                backdropFilter: 'blur(20px)',
                padding: '40px',
                borderRadius: '16px',
                textAlign: 'center',
                color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
              }}
            >
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>🎁</span>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                Parcours certifiant
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', marginBottom: '16px' }}>
                Ensemble de cours menant à une certification.
              </p>
              <p style={{ fontSize: '28px', fontWeight: 700 }}>À partir de $299</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
          borderTop: '1px solid var(--k-border-subtle, rgba(255,255,255,0.06))',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
          Prêt à commencer?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', marginBottom: '24px' }}>
          Créez votre compte gratuit et explorez nos formations.
        </p>
        <Link href="/auth/signup" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Commencer gratuitement
        </Link>
      </section>
    </div>
  );
}
