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

export default function PrivacyFR({ siteName }: { siteName: string }) {
  return (
    <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
      <Section title="1. Introduction">
        <p>
          {siteName} (&laquo; nous &raquo;, &laquo; notre &raquo;, &laquo; nos &raquo;) s&apos;engage a proteger la vie privee de ses
          clients et visiteurs. Cette politique explique comment nous collectons, utilisons,
          divulguons et protegeons vos informations personnelles conformement a:
        </p>
        <ul>
          <li>La Loi sur la protection des renseignements personnels (LPRPDE/PIPEDA) - Canada</li>
          <li>La Loi 25 sur la protection des renseignements personnels - Quebec</li>
          <li>Le Reglement general sur la protection des donnees (RGPD) - Union europeenne</li>
        </ul>
      </Section>

      <Section title="2. Informations collectees">
        <p><strong>Informations que vous nous fournissez:</strong></p>
        <ul>
          <li>Informations de compte (nom, courriel, mot de passe)</li>
          <li>Informations de livraison (adresse, telephone)</li>
          <li>Informations de paiement (traitees par Stripe/PayPal de maniere securisee)</li>
          <li>Communications (messages de support, questions sur les produits)</li>
        </ul>

        <p style={{ marginTop: '16px' }}><strong>Informations collectees automatiquement:</strong></p>
        <ul>
          <li>Donnees de navigation (pages visitees, produits consultes)</li>
          <li>Informations techniques (type d&apos;appareil, navigateur, systeme d&apos;exploitation)</li>
          <li>Adresse IP et donnees de localisation approximative</li>
          <li>Cookies et technologies similaires (voir notre politique de cookies)</li>
        </ul>
      </Section>

      <Section title="3. Utilisation des informations">
        <p>Nous utilisons vos informations pour:</p>
        <ul>
          <li>Traiter et expedier vos commandes de produits de recherche</li>
          <li>Gerer votre compte et programme de fidelite</li>
          <li>Communiquer sur le statut de vos commandes</li>
          <li>Repondre a vos questions et demandes de support</li>
          <li>Envoyer des informations sur nos nouveaux produits (avec votre consentement)</li>
          <li>Ameliorer notre site et nos services</li>
          <li>Prevenir la fraude et assurer la securite</li>
          <li>Respecter nos obligations legales et fiscales</li>
        </ul>
      </Section>

      <Section title="4. Base legale du traitement">
        <p>Nous traitons vos donnees sur les bases legales suivantes:</p>
        <ul>
          <li><strong>Execution d&apos;un contrat:</strong> pour traiter vos commandes et livraisons</li>
          <li><strong>Consentement:</strong> pour les communications marketing et newsletter</li>
          <li><strong>Interets legitimes:</strong> pour ameliorer nos services et prevenir la fraude</li>
          <li><strong>Obligation legale:</strong> pour la conformite fiscale et reglementaire</li>
        </ul>
      </Section>

      <Section title="5. Partage des informations">
        <p>Nous ne vendons jamais vos donnees personnelles. Nous pouvons les partager avec:</p>
        <ul>
          <li><strong>Transporteurs:</strong> Postes Canada, FedEx, UPS pour la livraison</li>
          <li><strong>Processeurs de paiement:</strong> Stripe, PayPal (donnees de paiement uniquement)</li>
          <li><strong>Services d&apos;analyse:</strong> Google Analytics (donnees anonymisees)</li>
          <li><strong>Autorites legales:</strong> si requis par la loi ou ordonnance judiciaire</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          Tous nos partenaires sont contractuellement tenus de proteger vos donnees et de ne
          les utiliser que pour les fins specifiees.
        </p>
      </Section>

      <Section title="6. Securite des donnees">
        <p>
          Nous mettons en oeuvre des mesures de securite rigoureuses pour proteger vos donnees:
        </p>
        <ul>
          <li>Chiffrement SSL/TLS pour toutes les transmissions de donnees</li>
          <li>Chiffrement des donnees sensibles au repos</li>
          <li>Authentification a deux facteurs disponible pour les comptes</li>
          <li>Acces restreint aux donnees selon le principe du besoin de connaitre</li>
          <li>Surveillance continue et audits de securite reguliers</li>
          <li>Hebergement sur des serveurs securises au Canada</li>
        </ul>
      </Section>

      <Section title="7. Vos droits">
        <p>Conformement aux lois applicables, vous avez le droit de:</p>
        <ul>
          <li><strong>Acces:</strong> obtenir une copie de vos donnees personnelles</li>
          <li><strong>Rectification:</strong> corriger vos donnees inexactes ou incompletes</li>
          <li><strong>Effacement:</strong> demander la suppression de vos donnees (&laquo; droit a l&apos;oubli &raquo;)</li>
          <li><strong>Portabilite:</strong> recevoir vos donnees dans un format structure et lisible</li>
          <li><strong>Opposition:</strong> vous opposer au traitement de vos donnees a des fins marketing</li>
          <li><strong>Retrait du consentement:</strong> retirer votre consentement a tout moment</li>
          <li><strong>Plainte:</strong> deposer une plainte aupres de la Commission d&apos;acces a l&apos;information du Quebec</li>
        </ul>
        <p style={{ marginTop: '16px' }}>
          Pour exercer ces droits, contactez-nous a: <strong>privacy@biocyclepeptides.com</strong>
        </p>
      </Section>

      <Section title="8. Conservation des donnees">
        <p>
          Nous conservons vos donnees personnelles selon les durees suivantes:
        </p>
        <ul>
          <li><strong>Donnees de compte:</strong> duree de la relation commerciale + 3 ans</li>
          <li><strong>Donnees de commande:</strong> 7 ans (obligations fiscales canadiennes)</li>
          <li><strong>Donnees de navigation:</strong> 13 mois maximum</li>
          <li><strong>Communications support:</strong> 3 ans apres resolution</li>
        </ul>
      </Section>

      <Section title="9. Transferts internationaux">
        <p>
          Vos donnees sont principalement stockees au Canada. En cas de transfert vers d&apos;autres
          pays (ex: Etats-Unis pour certains services), nous nous assurons que des garanties
          appropriees sont en place (clauses contractuelles types, certifications).
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

      <Section title="11. Responsable de la protection des donnees">
        <p>
          Pour toute question concernant la protection de vos donnees personnelles, vous pouvez
          contacter notre responsable de la protection des donnees:
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>privacy@biocyclepeptides.com</li>
          <li>Montreal, Quebec, Canada</li>
        </ul>
      </Section>

      <Section title="12. Modifications">
        <p>
          Nous pouvons modifier cette politique a tout moment. Les modifications importantes
          seront communiquees par courriel ou via notre site. La version en vigueur est toujours
          disponible sur cette page avec la date de derniere mise a jour.
        </p>
      </Section>
    </div>
  );
}
