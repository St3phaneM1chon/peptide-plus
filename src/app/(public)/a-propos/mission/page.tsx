'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';

/**
 * PAGE NOTRE MISSION - BioCycle Peptides
 */

export default function MissionPage() {
  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{ 
        background: 'linear-gradient(135deg, #CC5500 0%, #AD4700 100%)', 
        color: 'white', 
        padding: '80px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/a-propos" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: '14px' }}>
            ← Retour à À propos
          </Link>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginTop: '24px', marginBottom: '24px' }}>
            Notre Mission
          </h1>
          <p style={{ fontSize: '20px', lineHeight: 1.6 }}>
            Démocratiser l&apos;accès aux peptides de recherche de haute qualité
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px', color: '#1f2937' }}>
            Pourquoi nous existons
          </h2>
          <p style={{ fontSize: '16px', lineHeight: 1.8, color: '#4b5563', marginBottom: '16px' }}>
            La recherche scientifique avance à grands pas, et les peptides jouent un rôle crucial 
            dans de nombreuses découvertes. Pourtant, accéder à des composés de qualité recherche 
            reste un défi pour de nombreux chercheurs.
          </p>
          <p style={{ fontSize: '16px', lineHeight: 1.8, color: '#4b5563' }}>
            BioCycle Peptides a été fondée avec une mission claire: fournir aux chercheurs du monde 
            entier des peptides synthétiques de la plus haute pureté, avec une documentation complète 
            et à des prix accessibles.
          </p>
        </section>

        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px', color: '#1f2937' }}>
            Nos objectifs
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <ObjectiveCard 
              number="01"
              title="Excellence scientifique"
              description="Maintenir les plus hauts standards de pureté (99%+) et fournir une documentation analytique complète pour chaque produit."
            />
            <ObjectiveCard 
              number="02"
              title="Accessibilité"
              description="Rendre les peptides de recherche accessibles à tous les chercheurs, des grandes institutions aux laboratoires indépendants."
            />
            <ObjectiveCard 
              number="03"
              title="Support à la recherche"
              description="Accompagner nos clients avec des ressources éducatives, des guides de reconstitution et un support technique réactif."
            />
            <ObjectiveCard 
              number="04"
              title="Innovation continue"
              description="Élargir constamment notre catalogue pour répondre aux besoins émergents de la communauté scientifique."
            />
          </div>
        </section>

        <section style={{ 
          padding: '32px', 
          backgroundColor: '#fef3c7', 
          borderRadius: '12px',
          border: '1px solid #fcd34d'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#92400e' }}>
            ⚠️ Rappel important
          </h3>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#92400e' }}>
            Tous nos produits sont destinés exclusivement à la recherche scientifique et ne doivent 
            pas être utilisés pour la consommation humaine ou animale. Nous nous engageons à promouvoir 
            une utilisation responsable et éthique de nos produits.
          </p>
        </section>
      </div>
    </div>
  );
}

function ObjectiveCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div style={{ 
      display: 'flex', 
      gap: '20px', 
      padding: '24px', 
      backgroundColor: '#f9fafb', 
      borderRadius: '12px' 
    }}>
      <div style={{ 
        width: '48px', 
        height: '48px', 
        backgroundColor: '#CC5500', 
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 700,
        flexShrink: 0
      }}>
        {number}
      </div>
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
          {title}
        </h3>
        <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#6b7280' }}>
          {description}
        </p>
      </div>
    </div>
  );
}
