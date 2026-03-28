/**
 * Tenant Email Templates — Koraline SaaS Platform
 *
 * Emails sent to tenant owners for subscription lifecycle events.
 * All templates use proper Attitudes VIP / Koraline branding with
 * consistent header, footer, and #0066CC brand color.
 */

interface TenantWelcomeData {
  tenantName: string;
  ownerName: string;
  ownerEmail: string;
  plan: string;
  planName: string;
  domainKoraline: string;
  adminUrl: string;
}

interface TenantOwnerCredentialsData {
  tenantName: string;
  ownerName: string;
  ownerEmail: string;
  temporaryPassword: string;
  resetPasswordUrl: string;
  adminUrl: string;
  planName: string;
  domainKoraline: string;
}

interface TenantPasswordResetData {
  ownerName: string;
  resetUrl: string;
  expiresInHours: number;
  adminInitiated?: boolean;
}

interface TenantOnboardingReminderData {
  tenantName: string;
  ownerName: string;
  adminUrl: string;
}

interface ModuleActivatedData {
  tenantName: string;
  ownerName: string;
  moduleName: string;
  monthlyPrice: number;
  adminUrl: string;
}

interface PlanUpgradeData {
  tenantName: string;
  ownerName: string;
  oldPlanName: string;
  newPlanName: string;
  newMonthlyPrice: number;
  adminUrl: string;
}

interface ModuleAccumulationData {
  tenantName: string;
  ownerName: string;
  moduleName: string;
  freeUntil: string;
  adminUrl: string;
}

