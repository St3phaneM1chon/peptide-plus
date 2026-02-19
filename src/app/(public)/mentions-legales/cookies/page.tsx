'use client';

import { useState } from 'react';

/**
 * PAGE POLITIQUE DE COOKIES - BioCycle Peptides
 */

export default function CookiesPage() {
  const lastUpdated = '25 janvier 2026';
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: true,
    functional: true,
    marketing: false,
  });

  const savePreferences = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('biocycle-cookie-preferences', JSON.stringify(preferences));
      setShowPreferences(false);
      alert('Vos préférences de cookies ont été sauvegardées.');
    }
  };

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px', color: '#1f2937' }}>
          Politique de cookies
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '48px' }}>
          Dernière mise à jour: {lastUpdated}
        </p>

        <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
          <Section title="1. Qu'est-ce qu'un cookie?">
            <p>
              Un cookie est un petit fichier texte stocké sur votre appareil (ordinateur, tablette, 
              smartphone) lorsque vous visitez un site web. Les cookies permettent au site de 
              reconnaître votre appareil et de mémoriser certaines informations sur vos préférences 
              ou actions passées.
            </p>
          </Section>

          <Section title="2. Types de cookies utilisés">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#059669' }}>
              ✓ Cookies essentiels (obligatoires)
            </h3>
            <p>
              Ces cookies sont nécessaires au fonctionnement du site BioCycle Peptides:
            </p>
            <ul>
              <li>Authentification et sécurité de la session</li>
              <li>Mémorisation de votre panier d&apos;achat</li>
              <li>Préférences de langue et devise</li>
              <li>Protection contre la fraude</li>
            </ul>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
              <strong>Durée:</strong> Session ou jusqu&apos;à 1 an
            </p>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#3b82f6' }}>
              📊 Cookies analytiques
            </h3>
            <p>
              Ces cookies nous aident à comprendre comment vous utilisez notre site:
            </p>
            <ul>
              <li>Pages visitées et produits consultés</li>
              <li>Temps passé sur le site</li>
              <li>Erreurs rencontrées</li>
              <li>Performance du site</li>
            </ul>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
              <strong>Service:</strong> Google Analytics (anonymisé)
            </p>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#8b5cf6' }}>
              ⚙️ Cookies fonctionnels
            </h3>
            <p>
              Ces cookies améliorent votre expérience sur notre site:
            </p>
            <ul>
              <li>Mémorisation de vos préférences d&apos;affichage</li>
              <li>Produits récemment consultés</li>
              <li>Personnalisation de l&apos;interface</li>
            </ul>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#CC5500' }}>
              📢 Cookies marketing (optionnels)
            </h3>
            <p>
              Ces cookies sont utilisés pour afficher des publicités pertinentes:
            </p>
            <ul>
              <li>Publicités ciblées sur d&apos;autres sites</li>
              <li>Mesure de l&apos;efficacité des campagnes</li>
              <li>Recommandations de produits</li>
            </ul>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
              <strong>Services:</strong> Meta Pixel, Google Ads (si activés)
            </p>
          </Section>

          <Section title="3. Gestion des cookies">
            <p>
              Lors de votre première visite, une bannière vous permet de choisir les cookies que 
              vous acceptez. Vous pouvez modifier vos préférences à tout moment:
            </p>
            
            <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <button 
                onClick={() => setShowPreferences(!showPreferences)}
                style={{ 
                  width: '100%', 
                  padding: '12px 24px', 
                  backgroundColor: '#CC5500', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Gérer mes préférences de cookies
              </button>

              {showPreferences && (
                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'white', borderRadius: '8px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'not-allowed' }}>
                      <input type="checkbox" checked disabled style={{ width: '18px', height: '18px' }} />
                      <span><strong>Essentiels</strong> - Toujours actifs (nécessaires au fonctionnement)</span>
                    </label>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences({...preferences, analytics: e.target.checked})}
                        style={{ width: '18px', height: '18px' }} 
                      />
                      <span><strong>Analytiques</strong> - Nous aident à améliorer le site</span>
                    </label>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={preferences.functional}
                        onChange={(e) => setPreferences({...preferences, functional: e.target.checked})}
                        style={{ width: '18px', height: '18px' }} 
                      />
                      <span><strong>Fonctionnels</strong> - Améliorent votre expérience</span>
                    </label>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={preferences.marketing}
                        onChange={(e) => setPreferences({...preferences, marketing: e.target.checked})}
                        style={{ width: '18px', height: '18px' }} 
                      />
                      <span><strong>Marketing</strong> - Publicités personnalisées</span>
                    </label>
                  </div>
                  <button 
                    onClick={savePreferences}
                    style={{ 
                      marginTop: '12px',
                      padding: '10px 20px', 
                      backgroundColor: '#059669', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '6px', 
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Sauvegarder mes préférences
                  </button>
                </div>
              )}
            </div>
          </Section>

          <Section title="4. Paramètres du navigateur">
            <p>
              Vous pouvez également gérer les cookies via les paramètres de votre navigateur:
            </p>
            <ul>
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a></li>
              <li><a href="https://support.mozilla.org/fr/kb/cookies-informations-sites-enregistrent" target="_blank" rel="noopener noreferrer">Firefox</a></li>
              <li><a href="https://support.apple.com/fr-ca/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
              <li><a href="https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Edge</a></li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              <strong>Note:</strong> Le blocage de certains cookies peut affecter le fonctionnement 
              du site (panier, connexion, préférences).
            </p>
          </Section>

          <Section title="5. Cookies tiers">
            <p>
              Certains cookies sont déposés par des services tiers. Ces services ont leurs propres 
              politiques de confidentialité:
            </p>
            <ul>
              <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Analytics</a></li>
              <li><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe (paiements)</a></li>
              <li><a href="https://www.paypal.com/ca/webapps/mpp/ua/privacy-full" target="_blank" rel="noopener noreferrer">PayPal (paiements)</a></li>
            </ul>
          </Section>

          <Section title="6. Durée de conservation">
            <p>
              La durée de conservation des cookies varie selon leur type:
            </p>
            <ul>
              <li><strong>Cookies de session:</strong> Supprimés à la fermeture du navigateur</li>
              <li><strong>Cookies persistants:</strong> Jusqu&apos;à 13 mois maximum</li>
              <li><strong>Cookies tiers:</strong> Selon la politique du service tiers</li>
            </ul>
          </Section>

          <Section title="7. Contact">
            <p>Pour toute question sur notre utilisation des cookies:</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>📧 privacy@biocyclepeptides.com</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '40px' }} className="legal-content">
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
