'use client';

/**
 * PAGE CARRIÈRES
 * Liste des postes ouverts et culture d'entreprise
 */

import Link from 'next/link';

// metadata moved to layout for client components

// Static job listings - update manually or add a Job model to DB for dynamic management
const openPositions = [
  {
    id: '1',
    title: 'Développeur Full Stack Senior',
    department: 'Technologie',
    location: 'Montréal, QC (Hybride)',
    type: 'Temps plein',
    posted: '2026-01-15',
  },
  {
    id: '2',
    title: 'Concepteur pédagogique',
    department: 'Contenu',
    location: 'Télétravail',
    type: 'Temps plein',
    posted: '2026-01-10',
  },
  {
    id: '3',
    title: 'Responsable Marketing Digital',
    department: 'Marketing',
    location: 'Montréal, QC',
    type: 'Temps plein',
    posted: '2026-01-08',
  },
  {
    id: '4',
    title: 'Agent de service à la clientèle',
    department: 'Support',
    location: 'Télétravail',
    type: 'Temps partiel',
    posted: '2026-01-05',
  },
];

const benefits = [
  { icon: '💰', title: 'Salaire compétitif', desc: 'Rémunération alignée sur le marché' },
  { icon: '🏠', title: 'Travail flexible', desc: 'Télétravail et horaires flexibles' },
  { icon: '🎓', title: 'Formation continue', desc: 'Accès illimité à nos formations' },
  { icon: '🏥', title: 'Assurances complètes', desc: 'Santé, dentaire et vision' },
  { icon: '🌴', title: '4 semaines de vacances', desc: 'Dès la première année' },
  { icon: '💪', title: 'Programme bien-être', desc: 'Gym, yoga et santé mentale' },
];

export default function CareersPage() {
  return (
    <div style={{ background: 'var(--k-bg-base, #0a0a0f)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(168,85,247,0.15) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          color: 'white',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 className="font-heading" style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            Rejoignez notre équipe
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Nous recherchons des talents passionnés pour construire l'avenir de la formation professionnelle.
          </p>
        </div>
      </section>

      {/* Culture */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', color: 'var(--k-text-primary)' }}>
              Pourquoi nous rejoindre?
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--k-text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              Une culture d'entreprise axée sur l'innovation, la collaboration et le bien-être.
            </p>
          </div>

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
                  display: 'flex',
                  gap: '16px',
                  padding: '24px',
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                }}
              >
                <span style={{ fontSize: '32px' }}>{benefit.icon}</span>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--k-text-primary)' }}>
                    {benefit.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--k-text-secondary)' }}>{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', color: 'var(--k-text-primary)' }}>
              Postes ouverts
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--k-text-secondary)' }}>
              {openPositions.length} postes disponibles actuellement
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {openPositions.map((job) => (
              <Link
                key={job.id}
                href={`/carrieres/${job.id}`}
                style={{
                  display: 'block',
                  padding: '24px',
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--k-text-primary)' }}>
                      {job.title}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', color: 'var(--k-text-secondary)' }}>
                      <span>📁 {job.department}</span>
                      <span>📍 {job.location}</span>
                      <span>⏰ {job.type}</span>
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '20px',
                      fontSize: '13px',
                      color: 'var(--k-text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    Voir le poste →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Spontaneous application */}
          <div
            style={{
              marginTop: '48px',
              padding: '32px',
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              backdropFilter: 'blur(12px)',
              borderRadius: '12px',
              border: '2px dashed rgba(255,255,255,0.15)',
              textAlign: 'center',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--k-text-primary)' }}>
              Candidature spontanée
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--k-text-secondary)', marginBottom: '16px' }}>
              Vous ne trouvez pas le poste idéal? Envoyez-nous votre CV!
            </p>
            <Link
              href="/contact?subject=careers"
              className="btn btn-secondary"
            >
              Postuler spontanément
            </Link>
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px' }}>🌟</span>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--k-text-primary)' }}>
            Nos valeurs au quotidien
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--k-text-secondary)', lineHeight: 1.7 }}>
            Transparence, innovation et collaboration sont au cœur de notre culture.
            Nous croyons en l'autonomie, la prise d'initiative et le respect mutuel.
          </p>
        </div>
      </section>
    </div>
  );
}
