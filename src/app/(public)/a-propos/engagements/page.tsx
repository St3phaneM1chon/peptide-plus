/**
 * PAGE ENGAGEMENTS (RSE, ESG, Diversité)
 */

import Link from 'next/link';

export const metadata = {
  title: 'Nos Engagements | Formations Pro',
  description: 'Découvrez nos engagements en matière de responsabilité sociale, environnementale et de diversité.',
};

const commitments = [
  {
    category: 'Environnement',
    icon: '🌍',
    color: '#22c55e',
    items: [
      { title: 'Neutralité carbone d\'ici 2027', progress: 65 },
      { title: '100% énergie renouvelable pour nos serveurs', progress: 100 },
      { title: 'Zéro papier dans nos processus', progress: 90 },
      { title: 'Partenariat avec 1% for the Planet', progress: 100 },
    ],
  },
  {
    category: 'Social',
    icon: '❤️',
    color: '#ef4444',
    items: [
      { title: '500 bourses de formation par an', progress: 80 },
      { title: 'Partenariat avec des organismes d\'insertion', progress: 100 },
      { title: 'Programme de mentorat pour les jeunes', progress: 70 },
      { title: 'Formations gratuites pour les chômeurs', progress: 100 },
    ],
  },
  {
    category: 'Diversité & Inclusion',
    icon: '🌈',
    color: '#8b5cf6',
    items: [
      { title: 'Parité hommes/femmes dans l\'équipe', progress: 95 },
      { title: 'Accessibilité pour les personnes handicapées', progress: 85 },
      { title: 'Contenu disponible en 8 langues', progress: 75 },
      { title: 'Formation sur les biais inconscients', progress: 100 },
    ],
  },
  {
    category: 'Éthique',
    icon: '⚖️',
    color: '#3b82f6',
    items: [
      { title: 'Protection maximale des données', progress: 100 },
      { title: 'IA éthique et transparente', progress: 80 },
      { title: 'Chaîne d\'approvisionnement responsable', progress: 90 },
      { title: 'Politique anti-corruption stricte', progress: 100 },
    ],
  },
];

const certifications = [
  { name: 'B Corp', logo: '🅱️' },
  { name: 'ISO 14001', logo: '🌿' },
  { name: 'ISO 27001', logo: '🔒' },
  { name: '1% for the Planet', logo: '🌍' },
];

export default function CommitmentsPage() {
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
            Nos Engagements
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Notre responsabilité va au-delà de la formation. Nous nous engageons pour un impact 
            positif sur la société et l'environnement.
          </p>
        </div>
      </section>

      {/* Commitments */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '32px',
            }}
          >
            {commitments.map((commitment, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '24px',
                    borderBottom: '1px solid var(--gray-100)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '32px' }}>{commitment.icon}</span>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--gray-500)' }}>
                    {commitment.category}
                  </h2>
                </div>
                <div style={{ padding: '24px' }}>
                  {commitment.items.map((item, j) => (
                    <div key={j} style={{ marginBottom: j === commitment.items.length - 1 ? 0 : '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>{item.title}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: commitment.color }}>
                          {item.progress}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          backgroundColor: 'var(--gray-100)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${item.progress}%`,
                            height: '100%',
                            backgroundColor: commitment.color,
                            borderRadius: '3px',
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
            Nos certifications
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '40px' }}>
            Des standards reconnus internationalement qui attestent de notre engagement.
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '32px',
            }}
          >
            {certifications.map((cert, i) => (
              <div
                key={i}
                style={{
                  padding: '24px 32px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px' }}>{cert.logo}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)' }}>{cert.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Rapport RSE 2025
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Consultez notre rapport annuel de responsabilité sociale et environnementale.
        </p>
        <Link href="/rapport-rse-2025.pdf" className="btn btn-secondary" style={{ padding: '14px 32px' }}>
          Télécharger le rapport (PDF)
        </Link>
      </section>
    </div>
  );
}
