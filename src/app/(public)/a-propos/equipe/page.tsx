'use client';

import Link from 'next/link';

/**
 * PAGE NOTRE ÉQUIPE - BioCycle Peptides
 */

export default function EquipePage() {
  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{ 
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
        color: 'white', 
        padding: '80px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/a-propos" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '14px' }}>
            ← Retour à À propos
          </Link>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginTop: '24px', marginBottom: '24px' }}>
            Notre Équipe
          </h1>
          <p style={{ fontSize: '20px', lineHeight: 1.6 }}>
            Une équipe passionnée au service de la recherche scientifique
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 24px' }}>
        {/* Introduction */}
        <section style={{ marginBottom: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '18px', lineHeight: 1.8, color: '#4b5563' }}>
            Chez BioCycle Peptides, nous sommes une équipe diversifiée de scientifiques, 
            de spécialistes en logistique et de passionnés du service client. Unis par 
            notre engagement envers la qualité et l&apos;excellence, nous travaillons chaque 
            jour pour soutenir la communauté scientifique.
          </p>
        </section>

        {/* Departments */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <DepartmentCard
            icon="🔬"
            title="Équipe Scientifique"
            description="Nos experts en biochimie et pharmacologie supervisent la sélection des produits, vérifient les certificats d'analyse et assurent que chaque peptide répond à nos standards de qualité."
            color="#10b981"
          />
          <DepartmentCard
            icon="📦"
            title="Équipe Logistique"
            description="Spécialistes de la chaîne du froid et de l'emballage sécurisé, ils garantissent que vos produits arrivent en parfait état, avec les conditions de stockage optimales."
            color="#3b82f6"
          />
          <DepartmentCard
            icon="💬"
            title="Service Client"
            description="Disponibles pour répondre à vos questions, notre équipe support vous accompagne de la commande à la livraison et au-delà."
            color="#CC5500"
          />
          <DepartmentCard
            icon="💻"
            title="Équipe Technique"
            description="Nos développeurs et designers travaillent continuellement pour améliorer votre expérience sur notre plateforme et développer de nouvelles fonctionnalités."
            color="#8b5cf6"
          />
        </div>

        {/* Values */}
        <section style={{ 
          marginTop: '64px', 
          padding: '40px', 
          backgroundColor: '#f9fafb', 
          borderRadius: '16px',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: '#1f2937' }}>
            Ce qui nous unit
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px' }}>
            <ValueBadge icon="🎯" text="Précision" />
            <ValueBadge icon="🤝" text="Collaboration" />
            <ValueBadge icon="💡" text="Innovation" />
            <ValueBadge icon="❤️" text="Passion" />
            <ValueBadge icon="🔒" text="Intégrité" />
          </div>
        </section>

        {/* Join Us */}
        <section style={{ 
          marginTop: '48px', 
          padding: '40px', 
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', 
          borderRadius: '16px',
          textAlign: 'center',
          color: 'white'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>
            Rejoignez notre équipe
          </h2>
          <p style={{ fontSize: '16px', color: '#9ca3af', marginBottom: '24px' }}>
            Nous sommes toujours à la recherche de talents passionnés par la science 
            et le service client. Consultez nos offres d&apos;emploi ou envoyez-nous 
            votre candidature spontanée.
          </p>
          <Link 
            href="mailto:careers@biocyclepeptides.com"
            style={{ 
              display: 'inline-block',
              padding: '14px 32px', 
              backgroundColor: '#CC5500', 
              color: 'white', 
              borderRadius: '8px',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            📧 careers@biocyclepeptides.com
          </Link>
        </section>
      </div>
    </div>
  );
}

function DepartmentCard({ icon, title, description, color }: { 
  icon: string; 
  title: string; 
  description: string;
  color: string;
}) {
  return (
    <div style={{ 
      padding: '32px', 
      backgroundColor: '#f9fafb', 
      borderRadius: '16px',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: '36px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#6b7280' }}>
        {description}
      </p>
    </div>
  );
}

function ValueBadge({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      padding: '12px 20px',
      backgroundColor: 'white',
      borderRadius: '24px',
      border: '1px solid #e5e7eb'
    }}>
      <span>{icon}</span>
      <span style={{ fontWeight: 500, color: '#374151' }}>{text}</span>
    </div>
  );
}
