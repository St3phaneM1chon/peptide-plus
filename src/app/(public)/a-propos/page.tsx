/**
 * PAGE À PROPOS
 * Présentation de l'entreprise
 */

import Link from 'next/link';

export const metadata = {
  title: 'À propos | Formations Pro',
  description: 'Découvrez notre mission, notre équipe et nos valeurs.',
};

export default function AboutPage() {
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
            À propos de nous
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Depuis plus de 10 ans, nous accompagnons les professionnels dans leur 
            développement de compétences avec des formations de qualité.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '48px',
              alignItems: 'center',
            }}
          >
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  backgroundColor: 'var(--gray-100)',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--gray-500)',
                  marginBottom: '16px',
                }}
              >
                Notre mission
              </span>
              <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '24px', color: 'var(--gray-500)' }}>
                Rendre l'excellence accessible à tous
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.8, marginBottom: '24px' }}>
                Nous croyons que chaque professionnel mérite d'avoir accès à des formations 
                de qualité pour développer ses compétences et atteindre ses objectifs.
              </p>
              <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.8 }}>
                Notre approche pédagogique innovante combine théorie et pratique pour 
                garantir un apprentissage efficace et durable.
              </p>
            </div>
            <div
              style={{
                backgroundColor: 'var(--gray-200)',
                borderRadius: '16px',
                aspectRatio: '4/3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '64px' }}>🎯</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '32px',
              textAlign: 'center',
            }}
          >
            {[
              { value: '10+', label: 'Années d\'expérience' },
              { value: '50K+', label: 'Professionnels formés' },
              { value: '200+', label: 'Formations disponibles' },
              { value: '98%', label: 'Taux de satisfaction' },
            ].map((stat, i) => (
              <div key={i}>
                <p style={{ fontSize: '48px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '8px' }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '48px',
              color: 'var(--gray-500)',
            }}
          >
            Nos valeurs
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
            }}
          >
            {[
              { icon: '🎓', title: 'Excellence', desc: 'Nous visons l\'excellence dans tout ce que nous faisons.' },
              { icon: '🤝', title: 'Accompagnement', desc: 'Un suivi personnalisé pour chaque apprenant.' },
              { icon: '💡', title: 'Innovation', desc: 'Des méthodes pédagogiques modernes et efficaces.' },
              { icon: '🌱', title: 'Croissance', desc: 'Votre développement professionnel est notre priorité.' },
            ].map((value, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  padding: '32px',
                  borderRadius: '12px',
                  border: '1px solid var(--gray-200)',
                }}
              >
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>{value.icon}</span>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-500)' }}>
                  {value.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6 }}>{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team CTA */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
            Rencontrez notre équipe
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            Des experts passionnés dédiés à votre réussite.
          </p>
          <Link
            href="/a-propos/equipe"
            className="btn btn-primary"
            style={{ display: 'inline-block', padding: '14px 32px' }}
          >
            Découvrir l'équipe
          </Link>
        </div>
      </section>
    </div>
  );
}
