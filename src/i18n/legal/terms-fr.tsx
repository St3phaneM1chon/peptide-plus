'use client';

import React from 'react';

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

export default function TermsFR({ siteName }: { siteName: string }) {
  return (
    <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
      <Section title="1. Acceptation des conditions">
        <p>
          En accedant ou en utilisant le site web de {siteName} (&laquo; le Site &raquo;), vous acceptez d&apos;etre
          lie par ces conditions d&apos;utilisation. Si vous n&apos;acceptez pas ces conditions, vous ne
          devez pas utiliser le Site ni acheter nos produits.
        </p>
      </Section>

      <Section title="2. Description des produits">
        <p>
          {siteName} est un fournisseur canadien de peptides et composes de recherche de haute purete.
          Nos produits comprennent:
        </p>
        <ul>
          <li>Peptides synthetiques (vials, cartouches)</li>
          <li>Supplements de recherche (NAD+, creatine, etc.)</li>
          <li>Accessoires de laboratoire (seringues, solvants, aiguilles)</li>
          <li>Kits et protocoles de recherche</li>
        </ul>
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
          <p style={{ fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
            AVERTISSEMENT IMPORTANT - USAGE RECHERCHE UNIQUEMENT
          </p>
          <p style={{ color: '#92400e', fontSize: '14px' }}>
            Tous nos produits sont destines EXCLUSIVEMENT a des fins de recherche scientifique et de
            laboratoire. Ils ne sont PAS destines a la consommation humaine ou animale, au diagnostic,
            au traitement ou a la prevention de maladies.
          </p>
        </div>
      </Section>

      <Section title="3. Conditions d'achat">
        <p>
          Pour acheter sur notre site, vous devez:
        </p>
        <ul>
          <li>Etre age de 18 ans ou plus</li>
          <li>Fournir des informations exactes et completes</li>
          <li>Accepter que les produits sont uniquement destines a la recherche</li>
          <li>Ne pas revendre nos produits a des fins de consommation humaine</li>
          <li>Respecter toutes les lois et reglementations applicables dans votre juridiction</li>
        </ul>
      </Section>

      <Section title="4. Compte utilisateur">
        <p>
          Lors de la creation d&apos;un compte, vous vous engagez a:
        </p>
        <ul>
          <li>Fournir des informations veridiques et a jour</li>
          <li>Maintenir la confidentialite de vos identifiants</li>
          <li>Notifier immediatement tout acces non autorise a votre compte</li>
          <li>Ne pas partager votre compte avec des tiers</li>
          <li>Etre responsable de toutes les activites sous votre compte</li>
        </ul>
      </Section>

      <Section title="5. Prix et paiement">
        <p>
          Tous les prix sont affiches en dollars canadiens (CAD) sauf indication contraire.
          Nous acceptons les modes de paiement suivants:
        </p>
        <ul>
          <li>Cartes de credit (Visa, Mastercard, American Express)</li>
          <li>PayPal</li>
          <li>Apple Pay / Google Pay</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          Les taxes applicables (TPS/TVQ/TVH) seront ajoutees au moment du paiement selon votre
          province de livraison. Les commandes internationales peuvent etre soumises a des droits
          de douane et taxes d&apos;importation a la charge de l&apos;acheteur.
        </p>
      </Section>

      <Section title="6. Livraison">
        <p>
          Nous livrons au Canada et a l&apos;international. Les delais de livraison varient selon
          la destination:
        </p>
        <ul>
          <li>Canada: 3-7 jours ouvrables</li>
          <li>Etats-Unis: 5-10 jours ouvrables</li>
          <li>International: 7-21 jours ouvrables</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          Les produits sont expedies avec des packs refrigerants lorsque necessaire et sont
          emballes de maniere securitaire et discrete.
        </p>
      </Section>

      <Section title="7. Politique de retour et remboursement">
        <p>
          Nous acceptons les retours dans les conditions suivantes:
        </p>
        <ul>
          <li>Produits endommages ou defectueux a la reception</li>
          <li>Erreur de commande de notre part</li>
          <li>Produits non conformes aux specifications</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          Les demandes de retour doivent etre faites dans les 14 jours suivant la reception.
          Les produits ouverts ou utilises ne peuvent etre retournes pour des raisons de securite
          et de controle qualite.
        </p>
      </Section>

      <Section title="8. Qualite et certifications">
        <p>
          Tous nos peptides sont:
        </p>
        <ul>
          <li>Synthetises selon les normes cGMP</li>
          <li>Testes par des laboratoires tiers independants</li>
          <li>Accompagnes d&apos;un certificat d&apos;analyse (COA)</li>
          <li>Garantis a une purete minimale de 99%</li>
        </ul>
      </Section>

      <Section title="9. Propriete intellectuelle">
        <p>
          Tout le contenu du Site (textes, images, logos, donnees scientifiques, etc.) est protege
          par le droit d&apos;auteur et appartient a {siteName}. Toute reproduction non autorisee
          est interdite.
        </p>
      </Section>

      <Section title="10. Limitation de responsabilite">
        <p>
          {siteName} ne pourra etre tenu responsable:
        </p>
        <ul>
          <li>De tout usage des produits contraire aux presentes conditions</li>
          <li>De toute consommation humaine ou animale de nos produits</li>
          <li>Des resultats de recherche obtenus avec nos produits</li>
          <li>Des retards de livraison causes par des tiers</li>
          <li>Des dommages indirects ou consecutifs</li>
        </ul>
      </Section>

      <Section title="11. Droit applicable">
        <p>
          Ces conditions sont regies par les lois de la province de Quebec, Canada. Tout litige
          sera soumis a la competence exclusive des tribunaux de Montreal, Quebec.
        </p>
      </Section>

      <Section title="12. Modifications">
        <p>
          Nous nous reservons le droit de modifier ces conditions a tout moment. Les modifications
          seront publiees sur cette page avec une nouvelle date de mise a jour. Votre utilisation
          continue du Site apres modification constitue votre acceptation des nouvelles conditions.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>Pour toute question concernant ces conditions:</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>legal@biocyclepeptides.com</li>
          <li>Montreal, Quebec, Canada</li>
        </ul>
      </Section>
    </div>
  );
}
