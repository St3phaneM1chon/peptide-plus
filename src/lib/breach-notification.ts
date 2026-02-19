/**
 * DATA BREACH NOTIFICATION - GDPR/PIPEDA Compliance
 *
 * Generates email templates for:
 *   1. Affected users notification
 *   2. Regulatory body notification (Privacy Commissioner of Canada / CNIL)
 *
 * Multi-language support: English and French.
 *
 * References:
 *   - PIPEDA (Personal Information Protection and Electronic Documents Act)
 *   - GDPR Article 33 (notification to supervisory authority)
 *   - GDPR Article 34 (communication to data subject)
 */

import { baseTemplate } from '@/lib/email/templates/base-template';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BreachNotificationParams {
  /** IDs or emails of affected users */
  affectedUsers: string[];
  /** Types of data compromised (e.g., 'email', 'name', 'address', 'payment info') */
  dataTypes: string[];
  /** When the breach was discovered */
  discoveryDate: Date;
  /** Description of the breach */
  description: string;
  /** Locale for the notification */
  locale?: 'en' | 'fr';
}

export interface BreachNotificationResult {
  /** HTML email to send to affected users */
  userEmailHtml: string;
  /** HTML email to send to the regulatory authority */
  regulatoryEmailHtml: string;
  /** Subject line for user email */
  userEmailSubject: string;
  /** Subject line for regulatory email */
  regulatoryEmailSubject: string;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generate breach notification emails for both affected users and
 * the regulatory authority (Privacy Commissioner / CNIL).
 */
export async function generateBreachNotification(
  params: BreachNotificationParams
): Promise<BreachNotificationResult> {
  const locale = params.locale || 'fr';
  const isFr = locale === 'fr';

  const formattedDate = params.discoveryDate.toLocaleDateString(
    isFr ? 'fr-CA' : 'en-CA',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const dataTypesFormatted = params.dataTypes.join(', ');
  const affectedCount = params.affectedUsers.length;

  // User notification
  const userEmailContent = isFr
    ? buildUserEmailFr(formattedDate, dataTypesFormatted, params.description)
    : buildUserEmailEn(formattedDate, dataTypesFormatted, params.description);

  const userEmailHtml = baseTemplate({
    preheader: isFr
      ? 'Notification importante concernant vos donnees personnelles'
      : 'Important notification regarding your personal data',
    content: userEmailContent,
    locale,
  });

  const userEmailSubject = isFr
    ? 'Notification de violation de donnees - BioCycle Peptides'
    : 'Data Breach Notification - BioCycle Peptides';

  // Regulatory notification
  const regulatoryEmailContent = isFr
    ? buildRegulatoryEmailFr(formattedDate, dataTypesFormatted, params.description, affectedCount)
    : buildRegulatoryEmailEn(formattedDate, dataTypesFormatted, params.description, affectedCount);

  const regulatoryEmailHtml = baseTemplate({
    preheader: isFr
      ? 'Declaration de violation de donnees - PIPEDA'
      : 'Data Breach Report - PIPEDA',
    content: regulatoryEmailContent,
    locale,
  });

  const regulatoryEmailSubject = isFr
    ? `Declaration de violation de donnees - BioCycle Peptides Inc. - ${formattedDate}`
    : `Data Breach Report - BioCycle Peptides Inc. - ${formattedDate}`;

  return {
    userEmailHtml,
    regulatoryEmailHtml,
    userEmailSubject,
    regulatoryEmailSubject,
  };
}

// ---------------------------------------------------------------------------
// User email templates
// ---------------------------------------------------------------------------

function buildUserEmailEn(date: string, dataTypes: string, description: string): string {
  return `
    <h1 style="color:#1f2937;font-size:22px;">Important: Data Breach Notification</h1>

    <p>Dear Customer,</p>

    <p>We are writing to inform you of a data security incident that may have affected your personal information.</p>

    <div style="background-color:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 8px 0;color:#991b1b;">What happened</h3>
      <p style="margin:0;color:#1f2937;">${escapeHtml(description)}</p>
    </div>

    <h3 style="color:#1f2937;">When did this happen?</h3>
    <p>The incident was discovered on <strong>${date}</strong>.</p>

    <h3 style="color:#1f2937;">What information was involved?</h3>
    <p>The following types of personal data may have been affected: <strong>${escapeHtml(dataTypes)}</strong>.</p>

    <h3 style="color:#1f2937;">What we are doing</h3>
    <ul style="color:#4b5563;">
      <li>We have contained the incident and are conducting a thorough investigation.</li>
      <li>We have notified the Office of the Privacy Commissioner of Canada as required under PIPEDA.</li>
      <li>We are enhancing our security measures to prevent future incidents.</li>
    </ul>

    <h3 style="color:#1f2937;">What you should do</h3>
    <ul style="color:#4b5563;">
      <li>Change your password immediately on our platform and any other service where you use the same password.</li>
      <li>Enable multi-factor authentication (MFA) on your account if not already done.</li>
      <li>Monitor your financial statements for any suspicious activity.</li>
      <li>Be cautious of phishing emails or unexpected communications requesting personal information.</li>
    </ul>

    <h3 style="color:#1f2937;">Contact us</h3>
    <p>If you have any questions or concerns, please contact our Data Protection Officer at <a href="mailto:privacy@biocyclepeptides.com">privacy@biocyclepeptides.com</a>.</p>

    <p>We sincerely apologize for any inconvenience this may cause and are committed to protecting your personal information.</p>

    <p>Sincerely,<br><strong>BioCycle Peptides Inc.</strong></p>
  `;
}

function buildUserEmailFr(date: string, dataTypes: string, description: string): string {
  return `
    <h1 style="color:#1f2937;font-size:22px;">Important : Notification de violation de donnees</h1>

    <p>Cher(e) client(e),</p>

    <p>Nous vous ecrivons pour vous informer d'un incident de securite des donnees qui pourrait avoir touche vos informations personnelles.</p>

    <div style="background-color:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 8px 0;color:#991b1b;">Ce qui s'est passe</h3>
      <p style="margin:0;color:#1f2937;">${escapeHtml(description)}</p>
    </div>

    <h3 style="color:#1f2937;">Quand cela s'est-il produit ?</h3>
    <p>L'incident a ete decouvert le <strong>${date}</strong>.</p>

    <h3 style="color:#1f2937;">Quelles informations sont concernees ?</h3>
    <p>Les types de donnees personnelles suivants pourraient avoir ete affectes : <strong>${escapeHtml(dataTypes)}</strong>.</p>

    <h3 style="color:#1f2937;">Ce que nous faisons</h3>
    <ul style="color:#4b5563;">
      <li>Nous avons contenu l'incident et menons une enquete approfondie.</li>
      <li>Nous avons notifie le Commissariat a la protection de la vie privee du Canada conformement a la LPRPDE (PIPEDA).</li>
      <li>Nous renforcons nos mesures de securite pour prevenir de futurs incidents.</li>
    </ul>

    <h3 style="color:#1f2937;">Ce que vous devriez faire</h3>
    <ul style="color:#4b5563;">
      <li>Changez immediatement votre mot de passe sur notre plateforme et sur tout autre service ou vous utilisez le meme mot de passe.</li>
      <li>Activez l'authentification multifacteur (MFA) sur votre compte si ce n'est pas deja fait.</li>
      <li>Surveillez vos releves financiers pour toute activite suspecte.</li>
      <li>Soyez vigilant(e) face aux courriels d'hameconnage ou communications non sollicitees demandant des informations personnelles.</li>
    </ul>

    <h3 style="color:#1f2937;">Nous contacter</h3>
    <p>Si vous avez des questions ou des preoccupations, veuillez contacter notre responsable de la protection des donnees a <a href="mailto:privacy@biocyclepeptides.com">privacy@biocyclepeptides.com</a>.</p>

    <p>Nous nous excusons sincerement pour tout desagrement que cela pourrait causer et nous engageons a proteger vos informations personnelles.</p>

    <p>Cordialement,<br><strong>BioCycle Peptides Inc.</strong></p>
  `;
}

// ---------------------------------------------------------------------------
// Regulatory email templates (Privacy Commissioner / CNIL)
// ---------------------------------------------------------------------------

function buildRegulatoryEmailEn(
  date: string,
  dataTypes: string,
  description: string,
  affectedCount: number
): string {
  return `
    <h1 style="color:#1f2937;font-size:22px;">Data Breach Report - PIPEDA Section 10.1</h1>

    <p>To the Office of the Privacy Commissioner of Canada,</p>

    <p>In accordance with the Personal Information Protection and Electronic Documents Act (PIPEDA), Section 10.1, BioCycle Peptides Inc. hereby reports a breach of security safeguards involving personal information.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

    <h3 style="color:#1f2937;">1. Organization Information</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:4px 8px;color:#6b7280;width:200px;">Organization:</td><td style="padding:4px 8px;color:#1f2937;"><strong>BioCycle Peptides Inc.</strong></td></tr>
      <tr><td style="padding:4px 8px;color:#6b7280;">Address:</td><td style="padding:4px 8px;color:#1f2937;">Montreal, Quebec, Canada</td></tr>
      <tr><td style="padding:4px 8px;color:#6b7280;">Contact:</td><td style="padding:4px 8px;color:#1f2937;">privacy@biocyclepeptides.com</td></tr>
    </table>

    <h3 style="color:#1f2937;">2. Description of the Breach</h3>
    <p>${escapeHtml(description)}</p>

    <h3 style="color:#1f2937;">3. Date of Discovery</h3>
    <p>${date}</p>

    <h3 style="color:#1f2937;">4. Personal Information Involved</h3>
    <p>${escapeHtml(dataTypes)}</p>

    <h3 style="color:#1f2937;">5. Number of Individuals Affected</h3>
    <p><strong>${affectedCount}</strong> individuals</p>

    <h3 style="color:#1f2937;">6. Assessment of Risk of Significant Harm</h3>
    <p>A risk assessment has been conducted. Given the nature of the data involved, we believe there is a real risk of significant harm to the affected individuals. Notification to affected individuals is being carried out concurrently with this report.</p>

    <h3 style="color:#1f2937;">7. Steps Taken</h3>
    <ul style="color:#4b5563;">
      <li>Immediate containment of the breach</li>
      <li>Investigation initiated to determine the full scope</li>
      <li>Notification to affected individuals</li>
      <li>Review and enhancement of security controls</li>
      <li>Employee security awareness reinforcement</li>
    </ul>

    <h3 style="color:#1f2937;">8. Notification to Individuals</h3>
    <p>Affected individuals are being notified via email with details about the breach, what information was involved, and recommended steps they should take.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

    <p>We remain available for any questions or additional information you may require.</p>

    <p>Respectfully,<br><strong>BioCycle Peptides Inc.</strong><br>Data Protection Officer<br>privacy@biocyclepeptides.com</p>
  `;
}

function buildRegulatoryEmailFr(
  date: string,
  dataTypes: string,
  description: string,
  affectedCount: number
): string {
  return `
    <h1 style="color:#1f2937;font-size:22px;">Declaration de violation de donnees - LPRPDE Article 10.1</h1>

    <p>Au Commissariat a la protection de la vie privee du Canada,</p>

    <p>Conformement a la Loi sur la protection des renseignements personnels et les documents electroniques (LPRPDE), article 10.1, BioCycle Peptides Inc. declare par la presente une atteinte aux mesures de securite concernant des renseignements personnels.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

    <h3 style="color:#1f2937;">1. Renseignements sur l'organisation</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:4px 8px;color:#6b7280;width:200px;">Organisation :</td><td style="padding:4px 8px;color:#1f2937;"><strong>BioCycle Peptides Inc.</strong></td></tr>
      <tr><td style="padding:4px 8px;color:#6b7280;">Adresse :</td><td style="padding:4px 8px;color:#1f2937;">Montreal, Quebec, Canada</td></tr>
      <tr><td style="padding:4px 8px;color:#6b7280;">Contact :</td><td style="padding:4px 8px;color:#1f2937;">privacy@biocyclepeptides.com</td></tr>
    </table>

    <h3 style="color:#1f2937;">2. Description de l'atteinte</h3>
    <p>${escapeHtml(description)}</p>

    <h3 style="color:#1f2937;">3. Date de decouverte</h3>
    <p>${date}</p>

    <h3 style="color:#1f2937;">4. Renseignements personnels en cause</h3>
    <p>${escapeHtml(dataTypes)}</p>

    <h3 style="color:#1f2937;">5. Nombre de personnes touchees</h3>
    <p><strong>${affectedCount}</strong> personnes</p>

    <h3 style="color:#1f2937;">6. Evaluation du risque de prejudice grave</h3>
    <p>Une evaluation des risques a ete effectuee. Compte tenu de la nature des donnees en cause, nous estimons qu'il existe un risque reel de prejudice grave pour les personnes touchees. La notification aux personnes touchees est effectuee concurremment avec cette declaration.</p>

    <h3 style="color:#1f2937;">7. Mesures prises</h3>
    <ul style="color:#4b5563;">
      <li>Containment immediat de l'atteinte</li>
      <li>Enquete lancee pour determiner la portee complete</li>
      <li>Notification aux personnes touchees</li>
      <li>Revue et renforcement des controles de securite</li>
      <li>Renforcement de la sensibilisation a la securite des employes</li>
    </ul>

    <h3 style="color:#1f2937;">8. Notification aux personnes</h3>
    <p>Les personnes touchees sont notifiees par courriel avec les details de l'atteinte, les informations concernees et les mesures recommandees qu'elles devraient prendre.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

    <p>Nous demeurons disponibles pour toute question ou information supplementaire que vous pourriez requirir.</p>

    <p>Respectueusement,<br><strong>BioCycle Peptides Inc.</strong><br>Responsable de la protection des donnees<br>privacy@biocyclepeptides.com</p>
  `;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
