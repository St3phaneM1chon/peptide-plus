'use client';

/**
 * PAGE POLITIQUE DE CONFIDENTIALITÉ - BioCycle Peptides
 * Conforme RGPD, PIPEDA, Loi 25 Québec
 */

export default function PrivacyPage() {
  const lastUpdated = '25 janvier 2026';
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BioCycle Peptides';

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px', color: '#1f2937' }}>
          Politique de confidentialité
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '48px' }}>
          Dernière mise à jour: {lastUpdated}
        </p>

        <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
          <Section title="1. Introduction">
            <p>
              {siteName} (« nous », « notre », « nos ») s&apos;engage à protéger la vie privée de ses 
              clients et visiteurs. Cette politique explique comment nous collectons, utilisons, 
              divulguons et protégeons vos informations personnelles conformément à:
            </p>
            <ul>
              <li>La Loi sur la protection des renseignements personnels (LPRPDE/PIPEDA) - Canada</li>
              <li>La Loi 25 sur la protection des renseignements personnels - Québec</li>
              <li>Le Règlement général sur la protection des données (RGPD) - Union européenne</li>
            </ul>
          </Section>

          <Section title="2. Informations collectées">
            <p><strong>Informations que vous nous fournissez:</strong></p>
            <ul>
              <li>Informations de compte (nom, courriel, mot de passe)</li>
              <li>Informations de livraison (adresse, téléphone)</li>
              <li>Informations de paiement (traitées par Stripe/PayPal de manière sécurisée)</li>
              <li>Communications (messages de support, questions sur les produits)</li>
            </ul>
            
            <p style={{ marginTop: '16px' }}><strong>Informations collectées automatiquement:</strong></p>
            <ul>
              <li>Données de navigation (pages visitées, produits consultés)</li>
              <li>Informations techniques (type d&apos;appareil, navigateur, système d&apos;exploitation)</li>
              <li>Adresse IP et données de localisation approximative</li>
              <li>Cookies et technologies similaires (voir notre politique de cookies)</li>
            </ul>
          </Section>

          <Section title="3. Utilisation des informations">
            <p>Nous utilisons vos informations pour:</p>
            <ul>
              <li>Traiter et expédier vos commandes de produits de recherche</li>
              <li>Gérer votre compte et programme de fidélité</li>
              <li>Communiquer sur le statut de vos commandes</li>
              <li>Répondre à vos questions et demandes de support</li>
              <li>Envoyer des informations sur nos nouveaux produits (avec votre consentement)</li>
              <li>Améliorer notre site et nos services</li>
              <li>Prévenir la fraude et assurer la sécurité</li>
              <li>Respecter nos obligations légales et fiscales</li>
            </ul>
          </Section>

          <Section title="4. Base légale du traitement">
            <p>Nous traitons vos données sur les bases légales suivantes:</p>
            <ul>
              <li><strong>Exécution d&apos;un contrat:</strong> pour traiter vos commandes et livraisons</li>
              <li><strong>Consentement:</strong> pour les communications marketing et newsletter</li>
              <li><strong>Intérêts légitimes:</strong> pour améliorer nos services et prévenir la fraude</li>
              <li><strong>Obligation légale:</strong> pour la conformité fiscale et réglementaire</li>
            </ul>
          </Section>

          <Section title="5. Partage des informations">
            <p>Nous ne vendons jamais vos données personnelles. Nous pouvons les partager avec:</p>
            <ul>
              <li><strong>Transporteurs:</strong> Postes Canada, FedEx, UPS pour la livraison</li>
              <li><strong>Processeurs de paiement:</strong> Stripe, PayPal (données de paiement uniquement)</li>
              <li><strong>Services d&apos;analyse:</strong> Google Analytics (données anonymisées)</li>
              <li><strong>Autorités légales:</strong> si requis par la loi ou ordonnance judiciaire</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              Tous nos partenaires sont contractuellement tenus de protéger vos données et de ne 
              les utiliser que pour les fins spécifiées.
            </p>
          </Section>

          <Section title="6. Sécurité des données">
            <p>
              Nous mettons en œuvre des mesures de sécurité rigoureuses pour protéger vos données:
            </p>
            <ul>
              <li>Chiffrement SSL/TLS pour toutes les transmissions de données</li>
              <li>Chiffrement des données sensibles au repos</li>
              <li>Authentification à deux facteurs disponible pour les comptes</li>
              <li>Accès restreint aux données selon le principe du besoin de connaître</li>
              <li>Surveillance continue et audits de sécurité réguliers</li>
              <li>Hébergement sur des serveurs sécurisés au Canada</li>
            </ul>
          </Section>

          <Section title="7. Vos droits">
            <p>Conformément aux lois applicables, vous avez le droit de:</p>
            <ul>
              <li><strong>Accès:</strong> obtenir une copie de vos données personnelles</li>
              <li><strong>Rectification:</strong> corriger vos données inexactes ou incomplètes</li>
              <li><strong>Effacement:</strong> demander la suppression de vos données (« droit à l&apos;oubli »)</li>
              <li><strong>Portabilité:</strong> recevoir vos données dans un format structuré et lisible</li>
              <li><strong>Opposition:</strong> vous opposer au traitement de vos données à des fins marketing</li>
              <li><strong>Retrait du consentement:</strong> retirer votre consentement à tout moment</li>
              <li><strong>Plainte:</strong> déposer une plainte auprès de la Commission d&apos;accès à l&apos;information du Québec</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              Pour exercer ces droits, contactez-nous à: <strong>privacy@biocyclepeptides.com</strong>
            </p>
          </Section>

          <Section title="8. Conservation des données">
            <p>
              Nous conservons vos données personnelles selon les durées suivantes:
            </p>
            <ul>
              <li><strong>Données de compte:</strong> durée de la relation commerciale + 3 ans</li>
              <li><strong>Données de commande:</strong> 7 ans (obligations fiscales canadiennes)</li>
              <li><strong>Données de navigation:</strong> 13 mois maximum</li>
              <li><strong>Communications support:</strong> 3 ans après résolution</li>
            </ul>
          </Section>

          <Section title="9. Transferts internationaux">
            <p>
              Vos données sont principalement stockées au Canada. En cas de transfert vers d&apos;autres 
              pays (ex: États-Unis pour certains services), nous nous assurons que des garanties 
              appropriées sont en place (clauses contractuelles types, certifications).
            </p>
          </Section>

          <Section title="10. Cookies">
            <p>
              Nous utilisons des cookies et technologies similaires. Pour plus d&apos;informations, consultez notre{' '}
              <a href="/mentions-legales/cookies" style={{ color: '#CC5500', fontWeight: 500 }}>
                Politique de cookies
              </a>.
            </p>
          </Section>

          <Section title="11. Responsable de la protection des données">
            <p>
              Pour toute question concernant la protection de vos données personnelles, vous pouvez 
              contacter notre responsable de la protection des données:
            </p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>📧 privacy@biocyclepeptides.com</li>
              <li>📍 Montréal, Québec, Canada</li>
            </ul>
          </Section>

          <Section title="12. Modifications">
            <p>
              Nous pouvons modifier cette politique à tout moment. Les modifications importantes 
              seront communiquées par courriel ou via notre site. La version en vigueur est toujours 
              disponible sur cette page avec la date de dernière mise à jour.
            </p>
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
