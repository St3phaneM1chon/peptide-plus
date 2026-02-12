'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';

/**
 * PAGE À PROPOS - BioCycle Peptides
 */

export default function AboutPage() {
  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      {/* Hero Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', 
        color: 'white', 
        padding: '80px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            À propos de BioCycle Peptides
          </h1>
          <p style={{ fontSize: '18px', lineHeight: 1.7, color: '#d1d5db' }}>
            Votre source canadienne de confiance pour les peptides de recherche de haute pureté. 
            Qualité, intégrité et excellence scientifique depuis notre fondation.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '64px 24px' }}>
        {/* Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '32px',
          marginBottom: '64px',
          textAlign: 'center'
        }}>
          <StatCard number="99%+" label="Pureté garantie" />
          <StatCard number="500+" label="Produits de recherche" />
          <StatCard number="10K+" label="Chercheurs servis" />
          <StatCard number="24-48h" label="Expédition rapide" />
        </div>

        {/* Notre histoire */}
        <section style={{ marginBottom: '64px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px', color: '#1f2937' }}>
            Notre histoire
          </h2>
          <p style={{ fontSize: '16px', lineHeight: 1.8, color: '#4b5563', marginBottom: '16px' }}>
            BioCycle Peptides est née de la passion pour la recherche scientifique et du constat 
            qu&apos;il manquait au Canada un fournisseur fiable de peptides de recherche de haute qualité 
            à des prix accessibles.
          </p>
          <p style={{ fontSize: '16px', lineHeight: 1.8, color: '#4b5563', marginBottom: '16px' }}>
            Fondée à Montréal, notre entreprise s&apos;est donnée pour mission de fournir aux chercheurs 
            canadiens et internationaux des composés synthétiques de la plus haute pureté, accompagnés 
            de certificats d&apos;analyse détaillés pour chaque lot.
          </p>
          <p style={{ fontSize: '16px', lineHeight: 1.8, color: '#4b5563' }}>
            Aujourd&apos;hui, nous sommes fiers de servir des milliers de chercheurs à travers le monde, 
            des universités aux laboratoires privés, en passant par les institutions de recherche.
          </p>
        </section>

        {/* Notre engagement */}
        <section style={{ marginBottom: '64px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '24px', color: '#1f2937' }}>
            Notre engagement qualité
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <FeatureCard 
              icon="🔬"
              title="Tests par laboratoires tiers"
              description="Chaque lot est analysé par des laboratoires indépendants accrédités. HPLC et spectrométrie de masse pour garantir pureté et identité."
            />
            <FeatureCard 
              icon="📋"
              title="Certificats d'analyse"
              description="COA détaillé fourni avec chaque produit. Traçabilité complète du lot de fabrication à la livraison."
            />
            <FeatureCard 
              icon="❄️"
              title="Chaîne du froid"
              description="Expédition avec packs réfrigérants. Stockage contrôlé pour préserver l'intégrité des peptides."
            />
            <FeatureCard 
              icon="🛡️"
              title="Conformité réglementaire"
              description="Respect des normes cGMP. Documentation complète pour la conformité de votre recherche."
            />
          </div>
        </section>

        {/* Navigation vers autres pages */}
        <section style={{ 
          padding: '40px', 
          backgroundColor: '#f9fafb', 
          borderRadius: '16px',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: '#1f2937' }}>
            En savoir plus
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px' }}>
            <NavLink href="/a-propos/mission">Notre mission</NavLink>
            <NavLink href="/a-propos/valeurs">Nos valeurs</NavLink>
            <NavLink href="/a-propos/histoire">Notre histoire</NavLink>
            <NavLink href="/a-propos/engagements">Nos engagements</NavLink>
          </div>
        </section>

        {/* CTA */}
        <section style={{ marginTop: '64px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>
            Prêt à découvrir nos produits?
          </h2>
          <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '24px' }}>
            Explorez notre catalogue de peptides et suppléments de recherche de haute qualité.
          </p>
          <Link 
            href="/shop"
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
            Voir nos produits →
          </Link>
        </section>
      </div>
    </div>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ fontSize: '36px', fontWeight: 700, color: '#CC5500', marginBottom: '8px' }}>
        {number}
      </div>
      <div style={{ fontSize: '14px', color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{ 
      padding: '24px', 
      backgroundColor: '#f9fafb', 
      borderRadius: '12px',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ fontSize: '32px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#6b7280' }}>
        {description}
      </p>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: '12px 24px',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        color: '#374151',
        textDecoration: 'none',
        fontWeight: 500,
        transition: 'all 0.2s'
      }}
    >
      {children}
    </Link>
  );
}
