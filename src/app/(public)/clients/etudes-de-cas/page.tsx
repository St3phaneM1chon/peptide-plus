export const dynamic = 'force-dynamic';
/**
 * PAGE ÉTUDES DE CAS
 */

import Link from 'next/link';

export const metadata = {
  title: 'Études de cas | Formations Pro',
  description: 'Découvrez comment nos clients ont atteint leurs objectifs grâce à nos formations.',
};

const caseStudies = [
  {
    id: 'desjardins-transformation',
    company: 'Desjardins',
    industry: 'Finance',
    title: 'Transformation digitale de 5000 employés',
    summary: 'Comment Desjardins a accompagné sa transformation digitale en formant 5000 employés en moins d\'un an.',
    results: ['+45% productivité', '98% satisfaction', '6 mois d\'avance'],
    image: null,
    featured: true,
  },
  {
    id: 'cgi-leadership',
    company: 'CGI',
    industry: 'Technologie',
    title: 'Programme de leadership pour managers',
    summary: 'Développement d\'un programme sur mesure pour former 200 nouveaux managers.',
    results: ['+30% engagement', 'Promotion interne x2', '92% completion'],
    image: null,
    featured: true,
  },
  {
    id: 'hydro-conformite',
    company: 'Hydro-Québec',
    industry: 'Énergie',
    title: 'Conformité et certifications obligatoires',
    summary: 'Mise en place d\'un système de formation continue pour garantir la conformité réglementaire.',
    results: ['100% conformité', 'Zéro incident', 'ROI 300%'],
    image: null,
    featured: false,
  },
  {
    id: 'bell-onboarding',
    company: 'Bell Canada',
    industry: 'Télécommunications',
    title: 'Optimisation de l\'onboarding',
    summary: 'Réduction du temps d\'intégration des nouvelles recrues de 40%.',
    results: ['-40% temps intégration', '+25% rétention', 'Standardisation'],
    image: null,
    featured: false,
  },
  {
    id: 'bombardier-technique',
    company: 'Bombardier',
    industry: 'Aérospatiale',
    title: 'Montée en compétences techniques',
    summary: 'Formation de 300 ingénieurs sur les nouvelles technologies de fabrication.',
    results: ['300 certifiés', '-20% erreurs', 'Innovation accélérée'],
    image: null,
    featured: false,
  },
];

export default function CaseStudiesPage() {
  const featuredStudies = caseStudies.filter(cs => cs.featured);
  const otherStudies = caseStudies.filter(cs => !cs.featured);

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
            Études de cas
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Des résultats concrets, mesurables et documentés. Découvrez comment 
            nos clients ont atteint leurs objectifs.
          </p>
        </div>
      </section>

      {/* Featured */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '40px', color: 'var(--gray-500)' }}>
            Études phares
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
            {featuredStudies.map((study) => (
              <Link
                key={study.id}
                href={`/clients/etudes-de-cas/${study.id}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  textDecoration: 'none',
                  display: 'block',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--gray-200)',
                    height: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '64px' }}>📊</span>
                </div>
                <div style={{ padding: '32px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: 'var(--gray-100)', borderRadius: '12px', color: 'var(--gray-500)' }}>
                      {study.company}
                    </span>
                    <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: 'var(--gray-100)', borderRadius: '12px', color: 'var(--gray-400)' }}>
                      {study.industry}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-500)' }}>
                    {study.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: '20px' }}>
                    {study.summary}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {study.results.map((result, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#22c55e',
                          padding: '6px 12px',
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: '6px',
                        }}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Other case studies */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '40px', color: 'var(--gray-500)' }}>
            Autres études de cas
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {otherStudies.map((study) => (
              <Link
                key={study.id}
                href={`/clients/etudes-de-cas/${study.id}`}
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '24px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)' }}>{study.company}</span>
                    <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>• {study.industry}</span>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                    {study.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{study.summary}</p>
                </div>
                <span style={{ fontSize: '14px', color: 'var(--gray-500)', fontWeight: 500, flexShrink: 0 }}>
                  Lire →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Écrivons votre success story
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Discutons de vos objectifs et créons ensemble votre programme de formation.
        </p>
        <Link href="/demo" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Demander une démo
        </Link>
      </section>
    </div>
  );
}