/** Escape user-supplied strings before inserting into HTML email templates. */
function escapeHtmlTenant(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function tenantBaseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .card { background: #ffffff; border-radius: 16px; padding: 32px; margin-bottom: 16px; }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 700; color: #0066CC; }
    .logo span { color: #003366; }
    h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0; }
    h2 { font-size: 18px; font-weight: 600; color: #1a1a1a; margin: 16px 0 8px 0; }
    p { font-size: 15px; line-height: 1.6; color: #4a4a4a; margin: 0 0 12px 0; }
    .info-box { background: #f0f7ff; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e5e5; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6a6a6a; }
    .info-value { font-weight: 600; color: #1a1a1a; }
    .btn { display: inline-block; padding: 14px 28px; background: #0066CC; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; text-align: center; }
    .btn-container { text-align: center; margin: 24px 0; }
    .footer { text-align: center; padding: 24px 0; font-size: 12px; color: #999; }
    .highlight { color: #0066CC; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Kor@line <span>by Attitudes VIP</span></div>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Attitudes VIP Inc. Tous droits r&eacute;serv&eacute;s.</p>
      <p>Cet email a &eacute;t&eacute; envoy&eacute; par la plateforme Koraline.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Welcome email sent after tenant provisioning.
 */
export function tenantWelcomeEmail(data: TenantWelcomeData): { subject: string; html: string } {
  const content = `
    <h1>Bienvenue sur Koraline !</h1>
    <p>Bonjour ${data.ownerName},</p>
    <p>Votre boutique <strong>${data.tenantName}</strong> est maintenant active et pr&ecirc;te &agrave; utiliser.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Plan</span>
        <span class="info-value">${data.planName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Adresse</span>
        <span class="info-value">${data.domainKoraline}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Courriel</span>
        <span class="info-value">${data.ownerEmail}</span>
      </div>
    </div>

    <h2>Prochaines &eacute;tapes</h2>
    <p>1. <strong>Personnalisez</strong> votre boutique (logo, couleurs, branding)</p>
    <p>2. <strong>Ajoutez</strong> vos produits et cat&eacute;gories</p>
    <p>3. <strong>Configurez</strong> vos modes de paiement et livraison</p>
    <p>4. <strong>Lancez</strong> votre boutique en ligne !</p>

    <div class="btn-container">
      <a href="${data.adminUrl}" class="btn">Acc&eacute;der &agrave; mon admin</a>
    </div>

    <p style="font-size: 13px; color: #666;">
      Besoin d'aide ? Notre &eacute;quipe est disponible pour vous accompagner.
      R&eacute;pondez simplement &agrave; cet email.
    </p>
  `;

  return {
    subject: `Bienvenue sur Koraline — ${data.tenantName} est prêt !`,
    html: tenantBaseTemplate(content),
  };
}

/**
 * Email sent when a module is activated.
 */
export function tenantModuleActivatedEmail(data: ModuleActivatedData): { subject: string; html: string } {
  const content = `
    <h1>Module activ&eacute;</h1>
    <p>Bonjour ${data.ownerName},</p>
    <p>Le module <span class="highlight">${data.moduleName}</span> a &eacute;t&eacute; activ&eacute; sur votre boutique <strong>${data.tenantName}</strong>.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Module</span>
        <span class="info-value">${data.moduleName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tarif mensuel</span>
        <span class="info-value">${(data.monthlyPrice / 100).toFixed(2)} $ CAD/mois</span>
      </div>
    </div>

    <p>Ce montant sera ajout&eacute; &agrave; votre prochaine facture.</p>

    <div class="btn-container">
      <a href="${data.adminUrl}" class="btn">G&eacute;rer mes modules</a>
    </div>
  `;

  return {
    subject: `Module activé : ${data.moduleName} — ${data.tenantName}`,
    html: tenantBaseTemplate(content),
  };
}

/**
 * Email sent when a plan is upgraded/downgraded.
 */
export function tenantPlanUpgradeEmail(data: PlanUpgradeData): { subject: string; html: string } {
  const content = `
    <h1>Plan mis &agrave; jour</h1>
    <p>Bonjour ${data.ownerName},</p>
    <p>Votre plan a &eacute;t&eacute; modifi&eacute; avec succ&egrave;s.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Ancien plan</span>
        <span class="info-value">${data.oldPlanName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Nouveau plan</span>
        <span class="info-value">${data.newPlanName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Nouveau tarif</span>
        <span class="info-value">${(data.newMonthlyPrice / 100).toFixed(2)} $ CAD/mois</span>
      </div>
    </div>

    <p>La modification est effective imm&eacute;diatement. Tout montant au prorata sera appliqu&eacute; &agrave; votre prochaine facture.</p>

    <div class="btn-container">
      <a href="${data.adminUrl}" class="btn">Voir mon abonnement</a>
    </div>
  `;

  return {
    subject: `Plan mis à jour : ${data.newPlanName} — ${data.tenantName}`,
    html: tenantBaseTemplate(content),
  };
}

/**
 * Email sent when data accumulation starts on a module.
 */
export function tenantModuleAccumulationEmail(data: ModuleAccumulationData): { subject: string; html: string } {
  const content = `
    <h1>Accumulation de donn&eacute;es activ&eacute;e</h1>
    <p>Bonjour ${data.ownerName},</p>
    <p>L'accumulation de donn&eacute;es pour le module <span class="highlight">${data.moduleName}</span> est maintenant active sur votre boutique <strong>${data.tenantName}</strong>.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Module</span>
        <span class="info-value">${data.moduleName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Gratuit jusqu'au</span>
        <span class="info-value">${data.freeUntil}</span>
      </div>
    </div>

    <p>Les donn&eacute;es li&eacute;es &agrave; ce module se collectent en arri&egrave;re-plan. Quand vous activerez le module, toutes vos donn&eacute;es accumul&eacute;es seront imm&eacute;diatement disponibles.</p>

    <p><strong>Bon &agrave; savoir :</strong> Si vous activez ce module dans les 12 premiers mois, vous b&eacute;n&eacute;ficiez d'un forfait fid&eacute;lit&eacute; 24 mois &agrave; prix r&eacute;duit !</p>

    <div class="btn-container">
      <a href="${data.adminUrl}" class="btn">G&eacute;rer mes modules</a>
    </div>
  `;

  return {
    subject: `Accumulation de données activée : ${data.moduleName}`,
    html: tenantBaseTemplate(content),
  };
}

/**
 * Welcome email with credentials — sent when a super-admin creates a new tenant/client.
 * Contains the temporary password + password reset link.
 */
export function tenantOwnerCredentialsEmail(data: TenantOwnerCredentialsData): { subject: string; html: string } {
  const content = `
    <h1>Bienvenue sur Koraline !</h1>
    <p>Bonjour ${escapeHtmlTenant(data.ownerName)},</p>
    <p>
      Votre espace <strong>${escapeHtmlTenant(data.tenantName)}</strong> a &eacute;t&eacute; cr&eacute;&eacute;
      sur la plateforme Koraline by Attitudes&nbsp;VIP. Tout est pr&ecirc;t pour que vous puissiez
      d&eacute;marrer.
    </p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Plan</span>
        <span class="info-value">${escapeHtmlTenant(data.planName)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Adresse</span>
        <span class="info-value">${escapeHtmlTenant(data.domainKoraline)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Courriel</span>
        <span class="info-value">${escapeHtmlTenant(data.ownerEmail)}</span>
      </div>
    </div>

    <h2>Vos acc&egrave;s temporaires</h2>
    <p>
      Utilisez les identifiants ci-dessous pour votre premi&egrave;re connexion.
      <strong>Nous vous recommandons fortement de d&eacute;finir un nouveau mot de passe imm&eacute;diatement.</strong>
    </p>

    <div style="background: #fff8f0; border: 1px solid #fcd9b6; border-radius: 12px; padding: 16px; margin: 16px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #6a6a6a;">Courriel</td>
          <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${escapeHtmlTenant(data.ownerEmail)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #6a6a6a;">Mot de passe temporaire</td>
          <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1a1a1a; font-family: monospace; letter-spacing: 1px;">${escapeHtmlTenant(data.temporaryPassword)}</td>
        </tr>
      </table>
    </div>

    <div class="btn-container">
      <a href="${data.resetPasswordUrl}" class="btn">D&eacute;finir mon mot de passe</a>
    </div>

    <p style="text-align: center; font-size: 13px; color: #666; margin-top: 0;">
      ou connectez-vous directement &agrave; votre tableau de bord&nbsp;:
    </p>
    <div class="btn-container" style="margin-top: 8px;">
      <a href="${data.adminUrl}" style="display: inline-block; padding: 12px 24px; background: #003366; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px;">Acc&eacute;der &agrave; mon admin</a>
    </div>

    <h2>Prochaines &eacute;tapes</h2>
    <p>1. <strong>D&eacute;finissez</strong> votre mot de passe personnel</p>
    <p>2. <strong>Personnalisez</strong> votre boutique (logo, couleurs, branding)</p>
    <p>3. <strong>Ajoutez</strong> vos produits et cat&eacute;gories</p>
    <p>4. <strong>Configurez</strong> vos modes de paiement et livraison</p>
    <p>5. <strong>Lancez</strong> votre boutique en ligne&nbsp;!</p>

    <p style="font-size: 13px; color: #666; margin-top: 24px;">
      Besoin d&rsquo;aide&nbsp;? Notre &eacute;quipe est disponible pour vous accompagner.
      R&eacute;pondez simplement &agrave; cet email ou contactez-nous &agrave;
      <a href="mailto:support@attitudes.vip" style="color: #0066CC;">support@attitudes.vip</a>.
    </p>
  `;

  return {
    subject: `Bienvenue sur Koraline — Vos accès pour ${data.tenantName}`,
    html: tenantBaseTemplate(content),
  };
}

/**
 * Password reset email for tenant owners/users — Koraline branded.
 * Used by admin-initiated password resets.
 */
export function tenantPasswordResetEmail(data: TenantPasswordResetData): { subject: string; html: string } {
  const initiatorText = data.adminInitiated
    ? 'Un administrateur a demand&eacute; la r&eacute;initialisation de votre mot de passe.'
    : 'Vous avez demand&eacute; la r&eacute;initialisation de votre mot de passe.';

  const content = `
    <h1>R&eacute;initialisation du mot de passe</h1>
    <p>Bonjour ${escapeHtmlTenant(data.ownerName)},</p>
    <p>${initiatorText}</p>
    <p>
      Cliquez sur le bouton ci-dessous pour d&eacute;finir un nouveau mot de passe.
      Ce lien est valide pendant <strong>${data.expiresInHours}&nbsp;heure${data.expiresInHours > 1 ? 's' : ''}</strong>.
    </p>

    <div class="btn-container">
      <a href="${data.resetUrl}" class="btn">R&eacute;initialiser mon mot de passe</a>
    </div>

    <p style="font-size: 13px; color: #666;">
      Si vous n&rsquo;avez pas demand&eacute; cette r&eacute;initialisation, vous pouvez ignorer cet
      email en toute s&eacute;curit&eacute;. Votre mot de passe actuel restera inchang&eacute;.
    </p>

    <p style="font-size: 12px; color: #999; margin-top: 24px;">
      Pour votre s&eacute;curit&eacute;, ne partagez jamais ce lien avec quiconque.
    </p>
  `;

  return {
    subject: 'Réinitialisation de votre mot de passe — Koraline',
    html: tenantBaseTemplate(content),
  };
}

/**
 * Onboarding reminder wrapper — wraps step-specific content in the tenant base template.
 */
export function tenantOnboardingReminderEmail(
  data: TenantOnboardingReminderData,
  stepContent: string,
  subject: string,
): { subject: string; html: string } {
  const content = `
    <h1>${escapeHtmlTenant(subject)}</h1>
    <p>Bonjour ${escapeHtmlTenant(data.ownerName)},</p>
    ${stepContent}
    <div class="btn-container">
      <a href="${data.adminUrl}" class="btn">Acc&eacute;der &agrave; mon tableau de bord</a>
    </div>
    <p style="font-size: 13px; color: #666;">
      Besoin d&rsquo;aide&nbsp;? R&eacute;pondez simplement &agrave; cet email ou contactez-nous &agrave;
      <a href="mailto:support@attitudes.vip" style="color: #0066CC;">support@attitudes.vip</a>.
    </p>
    <p style="font-size: 12px; color: #999;">L&rsquo;&eacute;quipe Koraline by Attitudes&nbsp;VIP</p>
  `;

  return {
    subject,
    html: tenantBaseTemplate(content),
  };
}

// ---------------------------------------------------------------------------
// Trial Expiry Emails
// ---------------------------------------------------------------------------

interface TrialExpiryData {
  tenantName: string;
  ownerName: string;
  daysRemaining: number;
  trialEndsAt: string;
  adminUrl: string;
  planName: string;
  monthlyPrice: number;
}

/**
 * Trial expiry reminder email (3 days before, 1 day before, and on expiry).
 */
export function tenantTrialExpiryEmail(data: TrialExpiryData): { subject: string; html: string } {
  const safeTenantName = escapeHtmlTenant(data.tenantName);
  const safeOwnerName = escapeHtmlTenant(data.ownerName);
  const safePlanName = escapeHtmlTenant(data.planName);
  const price = (data.monthlyPrice / 100).toFixed(0);

  let title: string;
  let urgencyMessage: string;
  let subject: string;

  if (data.daysRemaining <= 0) {
    subject = `Votre essai gratuit Koraline est termine — ${safeTenantName}`;
    title = 'Votre essai gratuit est termine';
    urgencyMessage = `
      <p>Votre p&eacute;riode d&rsquo;essai gratuit pour <strong>${safeTenantName}</strong> est maintenant termin&eacute;e.</p>
      <p>Pour continuer &agrave; utiliser toutes les fonctionnalit&eacute;s de votre boutique, passez au plan <strong>${safePlanName}</strong> d&egrave;s maintenant.</p>
      <div class="info-box" style="background: #fef2f2;">
        <p style="color: #991b1b; font-weight: 600; margin: 0;">Certaines fonctionnalit&eacute;s seront restreintes tant que vous n&rsquo;aurez pas souscrit &agrave; un plan.</p>
      </div>
    `;
  } else if (data.daysRemaining === 1) {
    subject = `Dernier jour d'essai gratuit — ${safeTenantName}`;
    title = 'Dernier jour de votre essai gratuit';
    urgencyMessage = `
      <p>Il ne reste plus que <strong>24 heures</strong> &agrave; votre p&eacute;riode d&rsquo;essai gratuit pour <strong>${safeTenantName}</strong>.</p>
      <p>Mettez &agrave; niveau maintenant pour ne rien perdre.</p>
      <div class="info-box" style="background: #fffbeb;">
        <p style="color: #92400e; font-weight: 600; margin: 0;">Votre essai se termine demain. Souscrivez d&egrave;s maintenant pour une transition sans interruption.</p>
      </div>
    `;
  } else {
    subject = `${data.daysRemaining} jours restants dans votre essai gratuit — ${safeTenantName}`;
    title = `${data.daysRemaining} jours restants dans votre essai gratuit`;
    urgencyMessage = `
      <p>Votre essai gratuit pour <strong>${safeTenantName}</strong> se termine dans <strong>${data.daysRemaining} jours</strong> (le ${data.trialEndsAt}).</p>
      <p>Profitez de ce temps pour explorer toutes les fonctionnalit&eacute;s, puis choisissez le plan qui vous convient.</p>
    `;
  }

  const content = `
    <h1>${title}</h1>
    <p>Bonjour ${safeOwnerName},</p>
    ${urgencyMessage}

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Plan actuel</span>
        <span class="info-value">${safePlanName} (essai gratuit)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Prix apr&egrave;s l&rsquo;essai</span>
        <span class="info-value">${price}$ CAD/mois</span>
      </div>
      <div class="info-row">
        <span class="info-label">Fin de l&rsquo;essai</span>
        <span class="info-value">${escapeHtmlTenant(data.trialEndsAt)}</span>
      </div>
    </div>

    <div class="btn-container">
      <a href="${data.adminUrl}/admin/abonnement" class="btn" style="${data.daysRemaining <= 0 ? 'background: #dc2626;' : data.daysRemaining <= 1 ? 'background: #d97706;' : ''}">
        ${data.daysRemaining <= 0 ? 'Mettre &agrave; niveau maintenant' : 'G&eacute;rer mon abonnement'}
      </a>
    </div>

    <p style="font-size: 13px; color: #666;">
      Des questions&nbsp;? R&eacute;pondez &agrave; cet email ou contactez-nous &agrave;
      <a href="mailto:support@attitudes.vip" style="color: #0066CC;">support@attitudes.vip</a>.
    </p>
    <p style="font-size: 12px; color: #999;">L&rsquo;&eacute;quipe Koraline by Attitudes&nbsp;VIP</p>
  `;

  return {
    subject,
    html: tenantBaseTemplate(content),
  };
}
