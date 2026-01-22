/**
 * PAGE HISTOIRE
 */

export const metadata = {
  title: 'Notre Histoire | Formations Pro',
  description: 'Découvrez le parcours et l\'évolution de notre entreprise depuis sa création.',
};

const timeline = [
  {
    year: '2014',
    title: 'Les débuts',
    description: 'Fondation de l\'entreprise avec une vision simple: rendre la formation professionnelle accessible à tous.',
    icon: '🌱',
  },
  {
    year: '2016',
    title: 'Première plateforme en ligne',
    description: 'Lancement de notre plateforme d\'apprentissage en ligne, permettant aux apprenants de se former à leur rythme.',
    icon: '💻',
  },
  {
    year: '2018',
    title: 'Expansion nationale',
    description: 'Ouverture de bureaux à Toronto et Vancouver. Plus de 10 000 apprenants formés.',
    icon: '🚀',
  },
  {
    year: '2020',
    title: 'Adaptation et croissance',
    description: 'Face à la pandémie, nous avons accéléré notre transformation digitale et triplé notre offre de formations.',
    icon: '📈',
  },
  {
    year: '2022',
    title: 'Certifications reconnues',
    description: 'Obtention de certifications internationales et partenariats avec des organisations prestigieuses.',
    icon: '🏆',
  },
  {
    year: '2024',
    title: 'Innovation continue',
    description: 'Intégration de l\'IA dans nos parcours d\'apprentissage et lancement de programmes sur mesure pour les entreprises.',
    icon: '🤖',
  },
  {
    year: '2026',
    title: 'Aujourd\'hui',
    description: 'Plus de 50 000 professionnels formés, 200+ formations et une équipe de 35 experts passionnés.',
    icon: '⭐',
  },
];

export default function HistoryPage() {
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
            Notre Histoire
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Plus de 10 ans d'innovation et d'engagement au service de la formation professionnelle.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {timeline.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '24px',
                marginBottom: i === timeline.length - 1 ? 0 : '48px',
                position: 'relative',
              }}
            >
              {/* Line */}
              {i !== timeline.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '28px',
                    top: '60px',
                    width: '2px',
                    height: 'calc(100% + 24px)',
                    backgroundColor: 'var(--gray-200)',
                  }}
                />
              )}

              {/* Icon */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  border: '2px solid var(--gray-200)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0,
                  zIndex: 1,
                }}
              >
                {item.icon}
              </div>

              {/* Content */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', flex: 1 }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    backgroundColor: 'var(--gray-100)',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--gray-500)',
                    marginBottom: '12px',
                  }}
                >
                  {item.year}
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '15px', color: 'var(--gray-400)', lineHeight: 1.7 }}>
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quote */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px' }}>"</span>
          <blockquote style={{ fontSize: '20px', fontStyle: 'italic', color: 'var(--gray-500)', lineHeight: 1.7, marginBottom: '24px' }}>
            Chaque personne mérite d'avoir accès aux outils et aux connaissances nécessaires pour 
            réaliser son plein potentiel professionnel. C'est cette conviction qui nous guide depuis le premier jour.
          </blockquote>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
            — <strong>Marie Dupont</strong>, Fondatrice & PDG
          </p>
        </div>
      </section>
    </div>
  );
}
