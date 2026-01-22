/**
 * PAGE MISSION
 */

import Link from 'next/link';

export const metadata = {
  title: 'Notre Mission | Formations Pro',
  description: 'Découvrez la mission et la vision qui guident notre entreprise.',
};

export default function MissionPage() {
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
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px' }}>🎯</span>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            Notre Mission
          </h1>
          <p style={{ fontSize: '20px', opacity: 0.9, lineHeight: 1.7 }}>
            Démocratiser l'accès à des formations professionnelles de qualité 
            pour permettre à chacun d'atteindre son plein potentiel.
          </p>
        </div>
      </section>

      {/* Mission Details */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '48px', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px', color: 'var(--gray-500)' }}>
              Ce qui nous anime
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.8, marginBottom: '20px' }}>
              Nous croyons fermement que l'éducation et la formation continue sont les clés de la réussite 
              professionnelle. Dans un monde en constante évolution, les compétences d'aujourd'hui peuvent 
              devenir obsolètes demain.
            </p>
            <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.8 }}>
              Notre mission est d'offrir des formations accessibles, pertinentes et de haute qualité qui 
              répondent aux besoins réels du marché du travail. Nous accompagnons les professionnels, les 
              entreprises et les institutions dans leur parcours de développement des compétences.
            </p>
          </div>

          {/* Vision */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '48px', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px', color: 'var(--gray-500)' }}>
              Notre Vision
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.8 }}>
              Devenir le partenaire de référence en formation professionnelle au Canada et à l'international, 
              reconnu pour l'excellence de nos programmes, l'innovation de nos méthodes pédagogiques et 
              l'impact mesurable sur la carrière de nos apprenants.
            </p>
          </div>

          {/* Pillars */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '24px',
            }}
          >
            {[
              { icon: '📚', title: 'Excellence pédagogique', desc: 'Des programmes conçus par des experts reconnus dans leur domaine.' },
              { icon: '🌐', title: 'Accessibilité', desc: 'Des formations disponibles partout, à tout moment, pour tous les budgets.' },
              { icon: '📈', title: 'Impact mesurable', desc: 'Des résultats concrets et un suivi de progression personnalisé.' },
              { icon: '🤝', title: 'Accompagnement', desc: 'Un support humain et réactif tout au long de votre parcours.' },
            ].map((pillar, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  padding: '32px',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>{pillar.icon}</span>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-500)' }}>
                  {pillar.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6 }}>{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Rejoignez notre communauté
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Plus de 50 000 professionnels nous font confiance.
        </p>
        <Link href="/catalogue" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Découvrir nos formations
        </Link>
      </section>
    </div>
  );
}
