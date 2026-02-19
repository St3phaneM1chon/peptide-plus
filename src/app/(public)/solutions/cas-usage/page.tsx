/**
 * PAGE CAS D'USAGE
 */

import Link from 'next/link';

export const metadata = {
  title: 'Cas d\'usage | Formations Pro',
  description: 'Découvrez comment nos formations répondent à vos défis spécifiques.',
};

const useCases = [
  {
    title: 'Intégration des nouveaux employés',
    icon: '🚀',
    challenge: 'Comment accélérer l\'intégration et la montée en compétences des nouvelles recrues?',
    solution: 'Parcours d\'onboarding structurés combinant formations techniques et culture d\'entreprise.',
    results: ['Réduction de 40% du temps d\'intégration', 'Amélioration de la rétention à 6 mois', 'Standardisation des connaissances'],
    industries: ['Tous secteurs'],
  },
  {
    title: 'Conformité réglementaire',
    icon: '⚖️',
    challenge: 'Comment s\'assurer que tous les employés sont formés aux exigences réglementaires?',
    solution: 'Formations obligatoires avec suivi, rappels automatiques et certifications.',
    results: ['100% de conformité', 'Traçabilité complète', 'Réduction des risques'],
    industries: ['Finance', 'Santé', 'Assurance'],
  },
  {
    title: 'Transformation digitale',
    icon: '💻',
    challenge: 'Comment accompagner les équipes dans l\'adoption de nouveaux outils et processus?',
    solution: 'Programmes progressifs couvrant les outils, les méthodologies et le changement culturel.',
    results: ['Adoption accélérée des outils', 'Résistance au changement réduite', 'ROI mesurable'],
    industries: ['Tous secteurs'],
  },
  {
    title: 'Développement du leadership',
    icon: '👑',
    challenge: 'Comment préparer la relève et développer les compétences managériales?',
    solution: 'Parcours de leadership incluant coaching, mentorat et formations pratiques.',
    results: ['Pipeline de talents renforcé', 'Engagement des hauts potentiels', 'Succession planifiée'],
    industries: ['Tous secteurs'],
  },
  {
    title: 'Montée en compétences techniques',
    icon: '🔧',
    challenge: 'Comment maintenir les compétences techniques à jour face aux évolutions rapides?',
    solution: 'Formations continues sur les dernières technologies et certifications reconnues.',
    results: ['Compétences à jour', 'Certifications obtenues', 'Compétitivité renforcée'],
    industries: ['Technologie', 'Ingénierie'],
  },
  {
    title: 'Formation à la vente',
    icon: '💼',
    challenge: 'Comment améliorer les performances commerciales de l\'équipe de vente?',
    solution: 'Programmes de vente incluant techniques, négociation et connaissance produit.',
    results: ['+25% de taux de conversion', 'Cycle de vente raccourci', 'Panier moyen augmenté'],
    industries: ['Tous secteurs'],
  },
];

export default function UseCasesPage() {
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
            Cas d'usage
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Découvrez comment nos formations répondent à vos défis spécifiques 
            et génèrent des résultats mesurables.
          </p>
        </div>
      </section>

      {/* Use Cases */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {useCases.map((useCase, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '40px',
                }}
              >
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '24px' }}>
                  <span
                    style={{
                      fontSize: '40px',
                      width: '72px',
                      height: '72px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--gray-50)',
                      borderRadius: '16px',
                      flexShrink: 0,
                    }}
                  >
                    {useCase.icon}
                  </span>
                  <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'var(--gray-500)' }}>
                      {useCase.title}
                    </h2>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {useCase.industries.map((industry, j) => (
                        <span
                          key={j}
                          style={{
                            fontSize: '12px',
                            padding: '4px 10px',
                            backgroundColor: 'var(--gray-100)',
                            borderRadius: '12px',
                            color: 'var(--gray-500)',
                          }}
                        >
                          {industry}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-400)', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Défi
                    </h3>
                    <p style={{ fontSize: '15px', color: 'var(--gray-500)', lineHeight: 1.6 }}>{useCase.challenge}</p>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-400)', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Solution
                    </h3>
                    <p style={{ fontSize: '15px', color: 'var(--gray-500)', lineHeight: 1.6 }}>{useCase.solution}</p>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-400)', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Résultats
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {useCase.results.map((result, j) => (
                        <li key={j} style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '4px' }}>
                          ✓ {result}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Vous avez un défi similaire?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Discutons de votre situation et trouvons la solution adaptée.
        </p>
        <Link href="/demo" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Demander une démo
        </Link>
      </section>
    </div>
  );
}
