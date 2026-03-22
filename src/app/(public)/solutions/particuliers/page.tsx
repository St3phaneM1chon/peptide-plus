/**
 * PAGE SOLUTIONS PARTICULIERS
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Peptides de recherche pour chercheurs individuels | BioCycle Peptides',
  description: 'Commandez des peptides de recherche en petites quantites. Guides de reconstitution, certificats d\'analyse et support technique pour chercheurs.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/solutions/particuliers`,
  },
  openGraph: {
    title: 'Peptides de recherche pour chercheurs individuels | BioCycle Peptides',
    description: 'Commandez des peptides de recherche en petites quantites. Guides de reconstitution, certificats d\'analyse et support technique.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/solutions/particuliers`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peptides de recherche pour chercheurs individuels | BioCycle Peptides',
    description: 'Commandez des peptides de recherche en petites quantites. Guides de reconstitution, certificats d\'analyse et support technique.',
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
            SOLUTIONS PARTICULIERS
          </span>
          <h1 className="font-heading" style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            Boostez votre carrière
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7, marginBottom: '32px' }}>
            Des formations conçues pour vous aider à acquérir de nouvelles compétences, 
            obtenir des certifications reconnues et atteindre vos objectifs professionnels.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link href="/catalogue" className="btn" style={{ backgroundColor: 'white', color: 'var(--gray-500)', padding: '14px 28px' }}>
              Explorer les formations
            </Link>
            <Link href="/auth/signup" className="btn" style={{ border: '2px solid white', color: 'white', padding: '14px 28px' }}>
              Créer un compte gratuit
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--gray-500)' }}>
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

      {/* Categories */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px', color: 'var(--gray-500)' }}>
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
                  padding: '24px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>{cat.icon}</span>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                  {cat.name}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{cat.count} formations</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--gray-500)' }}>
            Options d'achat flexibles
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>🎓</span>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
                À l'unité
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '16px' }}>
                Achetez les formations qui vous intéressent, une à une.
              </p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gray-500)' }}>À partir de $49</p>
            </div>
            <div style={{ backgroundColor: 'var(--gray-500)', color: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>⭐</span>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                Abonnement Pro
              </h3>
              <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '16px' }}>
                Accès illimité à toutes les formations.
              </p>
              <p style={{ fontSize: '28px', fontWeight: 700 }}>$29/mois</p>
            </div>
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>🎁</span>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
                Parcours certifiant
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '16px' }}>
                Ensemble de cours menant à une certification.
              </p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gray-500)' }}>À partir de $299</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Prêt à commencer?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Créez votre compte gratuit et explorez nos formations.
        </p>
        <Link href="/auth/signup" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Commencer gratuitement
        </Link>
      </section>
    </div>
  );
}
