import Link from 'next/link';

/**
 * PAGE NOTRE HISTOIRE - BioCycle Peptides
 * Server Component — no client-side hooks or event handlers needed
 */

export default function HistoirePage() {
  const timeline = [
    {
      year: '2023',
      title: 'La naissance d\'une idée',
      description: 'Face au manque de fournisseurs canadiens fiables de peptides de recherche, l\'idée de BioCycle Peptides émerge à Montréal. L\'objectif: créer une source locale de composés de haute qualité pour les chercheurs canadiens.',
      color: '#CC5500'
    },
    {
      year: '2024',
      title: 'Fondation et premiers produits',
      description: 'Lancement officiel de BioCycle Peptides avec une gamme initiale de 50 peptides. Partenariat avec des laboratoires d\'analyse accrédités pour garantir la qualité de chaque lot.',
      color: '#3b82f6'
    },
    {
      year: '2025',
      title: 'Expansion du catalogue',
      description: 'Élargissement à plus de 200 produits incluant peptides, suppléments de recherche et accessoires. Mise en place du programme de fidélité pour récompenser nos clients réguliers.',
      color: '#10b981'
    },
    {
      year: '2026',
      title: 'Aujourd\'hui et demain',
      description: 'Plus de 500 produits disponibles et des milliers de chercheurs servis à travers le monde. Lancement de ressources éducatives et de la communauté BioCycle pour partager les connaissances.',
      color: '#8b5cf6'
    }
  ];

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', 
        color: 'white', 
        padding: '80px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/a-propos" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '14px' }}>
            ← Retour à À propos
          </Link>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginTop: '24px', marginBottom: '24px' }}>
            Notre Histoire
          </h1>
          <p style={{ fontSize: '20px', lineHeight: 1.6, color: '#d1d5db' }}>
            De l&apos;idée à la réalité: le parcours de BioCycle Peptides
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{ 
            position: 'absolute', 
            left: '24px', 
            top: '0', 
            bottom: '0', 
            width: '2px', 
            backgroundColor: '#e5e7eb' 
          }} />

          {timeline.map((item, index) => (
            <div key={index} style={{ 
              position: 'relative', 
              paddingLeft: '72px', 
              paddingBottom: index === timeline.length - 1 ? '0' : '48px' 
            }}>
              {/* Dot */}
              <div style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '4px',
                width: '24px', 
                height: '24px', 
                borderRadius: '50%', 
                backgroundColor: item.color,
                border: '4px solid white',
                boxShadow: '0 0 0 2px ' + item.color
              }} />

              {/* Year badge */}
              <div style={{ 
                display: 'inline-block',
                padding: '4px 12px', 
                backgroundColor: item.color, 
                color: 'white', 
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '12px'
              }}>
                {item.year}
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#6b7280' }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Future */}
        <div style={{ 
          marginTop: '64px', 
          padding: '32px', 
          backgroundColor: '#f0fdf4', 
          borderRadius: '16px',
          border: '1px solid #86efac',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#166534' }}>
            🚀 L&apos;avenir
          </h3>
          <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#166534' }}>
            Nous continuons d&apos;innover pour offrir les meilleurs produits et services à la communauté 
            scientifique. Nouveaux peptides, nouvelles ressources éducatives, et toujours plus de 
            qualité à chaque étape.
          </p>
        </div>
      </div>
    </div>
  );
}
