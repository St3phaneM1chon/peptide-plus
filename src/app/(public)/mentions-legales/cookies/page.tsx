'use client';

/**
 * PAGE POLITIQUE DE COOKIES
 */


export default function CookiesPage() {
  const lastUpdated = '21 janvier 2026';

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Politique de cookies
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '48px' }}>
          Dernière mise à jour: {lastUpdated}
        </p>

        <div style={{ fontSize: '15px', color: 'var(--gray-500)', lineHeight: 1.8 }}>
          <Section title="1. Qu'est-ce qu'un cookie?">
            <p>
              Un cookie est un petit fichier texte stocké sur votre appareil (ordinateur, tablette, 
              smartphone) lorsque vous visitez un site web. Les cookies permettent au site de 
              reconnaître votre appareil et de mémoriser certaines informations sur vos préférences.
            </p>
          </Section>

          <Section title="2. Types de cookies utilisés">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>
              Cookies essentiels
            </h3>
            <p>
              Ces cookies sont nécessaires au fonctionnement du site. Ils permettent notamment:
            </p>
            <ul>
              <li>L'authentification et la sécurité de la session</li>
              <li>La mémorisation de vos préférences de langue</li>
              <li>Le bon fonctionnement du panier d'achat</li>
            </ul>
            <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--gray-400)' }}>
              <strong>Durée:</strong> Session ou jusqu'à 1 an
            </p>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>
              Cookies de performance
            </h3>
            <p>
              Ces cookies nous aident à comprendre comment les visiteurs utilisent notre site:
            </p>
            <ul>
              <li>Pages visitées et temps passé</li>
              <li>Erreurs rencontrées</li>
              <li>Performance du site</li>
            </ul>
            <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--gray-400)' }}>
              <strong>Exemples:</strong> Google Analytics, Hotjar
            </p>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>
              Cookies de fonctionnalité
            </h3>
            <p>
              Ces cookies permettent d'améliorer votre expérience:
            </p>
            <ul>
              <li>Mémorisation de vos préférences</li>
              <li>Personnalisation de l'interface</li>
              <li>Chat en direct</li>
            </ul>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>
              Cookies publicitaires
            </h3>
            <p>
              Ces cookies sont utilisés pour afficher des publicités pertinentes:
            </p>
            <ul>
              <li>Ciblage publicitaire</li>
              <li>Mesure de l'efficacité des campagnes</li>
              <li>Limitation de la fréquence d'affichage</li>
            </ul>
            <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--gray-400)' }}>
              <strong>Exemples:</strong> Google Ads, Meta Pixel, LinkedIn Insight
            </p>
          </Section>

          <Section title="3. Gestion des cookies">
            <p>
              Lors de votre première visite, une bannière vous permet de choisir les cookies que 
              vous acceptez. Vous pouvez modifier vos préférences à tout moment:
            </p>
            <ul>
              <li>En cliquant sur « Paramètres des cookies » en bas de page</li>
              <li>En modifiant les paramètres de votre navigateur</li>
            </ul>
            
            <div style={{ marginTop: '24px', padding: '20px', backgroundColor: 'var(--gray-50)', borderRadius: '8px' }}>
              <button 
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                Gérer mes préférences de cookies
              </button>
            </div>
          </Section>

          <Section title="4. Paramètres du navigateur">
            <p>
              Vous pouvez également gérer les cookies via votre navigateur:
            </p>
            <ul>
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Chrome</a></li>
              <li><a href="https://support.mozilla.org/fr/kb/cookies-informations-sites-enregistrent" target="_blank" rel="noopener">Firefox</a></li>
              <li><a href="https://support.apple.com/fr-ca/guide/safari/sfri11471/mac" target="_blank" rel="noopener">Safari</a></li>
              <li><a href="https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener">Edge</a></li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              <strong>Note:</strong> Le blocage de certains cookies peut affecter le fonctionnement du site.
            </p>
          </Section>

          <Section title="5. Cookies tiers">
            <p>
              Certains cookies sont déposés par des services tiers. Ces services ont leurs propres 
              politiques de confidentialité:
            </p>
            <ul>
              <li>Google Analytics: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Politique de confidentialité</a></li>
              <li>Stripe: <a href="https://stripe.com/privacy" target="_blank" rel="noopener">Politique de confidentialité</a></li>
              <li>Intercom: <a href="https://www.intercom.com/legal/privacy" target="_blank" rel="noopener">Politique de confidentialité</a></li>
            </ul>
          </Section>

          <Section title="6. Durée de conservation">
            <p>
              La durée de conservation des cookies varie selon leur type:
            </p>
            <ul>
              <li><strong>Cookies de session:</strong> Supprimés à la fermeture du navigateur</li>
              <li><strong>Cookies persistants:</strong> Jusqu'à 13 mois maximum</li>
              <li><strong>Cookies tiers:</strong> Selon la politique du tiers</li>
            </ul>
          </Section>

          <Section title="7. Contact">
            <p>Pour toute question sur notre utilisation des cookies:</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>📧 {process.env.NEXT_PUBLIC_PRIVACY_EMAIL || 'privacy@formationspro.com'}</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: 'var(--gray-500)' }}>
        {title}
      </h2>
      {children}
      <style jsx>{`
        ul { padding-left: 20px; margin: 8px 0; }
        li { margin-bottom: 8px; }
        a { color: var(--gray-500); }
      `}</style>
    </section>
  );
}
