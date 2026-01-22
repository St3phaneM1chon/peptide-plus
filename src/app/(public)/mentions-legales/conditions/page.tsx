/**
 * PAGE CONDITIONS D'UTILISATION
 */

export const metadata = {
  title: 'Conditions d\'utilisation | Formations Pro',
  description: 'Conditions générales d\'utilisation de notre plateforme.',
};

export default function TermsPage() {
  const lastUpdated = '21 janvier 2026';

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Conditions d'utilisation
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '48px' }}>
          Dernière mise à jour: {lastUpdated}
        </p>

        <div style={{ fontSize: '15px', color: 'var(--gray-500)', lineHeight: 1.8 }}>
          <Section title="1. Acceptation des conditions">
            <p>
              En accédant ou en utilisant les services de {process.env.NEXT_PUBLIC_SITE_NAME || 'Formations Pro'} 
              (« le Service »), vous acceptez d'être lié par ces conditions d'utilisation. Si vous n'acceptez pas 
              ces conditions, vous ne devez pas utiliser le Service.
            </p>
          </Section>

          <Section title="2. Description du service">
            <p>
              Le Service est une plateforme de formation professionnelle en ligne qui permet aux utilisateurs 
              d'accéder à des cours, des certifications et des ressources éducatives. Le Service comprend:
            </p>
            <ul>
              <li>L'accès à des formations en ligne</li>
              <li>Des outils de suivi de progression</li>
              <li>Des certificats de complétion</li>
              <li>Des fonctionnalités de gestion pour les entreprises</li>
            </ul>
          </Section>

          <Section title="3. Inscription et compte">
            <p>
              Pour utiliser certaines fonctionnalités du Service, vous devez créer un compte. Vous vous engagez à:
            </p>
            <ul>
              <li>Fournir des informations exactes et complètes</li>
              <li>Maintenir la confidentialité de vos identifiants</li>
              <li>Notifier immédiatement tout accès non autorisé</li>
              <li>Ne pas partager votre compte avec des tiers</li>
            </ul>
          </Section>

          <Section title="4. Droits de propriété intellectuelle">
            <p>
              Tout le contenu du Service (textes, vidéos, images, logos, etc.) est protégé par le droit d'auteur 
              et appartient à {process.env.NEXT_PUBLIC_SITE_NAME || 'Formations Pro'} ou à ses partenaires. Vous bénéficiez d'une 
              licence limitée, non exclusive et non transférable pour accéder au contenu dans le cadre de votre 
              utilisation personnelle du Service.
            </p>
            <p style={{ marginTop: '16px' }}>
              Il est interdit de:
            </p>
            <ul>
              <li>Reproduire, distribuer ou modifier le contenu</li>
              <li>Télécharger les vidéos sans autorisation</li>
              <li>Partager les identifiants ou l'accès</li>
              <li>Utiliser le contenu à des fins commerciales</li>
            </ul>
          </Section>

          <Section title="5. Paiement et abonnements">
            <p>
              Certaines fonctionnalités du Service sont payantes. En souscrivant à un abonnement, vous acceptez:
            </p>
            <ul>
              <li>Les tarifs en vigueur au moment de la souscription</li>
              <li>Le renouvellement automatique sauf annulation</li>
              <li>Les conditions de notre politique de remboursement</li>
            </ul>
          </Section>

          <Section title="6. Politique de remboursement">
            <p>
              Nous offrons une garantie satisfait ou remboursé de 30 jours sur les formations individuelles. 
              Pour les abonnements, le remboursement est proratisé selon la période non utilisée. Les demandes 
              de remboursement doivent être adressées à notre service client.
            </p>
          </Section>

          <Section title="7. Comportement de l'utilisateur">
            <p>
              Vous vous engagez à utiliser le Service de manière responsable et à ne pas:
            </p>
            <ul>
              <li>Violer les lois applicables</li>
              <li>Porter atteinte aux droits de tiers</li>
              <li>Publier du contenu illicite ou offensant</li>
              <li>Tenter de pirater ou perturber le Service</li>
              <li>Utiliser des robots ou scripts automatisés</li>
            </ul>
          </Section>

          <Section title="8. Limitation de responsabilité">
            <p>
              Le Service est fourni « tel quel ». Nous ne garantissons pas que le Service sera ininterrompu, 
              sécurisé ou exempt d'erreurs. Dans les limites permises par la loi, nous déclinons toute 
              responsabilité pour les dommages indirects, accessoires ou consécutifs.
            </p>
          </Section>

          <Section title="9. Modification des conditions">
            <p>
              Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications 
              importantes seront notifiées par email. Votre utilisation continue du Service après 
              modification constitue votre acceptation des nouvelles conditions.
            </p>
          </Section>

          <Section title="10. Résiliation">
            <p>
              Vous pouvez résilier votre compte à tout moment depuis les paramètres de votre profil. 
              Nous nous réservons le droit de suspendre ou résilier votre compte en cas de violation 
              de ces conditions.
            </p>
          </Section>

          <Section title="11. Droit applicable">
            <p>
              Ces conditions sont régies par les lois de la province de Québec, Canada. Tout litige 
              sera soumis à la compétence exclusive des tribunaux de Montréal.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>Pour toute question concernant ces conditions:</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>📧 {process.env.NEXT_PUBLIC_LEGAL_EMAIL || 'legal@formationspro.com'}</li>
              <li>📞 {process.env.NEXT_PUBLIC_PHONE || '1-800-XXX-XXXX'}</li>
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
      `}</style>
    </section>
  );
}
