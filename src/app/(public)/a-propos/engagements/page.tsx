'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';

/**
 * PAGE NOS ENGAGEMENTS - BioCycle Peptides
 */

export default function EngagementsPage() {
  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{ 
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
        color: 'white', 
        padding: '80px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/a-propos" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '14px' }}>
            ← Retour à À propos
          </Link>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginTop: '24px', marginBottom: '24px' }}>
            Nos Engagements
          </h1>
          <p style={{ fontSize: '20px', lineHeight: 1.6 }}>
            Des promesses concrètes pour une recherche de qualité
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 24px' }}>
        {/* Engagement 1: Qualité */}
        <EngagementSection
          icon="🏆"
          title="Engagement Qualité"
          color="#f97316"
          items={[
            'Pureté minimale garantie de 99% sur tous nos peptides',
            'Tests par laboratoires tiers indépendants et accrédités',
            'Certificat d\'analyse (COA) fourni avec chaque produit',
            'Analyses HPLC et spectrométrie de masse disponibles',
            'Traçabilité complète de chaque lot de fabrication'
          ]}
        />

        {/* Engagement 2: Service */}
        <EngagementSection
          icon="⚡"
          title="Engagement Service"
          color="#3b82f6"
          items={[
            'Expédition sous 24-48h pour les commandes avant 14h',
            'Emballage sécurisé et discret avec cold packs si nécessaire',
            'Support client réactif par courriel et chat',
            'Suivi de commande en temps réel',
            'Retours et remboursements sans tracas pour produits défectueux'
          ]}
        />

        {/* Engagement 3: Transparence */}
        <EngagementSection
          icon="👁️"
          title="Engagement Transparence"
          color="#8b5cf6"
          items={[
            'Prix clairs et sans frais cachés',
            'Information complète sur chaque produit',
            'Politique de confidentialité respectueuse de vos données',
            'Communication honnête sur les délais et la disponibilité',
            'Résultats de tests accessibles pour chaque lot'
          ]}
        />

        {/* Engagement 4: Environnement */}
        <EngagementSection
          icon="🌱"
          title="Engagement Environnemental"
          color="#10b981"
          items={[
            'Réduction des emballages plastiques au minimum nécessaire',
            'Utilisation de matériaux recyclables quand possible',
            'Optimisation des routes de livraison pour réduire l\'empreinte carbone',
            'Gestion responsable des déchets de laboratoire',
            'Partenariat avec des fournisseurs responsables'
          ]}
        />

        {/* Engagement 5: Éthique */}
        <EngagementSection
          icon="⚖️"
          title="Engagement Éthique"
          color="#ef4444"
          items={[
            'Promotion exclusive de l\'usage recherche de nos produits',
            'Vérification de la légitimité des commandes importantes',
            'Respect des réglementations canadiennes et internationales',
            'Refus de vente en cas de doute sur l\'utilisation prévue',
            'Éducation des clients sur l\'usage responsable'
          ]}
        />

        {/* CTA */}
        <div style={{ 
          marginTop: '64px', 
          padding: '40px', 
          backgroundColor: '#1f2937', 
          borderRadius: '16px',
          textAlign: 'center',
          color: 'white'
        }}>
          <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>
            Des questions sur nos engagements?
          </h3>
          <p style={{ fontSize: '16px', color: '#9ca3af', marginBottom: '24px' }}>
            Notre équipe est disponible pour répondre à toutes vos questions.
          </p>
          <Link 
            href="/contact"
            style={{ 
              display: 'inline-block',
              padding: '14px 32px', 
              backgroundColor: '#f97316', 
              color: 'white', 
              borderRadius: '8px',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Nous contacter →
          </Link>
        </div>
      </div>
    </div>
  );
}

function EngagementSection({ icon, title, color, items }: { 
  icon: string; 
  title: string; 
  color: string; 
  items: string[] 
}) {
  return (
    <section style={{ marginBottom: '48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div style={{ 
          width: '48px', 
          height: '48px', 
          backgroundColor: color + '20',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px'
        }}>
          {icon}
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937' }}>
          {title}
        </h2>
      </div>
      <ul style={{ paddingLeft: '24px' }}>
        {items.map((item, index) => (
          <li key={index} style={{ 
            fontSize: '15px', 
            lineHeight: 1.8, 
            color: '#4b5563',
            marginBottom: '8px',
            listStyleType: 'none',
            position: 'relative',
            paddingLeft: '24px'
          }}>
            <span style={{ 
              position: 'absolute', 
              left: 0, 
              color: color,
              fontWeight: 'bold'
            }}>✓</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
