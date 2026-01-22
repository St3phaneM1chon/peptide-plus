/**
 * PAGE RÉFÉRENCES
 */

import Link from 'next/link';

export const metadata = {
  title: 'Références | Formations Pro',
  description: 'Liste complète de nos clients par secteur d\'activité.',
};

const clientsByIndustry = [
  {
    industry: 'Finance & Assurance',
    icon: '🏦',
    clients: ['Desjardins', 'Banque Nationale', 'TD Canada', 'RBC', 'Intact Assurance', 'Manuvie', 'Sun Life', 'iA Groupe financier'],
  },
  {
    industry: 'Technologie',
    icon: '💻',
    clients: ['CGI', 'Ubisoft', 'WSP', 'Lightspeed', 'Coveo', 'Nuvei', 'Element AI', 'Unity Technologies'],
  },
  {
    industry: 'Télécommunications',
    icon: '📱',
    clients: ['Bell Canada', 'Vidéotron', 'Rogers', 'TELUS', 'Cogeco', 'SaskTel'],
  },
  {
    industry: 'Énergie & Services publics',
    icon: '⚡',
    clients: ['Hydro-Québec', 'Énergir', 'TransCanada', 'Suncor', 'Imperial Oil', 'Enbridge'],
  },
  {
    industry: 'Commerce de détail',
    icon: '🛒',
    clients: ['Metro', 'Couche-Tard', 'SAQ', 'Jean Coutu', 'Dollarama', 'Canadian Tire', 'Loblaws'],
  },
  {
    industry: 'Manufacturier & Aérospatiale',
    icon: '✈️',
    clients: ['Bombardier', 'CAE', 'Pratt & Whitney', 'Bell Textron', 'Safran', 'Airbus Canada'],
  },
  {
    industry: 'Santé & Pharmaceutique',
    icon: '🏥',
    clients: ['CIUSSS', 'Pfizer Canada', 'AbbVie', 'Merck', 'Valeant', 'Biron'],
  },
  {
    industry: 'Gouvernement & Parapublic',
    icon: '🏛️',
    clients: ['Gouvernement du Québec', 'Ville de Montréal', 'Postes Canada', 'Radio-Canada', 'Société de transport'],
  },
];

export default function ReferencesPage() {
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
            Nos références
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Plus de 500 entreprises nous font confiance pour former leurs équipes.
          </p>
        </div>
      </section>

      {/* Clients by industry */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {clientsByIndustry.map((category, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '32px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <span style={{ fontSize: '32px' }}>{category.icon}</span>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--gray-500)' }}>
                    {category.industry}
                  </h2>
                  <span style={{ fontSize: '13px', color: 'var(--gray-400)', marginLeft: 'auto' }}>
                    {category.clients.length} clients
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {category.clients.map((client, j) => (
                    <span
                      key={j}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: 'var(--gray-50)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: 'var(--gray-500)',
                      }}
                    >
                      {client}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Summary */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '32px', marginBottom: '40px' }}>
            <div>
              <p style={{ fontSize: '40px', fontWeight: 700, color: 'var(--gray-500)' }}>500+</p>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>Entreprises clientes</p>
            </div>
            <div>
              <p style={{ fontSize: '40px', fontWeight: 700, color: 'var(--gray-500)' }}>8</p>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>Secteurs d'activité</p>
            </div>
            <div>
              <p style={{ fontSize: '40px', fontWeight: 700, color: 'var(--gray-500)' }}>12</p>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>Pays</p>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
            Cette liste n'est pas exhaustive. Contactez-nous pour des références spécifiques à votre secteur.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Besoin de références dans votre secteur?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Nous pouvons vous mettre en contact avec des clients similaires.
        </p>
        <Link href="/contact" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Contactez-nous
        </Link>
      </section>
    </div>
  );
}
