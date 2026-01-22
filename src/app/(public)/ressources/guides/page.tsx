/**
 * PAGE GUIDES & RESSOURCES
 */

import Link from 'next/link';

export const metadata = {
  title: 'Guides | Formations Pro',
  description: 'Guides pratiques, ebooks et ressources téléchargeables.',
};

const guides = [
  {
    id: 'guide-lms-2026',
    title: 'Guide complet pour choisir votre LMS en 2026',
    description: 'Critères, comparatifs et checklist pour sélectionner la plateforme idéale.',
    category: 'Achat',
    pages: 45,
    format: 'PDF',
    featured: true,
  },
  {
    id: 'roi-formation',
    title: 'Comment mesurer le ROI de vos formations',
    description: 'Méthodes, KPIs et outils pour évaluer l\'impact de vos programmes.',
    category: 'Stratégie',
    pages: 32,
    format: 'PDF',
    featured: true,
  },
  {
    id: 'onboarding-efficace',
    title: 'Template: Parcours d\'onboarding efficace',
    description: 'Modèle prêt à l\'emploi pour intégrer vos nouveaux employés.',
    category: 'Template',
    pages: 15,
    format: 'PDF + Excel',
    featured: false,
  },
  {
    id: 'microlearning',
    title: 'Microlearning: Guide de mise en œuvre',
    description: 'Stratégies et bonnes pratiques pour des formations courtes et efficaces.',
    category: 'Pédagogie',
    pages: 28,
    format: 'PDF',
    featured: false,
  },
  {
    id: 'conformite-formation',
    title: 'Checklist conformité formation',
    description: 'Vérifiez que vos programmes respectent les obligations réglementaires.',
    category: 'Conformité',
    pages: 12,
    format: 'PDF + Checklist',
    featured: false,
  },
  {
    id: 'engagement-apprenants',
    title: '50 techniques pour engager vos apprenants',
    description: 'Idées concrètes pour améliorer la participation et la complétion.',
    category: 'Pédagogie',
    pages: 38,
    format: 'PDF',
    featured: false,
  },
];

const categories = ['Tous', 'Stratégie', 'Pédagogie', 'Achat', 'Template', 'Conformité'];

export default function GuidesPage() {
  const featured = guides.filter(g => g.featured);
  const others = guides.filter(g => !g.featured);

  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>
          Guides & Ressources
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          Ebooks, templates et guides pratiques pour optimiser vos formations.
        </p>
      </section>

      {/* Featured */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
            Ressources populaires
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {featured.map((guide) => (
              <div
                key={guide.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                }}
              >
                <div
                  style={{
                    width: '200px',
                    backgroundColor: 'var(--gray-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '64px' }}>📘</span>
                </div>
                <div style={{ padding: '24px', flex: 1 }}>
                  <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: 'var(--gray-100)', borderRadius: '10px', color: 'var(--gray-500)' }}>
                    {guide.category}
                  </span>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '12px 0 8px', color: 'var(--gray-500)' }}>
                    {guide.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '16px' }}>
                    {guide.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                      {guide.pages} pages • {guide.format}
                    </span>
                    <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                      Télécharger
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {categories.map((cat, i) => (
            <button
              key={cat}
              style={{
                padding: '8px 16px',
                backgroundColor: i === 0 ? 'var(--gray-500)' : 'white',
                color: i === 0 ? 'white' : 'var(--gray-500)',
                border: 'none',
                borderRadius: '20px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* All guides */}
      <section style={{ padding: '48px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
            }}
          >
            {others.map((guide) => (
              <div
                key={guide.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                }}
              >
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ fontSize: '40px' }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: 'var(--gray-100)', borderRadius: '8px', color: 'var(--gray-500)' }}>
                      {guide.category}
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '8px 0', color: 'var(--gray-500)' }}>
                      {guide.title}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: '12px' }}>
                      {guide.description}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                        {guide.pages} pages
                      </span>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                        Télécharger
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
            Recevez nos nouvelles ressources
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            Inscrivez-vous pour recevoir nos guides et templates dès leur publication.
          </p>
          <form style={{ display: 'flex', gap: '12px' }}>
            <input type="email" placeholder="Votre courriel" className="form-input" style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary">S'inscrire</button>
          </form>
        </div>
      </section>
    </div>
  );
}
