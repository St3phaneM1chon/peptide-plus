'use client';

/**
 * PAGE CONDITIONS D'UTILISATION - BioCycle Peptides
 * Spécifique à la vente de peptides de recherche
 */

export default function TermsPage() {
  const lastUpdated = '25 janvier 2026';
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BioCycle Peptides';

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px', color: '#1f2937' }}>
          Conditions d&apos;utilisation
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '48px' }}>
          Dernière mise à jour: {lastUpdated}
        </p>

        <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
          <Section title="1. Acceptation des conditions">
            <p>
              En accédant ou en utilisant le site web de {siteName} (« le Site »), vous acceptez d&apos;être 
              lié par ces conditions d&apos;utilisation. Si vous n&apos;acceptez pas ces conditions, vous ne 
              devez pas utiliser le Site ni acheter nos produits.
            </p>
          </Section>

          <Section title="2. Description des produits">
            <p>
              {siteName} est un fournisseur canadien de peptides et composés de recherche de haute pureté. 
              Nos produits comprennent:
            </p>
            <ul>
              <li>Peptides synthétiques (vials, cartouches)</li>
              <li>Suppléments de recherche (NAD+, créatine, etc.)</li>
              <li>Accessoires de laboratoire (seringues, solvants, aiguilles)</li>
              <li>Kits et protocoles de recherche</li>
            </ul>
            <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <p style={{ fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
                ⚠️ AVERTISSEMENT IMPORTANT - USAGE RECHERCHE UNIQUEMENT
              </p>
              <p style={{ color: '#92400e', fontSize: '14px' }}>
                Tous nos produits sont destinés EXCLUSIVEMENT à des fins de recherche scientifique et de 
                laboratoire. Ils ne sont PAS destinés à la consommation humaine ou animale, au diagnostic, 
                au traitement ou à la prévention de maladies.
              </p>
            </div>
          </Section>

          <Section title="3. Conditions d'achat">
            <p>
              Pour acheter sur notre site, vous devez:
            </p>
            <ul>
              <li>Être âgé de 18 ans ou plus</li>
              <li>Fournir des informations exactes et complètes</li>
              <li>Accepter que les produits sont uniquement destinés à la recherche</li>
              <li>Ne pas revendre nos produits à des fins de consommation humaine</li>
              <li>Respecter toutes les lois et réglementations applicables dans votre juridiction</li>
            </ul>
          </Section>

          <Section title="4. Compte utilisateur">
            <p>
              Lors de la création d&apos;un compte, vous vous engagez à:
            </p>
            <ul>
              <li>Fournir des informations véridiques et à jour</li>
              <li>Maintenir la confidentialité de vos identifiants</li>
              <li>Notifier immédiatement tout accès non autorisé à votre compte</li>
              <li>Ne pas partager votre compte avec des tiers</li>
              <li>Être responsable de toutes les activités sous votre compte</li>
            </ul>
          </Section>

          <Section title="5. Prix et paiement">
            <p>
              Tous les prix sont affichés en dollars canadiens (CAD) sauf indication contraire. 
              Nous acceptons les modes de paiement suivants:
            </p>
            <ul>
              <li>Cartes de crédit (Visa, Mastercard, American Express)</li>
              <li>PayPal</li>
              <li>Apple Pay / Google Pay</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              Les taxes applicables (TPS/TVQ/TVH) seront ajoutées au moment du paiement selon votre 
              province de livraison. Les commandes internationales peuvent être soumises à des droits 
              de douane et taxes d&apos;importation à la charge de l&apos;acheteur.
            </p>
          </Section>

          <Section title="6. Livraison">
            <p>
              Nous livrons au Canada et à l&apos;international. Les délais de livraison varient selon 
              la destination:
            </p>
            <ul>
              <li>Canada: 3-7 jours ouvrables</li>
              <li>États-Unis: 5-10 jours ouvrables</li>
              <li>International: 7-21 jours ouvrables</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              Les produits sont expédiés avec des packs réfrigérants lorsque nécessaire et sont 
              emballés de manière sécuritaire et discrète.
            </p>
          </Section>

          <Section title="7. Politique de retour et remboursement">
            <p>
              Nous acceptons les retours dans les conditions suivantes:
            </p>
            <ul>
              <li>Produits endommagés ou défectueux à la réception</li>
              <li>Erreur de commande de notre part</li>
              <li>Produits non conformes aux spécifications</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              Les demandes de retour doivent être faites dans les 14 jours suivant la réception. 
              Les produits ouverts ou utilisés ne peuvent être retournés pour des raisons de sécurité 
              et de contrôle qualité.
            </p>
          </Section>

          <Section title="8. Qualité et certifications">
            <p>
              Tous nos peptides sont:
            </p>
            <ul>
              <li>Synthétisés selon les normes cGMP</li>
              <li>Testés par des laboratoires tiers indépendants</li>
              <li>Accompagnés d&apos;un certificat d&apos;analyse (COA)</li>
              <li>Garantis à une pureté minimale de 99%</li>
            </ul>
          </Section>

          <Section title="9. Propriété intellectuelle">
            <p>
              Tout le contenu du Site (textes, images, logos, données scientifiques, etc.) est protégé 
              par le droit d&apos;auteur et appartient à {siteName}. Toute reproduction non autorisée 
              est interdite.
            </p>
          </Section>

          <Section title="10. Limitation de responsabilité">
            <p>
              {siteName} ne pourra être tenu responsable:
            </p>
            <ul>
              <li>De tout usage des produits contraire aux présentes conditions</li>
              <li>De toute consommation humaine ou animale de nos produits</li>
              <li>Des résultats de recherche obtenus avec nos produits</li>
              <li>Des retards de livraison causés par des tiers</li>
              <li>Des dommages indirects ou consécutifs</li>
            </ul>
          </Section>

          <Section title="11. Droit applicable">
            <p>
              Ces conditions sont régies par les lois de la province de Québec, Canada. Tout litige 
              sera soumis à la compétence exclusive des tribunaux de Montréal, Québec.
            </p>
          </Section>

          <Section title="12. Modifications">
            <p>
              Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications 
              seront publiées sur cette page avec une nouvelle date de mise à jour. Votre utilisation 
              continue du Site après modification constitue votre acceptation des nouvelles conditions.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>Pour toute question concernant ces conditions:</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>📧 legal@biocyclepeptides.com</li>
              <li>📍 Montréal, Québec, Canada</li>
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
