export const dynamic = 'force-dynamic';
/**
 * PAGE AIDE / CENTRE D'AIDE
 */

import Link from 'next/link';

export const metadata = {
  title: 'Centre d\'aide | Formations Pro',
  description: 'Trouvez de l\'aide et du support pour utiliser notre plateforme.',
};

const helpCategories = [
  { icon: '🚀', title: 'Démarrage rapide', desc: 'Premiers pas sur la plateforme', href: '/aide/demarrage' },
  { icon: '👤', title: 'Mon compte', desc: 'Profil, mot de passe, paramètres', href: '/aide/compte' },
  { icon: '📚', title: 'Formations', desc: 'Accès, certificats, progression', href: '/aide/formations' },
  { icon: '💳', title: 'Paiement', desc: 'Facturation, remboursements', href: '/aide/paiement' },
  { icon: '🏢', title: 'Entreprises', desc: 'Gestion des équipes, rapports', href: '/aide/entreprises' },
  { icon: '🔧', title: 'Technique', desc: 'Problèmes techniques', href: '/aide/technique' },
];

const popularArticles = [
  'Comment créer mon compte?',
  'Comment accéder à mes formations?',
  'Comment obtenir mon certificat?',
  'Comment modifier mon mot de passe?',
  'Comment annuler mon abonnement?',
  'Comment contacter le support?',
];

export default function HelpPage() {
  return (
    <div style={{ backgroundColor: 'var(--gray-100)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>
          Comment pouvons-nous vous aider?
        </h1>
        <div style={{ maxWidth: '500px', margin: '24px auto 0' }}>
          <input
            type="search"
            placeholder="Rechercher dans l'aide..."
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '16px',
            }}
          />
        </div>
      </section>

      {/* Categories */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
            }}
          >
            {helpCategories.map((cat, i) => (
              <Link
                key={i}
                href={cat.href}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  textDecoration: 'none',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <span style={{ fontSize: '32px' }}>{cat.icon}</span>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                    {cat.title}
                  </h2>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{cat.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular articles */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
            Articles populaires
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {popularArticles.map((article, i) => (
              <Link
                key={i}
                href="#"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '8px',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: '15px', color: 'var(--gray-500)' }}>{article}</span>
                <span style={{ color: 'var(--gray-400)' }}>→</span>
              </Link>
            ))}
          </div>
          <Link
            href="/faq"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: '24px',
              color: 'var(--gray-500)',
              fontWeight: 500,
            }}
          >
            Voir toutes les questions fréquentes →
          </Link>
        </div>
      </section>

      {/* Contact */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '40px', color: 'var(--gray-500)' }}>
            Besoin d'aide supplémentaire?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>💬</span>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>Chat</h3>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '16px' }}>
                Discutez avec notre équipe en temps réel.
              </p>
              <button className="btn btn-primary" style={{ width: '100%' }}>
                Ouvrir le chat
              </button>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>📧</span>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>Email</h3>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '16px' }}>
                Réponse sous 24h ouvrables.
              </p>
              <Link href="/contact" className="btn btn-secondary" style={{ display: 'block', width: '100%' }}>
                Nous écrire
              </Link>
            </div>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>📞</span>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>Téléphone</h3>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '16px' }}>
                Lun-Ven, 9h-17h EST
              </p>
              <a href="tel:1-800-XXX-XXXX" className="btn btn-secondary" style={{ display: 'block', width: '100%' }}>
                1-800-XXX-XXXX
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
