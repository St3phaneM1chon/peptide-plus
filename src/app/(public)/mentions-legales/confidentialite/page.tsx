/**
 * PAGE POLITIQUE DE CONFIDENTIALITÉ
 * Conforme RGPD, PIPEDA, Loi 25
 */

export const metadata = {
  title: 'Politique de confidentialité | Formations Pro',
  description: 'Comment nous collectons, utilisons et protégeons vos données personnelles.',
};

export default function PrivacyPage() {
  const lastUpdated = '21 janvier 2026';

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Politique de confidentialité
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '48px' }}>
          Dernière mise à jour: {lastUpdated}
        </p>

        <div style={{ fontSize: '15px', color: 'var(--gray-500)', lineHeight: 1.8 }}>
          <Section title="1. Introduction">
            <p>
              {process.env.NEXT_PUBLIC_SITE_NAME || 'Formations Pro'} (« nous », « notre », « nos ») s'engage à protéger 
              la vie privée des utilisateurs de notre site web et de nos services. Cette politique de confidentialité 
              explique comment nous collectons, utilisons, divulguons et protégeons vos informations personnelles.
            </p>
          </Section>

          <Section title="2. Informations collectées">
            <p><strong>Informations que vous nous fournissez:</strong></p>
            <ul>
              <li>Informations de compte (nom, courriel, mot de passe)</li>
              <li>Informations de profil (téléphone, adresse, entreprise)</li>
              <li>Informations de paiement (traitées par nos prestataires sécurisés)</li>
              <li>Communications (messages de support, commentaires)</li>
            </ul>
            
            <p style={{ marginTop: '16px' }}><strong>Informations collectées automatiquement:</strong></p>
            <ul>
              <li>Données d'utilisation (pages visitées, durée des sessions)</li>
              <li>Informations de l'appareil (type, système d'exploitation)</li>
              <li>Adresse IP et données de localisation approximative</li>
              <li>Cookies et technologies similaires</li>
            </ul>
          </Section>

          <Section title="3. Utilisation des informations">
            <p>Nous utilisons vos informations pour:</p>
            <ul>
              <li>Fournir et améliorer nos services</li>
              <li>Traiter vos commandes et paiements</li>
              <li>Communiquer avec vous (support, mises à jour)</li>
              <li>Personnaliser votre expérience</li>
              <li>Assurer la sécurité de nos services</li>
              <li>Respecter nos obligations légales</li>
            </ul>
          </Section>

          <Section title="4. Base légale du traitement (RGPD)">
            <p>Nous traitons vos données sur les bases légales suivantes:</p>
            <ul>
              <li><strong>Exécution d'un contrat:</strong> pour fournir nos services</li>
              <li><strong>Consentement:</strong> pour les communications marketing</li>
              <li><strong>Intérêts légitimes:</strong> pour améliorer nos services</li>
              <li><strong>Obligation légale:</strong> pour la conformité réglementaire</li>
            </ul>
          </Section>

          <Section title="5. Partage des informations">
            <p>Nous ne vendons jamais vos données. Nous pouvons les partager avec:</p>
            <ul>
              <li>Prestataires de services (hébergement, paiement, analyse)</li>
              <li>Partenaires commerciaux (avec votre consentement)</li>
              <li>Autorités légales (si requis par la loi)</li>
            </ul>
          </Section>

          <Section title="6. Sécurité des données">
            <p>
              Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger 
              vos données, notamment:
            </p>
            <ul>
              <li>Chiffrement des données en transit et au repos</li>
              <li>Authentification à deux facteurs</li>
              <li>Contrôles d'accès stricts</li>
              <li>Audits de sécurité réguliers</li>
              <li>Conformité SOC 2 et ISO 27001</li>
            </ul>
          </Section>

          <Section title="7. Vos droits">
            <p>Conformément aux lois applicables (RGPD, PIPEDA, Loi 25), vous avez le droit de:</p>
            <ul>
              <li><strong>Accès:</strong> obtenir une copie de vos données</li>
              <li><strong>Rectification:</strong> corriger vos données inexactes</li>
              <li><strong>Effacement:</strong> demander la suppression de vos données</li>
              <li><strong>Portabilité:</strong> recevoir vos données dans un format structuré</li>
              <li><strong>Opposition:</strong> vous opposer à certains traitements</li>
              <li><strong>Retrait du consentement:</strong> à tout moment</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              Pour exercer ces droits, contactez-nous à: {process.env.NEXT_PUBLIC_PRIVACY_EMAIL || 'privacy@example.com'}
            </p>
          </Section>

          <Section title="8. Conservation des données">
            <p>
              Nous conservons vos données personnelles aussi longtemps que nécessaire pour les finalités 
              décrites dans cette politique, sauf obligation légale de conservation plus longue.
            </p>
            <ul>
              <li>Données de compte: durée de la relation + 3 ans</li>
              <li>Données de transaction: 7 ans (obligations fiscales)</li>
              <li>Données de navigation: 13 mois maximum</li>
            </ul>
          </Section>

          <Section title="9. Cookies">
            <p>
              Nous utilisons des cookies et technologies similaires. Pour plus d'informations, consultez notre{' '}
              <a href="/mentions-legales/cookies" style={{ color: 'var(--gray-500)', fontWeight: 500 }}>
                Politique de cookies
              </a>.
            </p>
          </Section>

          <Section title="10. Modifications">
            <p>
              Nous pouvons modifier cette politique à tout moment. Les modifications importantes seront 
              communiquées par courriel ou via notre site. La version en vigueur est toujours disponible sur cette page.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>Pour toute question concernant cette politique:</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>📧 {process.env.NEXT_PUBLIC_PRIVACY_EMAIL || 'privacy@example.com'}</li>
              <li>📞 {process.env.NEXT_PUBLIC_PHONE || '1-800-XXX-XXXX'}</li>
              <li>📍 {process.env.NEXT_PUBLIC_ADDRESS || '123 Rue Principale, Montréal, QC'}</li>
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
        ul {
          padding-left: 20px;
          margin: 8px 0;
        }
        li {
          margin-bottom: 8px;
        }
      `}</style>
    </section>
  );
}
