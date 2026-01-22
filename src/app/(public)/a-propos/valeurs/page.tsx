/**
 * PAGE VALEURS
 */

export const metadata = {
  title: 'Nos Valeurs | Formations Pro',
  description: 'Les valeurs fondamentales qui guident nos actions et nos décisions.',
};

const values = [
  {
    icon: '🎓',
    title: 'Excellence',
    description: 'Nous visons l\'excellence dans tout ce que nous faisons. Chaque formation, chaque interaction, chaque décision est guidée par notre quête de qualité.',
    principles: [
      'Contenu créé par des experts reconnus',
      'Mise à jour continue des formations',
      'Évaluation rigoureuse des apprentissages',
      'Amélioration constante de nos processus',
    ],
  },
  {
    icon: '🤝',
    title: 'Intégrité',
    description: 'Nous agissons avec honnêteté et transparence dans toutes nos relations. La confiance de nos clients et partenaires est notre bien le plus précieux.',
    principles: [
      'Transparence dans nos tarifs',
      'Communication honnête',
      'Respect des engagements',
      'Protection des données personnelles',
    ],
  },
  {
    icon: '💡',
    title: 'Innovation',
    description: 'Nous embrassons le changement et cherchons constamment de nouvelles façons d\'améliorer l\'expérience d\'apprentissage.',
    principles: [
      'Veille technologique continue',
      'Expérimentation de nouvelles méthodes',
      'Écoute active des besoins',
      'Adaptation rapide aux évolutions',
    ],
  },
  {
    icon: '🌱',
    title: 'Croissance',
    description: 'Nous croyons au potentiel de chaque individu et nous nous engageons à accompagner leur développement professionnel.',
    principles: [
      'Parcours personnalisés',
      'Suivi de progression',
      'Mentorat et accompagnement',
      'Certification des compétences',
    ],
  },
  {
    icon: '🌍',
    title: 'Accessibilité',
    description: 'Nous travaillons pour rendre la formation professionnelle accessible au plus grand nombre, sans barrières géographiques ou financières.',
    principles: [
      'Formations en ligne disponibles 24/7',
      'Tarifs adaptés',
      'Contenu multilingue',
      'Support inclusif',
    ],
  },
  {
    icon: '♻️',
    title: 'Responsabilité',
    description: 'Nous assumons notre responsabilité sociale et environnementale, en contribuant positivement à la société.',
    principles: [
      'Réduction de notre empreinte carbone',
      'Diversité et inclusion',
      'Partenariats avec des organismes sociaux',
      'Formations gratuites pour les demandeurs d\'emploi',
    ],
  },
];

export default function ValuesPage() {
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
            Nos Valeurs
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Les principes fondamentaux qui guident chacune de nos actions et définissent qui nous sommes.
          </p>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {values.map((value, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '40px',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '32px',
                  alignItems: 'start',
                }}
              >
                <span
                  style={{
                    fontSize: '48px',
                    width: '80px',
                    height: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--gray-50)',
                    borderRadius: '16px',
                  }}
                >
                  {value.icon}
                </span>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', color: 'var(--gray-500)' }}>
                    {value.title}
                  </h2>
                  <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: '20px' }}>
                    {value.description}
                  </p>
                  <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', listStyle: 'none', padding: 0 }}>
                    {value.principles.map((principle, j) => (
                      <li
                        key={j}
                        style={{
                          fontSize: '14px',
                          color: 'var(--gray-500)',
                          padding: '8px 12px',
                          backgroundColor: 'var(--gray-50)',
                          borderRadius: '6px',
                        }}
                      >
                        ✓ {principle}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <p style={{ fontSize: '18px', color: 'var(--gray-500)', lineHeight: 1.7 }}>
            Ces valeurs ne sont pas que des mots sur une page. Elles sont le reflet de notre culture, 
            de nos actions quotidiennes et de notre engagement envers vous.
          </p>
        </div>
      </section>
    </div>
  );
}
