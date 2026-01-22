/**
 * PAGE CARRIÈRES
 * Liste des postes ouverts et culture d'entreprise
 */

import Link from 'next/link';

export const metadata = {
  title: 'Carrières | Formations Pro',
  description: 'Rejoignez notre équipe! Découvrez nos offres d\'emploi et notre culture d\'entreprise.',
};

// Mock data - à remplacer par API
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
            Rejoignez notre équipe
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Nous recherchons des talents passionnés pour construire l'avenir de la formation professionnelle.
          </p>
        </div>
      </section>

      {/* Culture */}
      <section style={{ padding: '80px 24px', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
              Pourquoi nous rejoindre?
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--gray-400)', maxWidth: '600px', margin: '0 auto' }}>
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
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                }}
              >
                <span style={{ fontSize: '32px' }}>{benefit.icon}</span>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--gray-500)' }}>
                    {benefit.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{benefit.desc}</p>
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
            <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
              Postes ouverts
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
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
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid var(--gray-200)',
                  textDecoration: 'none',
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
                      {job.title}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', color: 'var(--gray-400)' }}>
                      <span>📁 {job.department}</span>
                      <span>📍 {job.location}</span>
                      <span>⏰ {job.type}</span>
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--gray-100)',
                      borderRadius: '20px',
                      fontSize: '13px',
                      color: 'var(--gray-500)',
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
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '2px dashed var(--gray-200)',
              textAlign: 'center',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
              Candidature spontanée
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '16px' }}>
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
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px' }}>🌟</span>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
            Nos valeurs au quotidien
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.7 }}>
            Transparence, innovation et collaboration sont au cœur de notre culture. 
            Nous croyons en l'autonomie, la prise d'initiative et le respect mutuel.
          </p>
        </div>
      </section>
    </div>
  );
}
