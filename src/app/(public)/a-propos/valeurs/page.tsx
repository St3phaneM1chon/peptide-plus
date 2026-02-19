'use client';

import Link from 'next/link';

/**
 * PAGE NOS VALEURS - BioCycle Peptides
 */

export default function ValeursPage() {
  const values = [
    {
      icon: '🔬',
      title: 'Rigueur scientifique',
      description: 'Chaque produit est soumis à des tests rigoureux par des laboratoires tiers indépendants. Nous ne faisons aucun compromis sur la qualité et la pureté de nos peptides.',
      color: '#3b82f6'
    },
    {
      icon: '🤝',
      title: 'Intégrité',
      description: 'Transparence totale sur nos produits, nos méthodes et nos certifications. Nous fournissons une documentation complète pour chaque lot produit.',
      color: '#10b981'
    },
    {
      icon: '💡',
      title: 'Innovation',
      description: 'Nous restons à la pointe de la recherche pour offrir les derniers peptides et composés demandés par la communauté scientifique.',
      color: '#f59e0b'
    },
    {
      icon: '🌍',
      title: 'Responsabilité',
      description: 'Engagement envers une utilisation éthique de nos produits. Nous promouvons activement la recherche responsable et le respect des réglementations.',
      color: '#8b5cf6'
    },
    {
      icon: '⚡',
      title: 'Excellence du service',
      description: 'Livraison rapide, emballage sécurisé et support client réactif. Votre satisfaction et la réussite de vos recherches sont notre priorité.',
      color: '#ef4444'
    },
    {
      icon: '📚',
      title: 'Éducation',
      description: 'Nous partageons nos connaissances à travers des guides, des FAQ détaillées et des ressources pour aider nos clients à utiliser nos produits de manière optimale.',
      color: '#06b6d4'
    }
  ];

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{ 
        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', 
        color: 'white', 
        padding: '80px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/a-propos" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '14px' }}>
            ← Retour à À propos
          </Link>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginTop: '24px', marginBottom: '24px' }}>
            Nos Valeurs
          </h1>
          <p style={{ fontSize: '20px', lineHeight: 1.6 }}>
            Les principes qui guident chacune de nos actions
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '32px' 
        }}>
          {values.map((value, index) => (
            <div 
              key={index}
              style={{ 
                padding: '32px', 
                backgroundColor: '#f9fafb', 
                borderRadius: '16px',
                borderTop: `4px solid ${value.color}`
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '20px' }}>{value.icon}</div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                {value.title}
              </h3>
              <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#6b7280' }}>
                {value.description}
              </p>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div style={{ 
          marginTop: '64px', 
          padding: '40px', 
          backgroundColor: '#1f2937', 
          borderRadius: '16px',
          textAlign: 'center',
          color: 'white'
        }}>
          <p style={{ fontSize: '24px', fontStyle: 'italic', lineHeight: 1.6, marginBottom: '16px' }}>
            &ldquo;La qualité n&apos;est jamais un accident; c&apos;est toujours le résultat d&apos;un effort intelligent.&rdquo;
          </p>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            — Notre philosophie chez BioCycle Peptides
          </p>
        </div>
      </div>
    </div>
  );
}
