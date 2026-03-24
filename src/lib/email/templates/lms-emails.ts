/**
 * LMS Email Templates — Formation continue (Aptitudes)
 * 8 templates for the complete student lifecycle.
 */

import { baseTemplate, escapeHtml } from './base-template';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://attitudes.vip';

// ── 1. Enrollment Confirmation ──────────────────────────────────

interface EnrollmentConfirmationData {
  studentName: string;
  courseName: string;
  courseSlug: string;
  isBundlePurchase?: boolean;
  bundleName?: string;
  courseCount?: number;
  locale?: 'fr' | 'en';
}

export function buildEnrollmentConfirmationEmail(data: EnrollmentConfirmationData) {
  const { studentName, courseName, courseSlug, isBundlePurchase, bundleName, courseCount, locale = 'fr' } = data;
  const isFr = locale === 'fr';
  const safeName = escapeHtml(studentName);
  const safeCourse = escapeHtml(courseName);

  const subject = isFr
    ? `Inscription confirmee — ${isBundlePurchase ? bundleName : courseName}`
    : `Enrollment confirmed — ${isBundlePurchase ? bundleName : courseName}`;

  const content = `
    <h1 style="font-size: 24px; color: #1f2937; margin-bottom: 16px;">
      ${isFr ? `Bienvenue dans votre formation, ${safeName} !` : `Welcome to your training, ${safeName}!`}
    </h1>
    <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
      ${isFr
        ? isBundlePurchase
          ? `Vous etes inscrit(e) au forfait <strong>${escapeHtml(bundleName ?? '')}</strong> (${courseCount} cours). Votre formation est prete a commencer!`
          : `Vous etes inscrit(e) au cours <strong>${safeCourse}</strong>. Votre formation est prete a commencer!`
        : isBundlePurchase
          ? `You are enrolled in the <strong>${escapeHtml(bundleName ?? '')}</strong> bundle (${courseCount} courses). Your training is ready to begin!`
          : `You are enrolled in <strong>${safeCourse}</strong>. Your training is ready to begin!`}
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${SITE_URL}/learn/${escapeHtml(courseSlug)}"
         style="display: inline-block; padding: 14px 32px; background-color: #0066CC; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${isFr ? 'Commencer ma formation' : 'Start my training'}
      </a>
    </div>
  `;

  return { html: baseTemplate({ content }), text: `${subject}\n\n${SITE_URL}/learn/${courseSlug}`, subject };
}

// ── 2. Course Completion ────────────────────────────────────────

interface CourseCompletionData {
  studentName: string;
  courseName: string;
  score?: number;
  certificateUrl?: string;
  locale?: 'fr' | 'en';
}

export function buildCourseCompletionEmail(data: CourseCompletionData) {
  const { studentName, courseName, score, certificateUrl, locale = 'fr' } = data;
  const isFr = locale === 'fr';

  const subject = isFr ? `Felicitations! Cours termine — ${courseName}` : `Congratulations! Course completed — ${courseName}`;

  const content = `
    <h1 style="font-size: 24px; color: #1f2937; margin-bottom: 16px;">
      ${isFr ? `Felicitations, ${escapeHtml(studentName)} !` : `Congratulations, ${escapeHtml(studentName)}!`}
    </h1>
    <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
      ${isFr
        ? `Vous avez termine le cours <strong>${escapeHtml(courseName)}</strong>${score ? ` avec un score de ${score}%` : ''}.`
        : `You have completed <strong>${escapeHtml(courseName)}</strong>${score ? ` with a score of ${score}%` : ''}.`}
    </p>
    ${certificateUrl ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(certificateUrl)}"
         style="display: inline-block; padding: 14px 32px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${isFr ? 'Telecharger mon certificat' : 'Download my certificate'}
      </a>
    </div>` : ''}
  `;

  return { html: baseTemplate({ content }), text: subject, subject };
}

// ── 3. Certificate Issued ───────────────────────────────────────

interface CertificateIssuedData {
  studentName: string;
  courseName: string;
  verificationCode: string;
  verificationUrl: string;
  ufcCredits?: number;
  regulatoryBody?: string;
  locale?: 'fr' | 'en';
}

export function buildCertificateIssuedEmail(data: CertificateIssuedData) {
  const { studentName, courseName, verificationUrl, ufcCredits, regulatoryBody, locale = 'fr' } = data;
  const isFr = locale === 'fr';

  const subject = isFr ? `Certificat emis — ${courseName}` : `Certificate issued — ${courseName}`;

  const content = `
    <h1 style="font-size: 24px; color: #1f2937; margin-bottom: 16px;">
      ${isFr ? `Votre certificat est pret!` : `Your certificate is ready!`}
    </h1>
    <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
      ${isFr
        ? `${escapeHtml(studentName)}, votre certificat pour <strong>${escapeHtml(courseName)}</strong> a ete emis.`
        : `${escapeHtml(studentName)}, your certificate for <strong>${escapeHtml(courseName)}</strong> has been issued.`}
    </p>
    ${ufcCredits ? `<p style="font-size: 14px; color: #059669; font-weight: 600;">${ufcCredits} UFC${regulatoryBody ? ` (${escapeHtml(regulatoryBody)})` : ''}</p>` : ''}
    <div style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(verificationUrl)}"
         style="display: inline-block; padding: 14px 32px; background-color: #0066CC; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${isFr ? 'Voir mon certificat' : 'View my certificate'}
      </a>
    </div>
  `;

  return { html: baseTemplate({ content }), text: subject, subject };
}

// ── 4. Compliance Deadline Reminder ─────────────────────────────

interface ComplianceReminderData {
  studentName: string;
  deadlineDate: string;
  daysRemaining: number;
  coursesRemaining: number;
  ufcEarned: number;
  ufcRequired: number;
  dashboardUrl?: string;
  locale?: 'fr' | 'en';
}

export function buildComplianceReminderEmail(data: ComplianceReminderData) {
  const { studentName, deadlineDate, daysRemaining, coursesRemaining, ufcEarned, ufcRequired, locale = 'fr' } = data;
  const isFr = locale === 'fr';
  const urgencyColor = daysRemaining <= 3 ? '#dc2626' : daysRemaining <= 7 ? '#f59e0b' : '#0066CC';

  const subject = isFr
    ? `Rappel conformite — ${daysRemaining} jour(s) restant(s)`
    : `Compliance reminder — ${daysRemaining} day(s) remaining`;

  const content = `
    <h1 style="font-size: 24px; color: ${urgencyColor}; margin-bottom: 16px;">
      ${isFr ? `Rappel: echeance de conformite` : `Reminder: compliance deadline`}
    </h1>
    <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
      ${isFr
        ? `${escapeHtml(studentName)}, votre periode de formation continue se termine le <strong>${escapeHtml(deadlineDate)}</strong> (dans ${daysRemaining} jour(s)).`
        : `${escapeHtml(studentName)}, your continuing education period ends on <strong>${escapeHtml(deadlineDate)}</strong> (in ${daysRemaining} day(s)).`}
    </p>
    <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0; font-size: 14px;"><strong>UFC:</strong> ${ufcEarned}/${ufcRequired}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>${isFr ? 'Cours restants' : 'Courses remaining'}:</strong> ${coursesRemaining}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${SITE_URL}/learn/dashboard"
         style="display: inline-block; padding: 14px 32px; background-color: ${urgencyColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${isFr ? 'Reprendre ma formation' : 'Resume my training'}
      </a>
    </div>
  `;

  return { html: baseTemplate({ content }), text: subject, subject };
}

// ── 5. Certificate Expiring ─────────────────────────────────────

interface CertificateExpiringData {
  studentName: string;
  courseName: string;
  expirationDate: string;
  renewalUrl?: string;
  locale?: 'fr' | 'en';
}

export function buildCertificateExpiringEmail(data: CertificateExpiringData) {
  const { studentName, courseName, expirationDate, locale = 'fr' } = data;
  const isFr = locale === 'fr';

  const subject = isFr ? `Certificat expire bientot — ${courseName}` : `Certificate expiring soon — ${courseName}`;

  const content = `
    <h1 style="font-size: 24px; color: #f59e0b; margin-bottom: 16px;">
      ${isFr ? `Votre certificat expire bientot` : `Your certificate is expiring soon`}
    </h1>
    <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
      ${isFr
        ? `${escapeHtml(studentName)}, votre certificat pour <strong>${escapeHtml(courseName)}</strong> expire le ${escapeHtml(expirationDate)}.`
        : `${escapeHtml(studentName)}, your certificate for <strong>${escapeHtml(courseName)}</strong> expires on ${escapeHtml(expirationDate)}.`}
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${SITE_URL}/learn/dashboard"
         style="display: inline-block; padding: 14px 32px; background-color: #0066CC; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${isFr ? 'Renouveler ma formation' : 'Renew my training'}
      </a>
    </div>
  `;

  return { html: baseTemplate({ content }), text: subject, subject };
}

// ── 6. Corporate Welcome ────────────────────────────────────────

interface CorporateWelcomeData {
  employeeName: string;
  companyName: string;
  coursesEnrolled: string[];
  dashboardUrl?: string;
  locale?: 'fr' | 'en';
}

export function buildCorporateWelcomeEmail(data: CorporateWelcomeData) {
  const { employeeName, companyName, coursesEnrolled, locale = 'fr' } = data;
  const isFr = locale === 'fr';

  const subject = isFr
    ? `${companyName} vous inscrit a une formation`
    : `${companyName} has enrolled you in training`;

  const courseList = coursesEnrolled.map(c => `<li style="padding: 4px 0;">${escapeHtml(c)}</li>`).join('');

  const content = `
    <h1 style="font-size: 24px; color: #1f2937; margin-bottom: 16px;">
      ${isFr ? `Votre formation est prete!` : `Your training is ready!`}
    </h1>
    <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
      ${isFr
        ? `${escapeHtml(employeeName)}, <strong>${escapeHtml(companyName)}</strong> vous a inscrit(e) aux formations suivantes:`
        : `${escapeHtml(employeeName)}, <strong>${escapeHtml(companyName)}</strong> has enrolled you in the following training:`}
    </p>
    <ul style="font-size: 15px; color: #374151; padding-left: 20px; margin: 16px 0;">${courseList}</ul>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${SITE_URL}/learn/dashboard"
         style="display: inline-block; padding: 14px 32px; background-color: #0066CC; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${isFr ? 'Acceder a mes formations' : 'Access my training'}
      </a>
    </div>
  `;

  return { html: baseTemplate({ content }), text: subject, subject };
}

// ── 7. Corporate Progress Report ────────────────────────────────

interface CorporateProgressReportData {
  adminName: string;
  companyName: string;
  totalEmployees: number;
  enrolledEmployees: number;
  completionRate: number;
  overdueCount: number;
  period: string;
  dashboardUrl?: string;
  locale?: 'fr' | 'en';
}

export function buildCorporateProgressReportEmail(data: CorporateProgressReportData) {
  const { adminName, companyName, totalEmployees, enrolledEmployees, completionRate, overdueCount, period, locale = 'fr' } = data;
  const isFr = locale === 'fr';

  const subject = isFr ? `Rapport formation ${period} — ${companyName}` : `Training report ${period} — ${companyName}`;

  const content = `
    <h1 style="font-size: 24px; color: #1f2937; margin-bottom: 16px;">
      ${isFr ? `Rapport de formation — ${escapeHtml(period)}` : `Training report — ${escapeHtml(period)}`}
    </h1>
    <p style="font-size: 16px; color: #4b5563; margin-bottom: 24px;">
      ${isFr ? `Bonjour ${escapeHtml(adminName)}, voici le bilan formation de ${escapeHtml(companyName)}.` : `Hello ${escapeHtml(adminName)}, here is the training report for ${escapeHtml(companyName)}.`}
    </p>
    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 16px 0;">
      <table style="width: 100%; font-size: 15px;">
        <tr><td style="padding: 6px 0; color: #6b7280;">${isFr ? 'Employes inscrits' : 'Enrolled employees'}</td><td style="text-align: right; font-weight: 600;">${enrolledEmployees}/${totalEmployees}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">${isFr ? 'Taux de completion' : 'Completion rate'}</td><td style="text-align: right; font-weight: 600;">${completionRate}%</td></tr>
        <tr><td style="padding: 6px 0; color: ${overdueCount > 0 ? '#dc2626' : '#6b7280'};">${isFr ? 'En retard' : 'Overdue'}</td><td style="text-align: right; font-weight: 600; color: ${overdueCount > 0 ? '#dc2626' : 'inherit'};">${overdueCount}</td></tr>
      </table>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${SITE_URL}/dashboard/formation"
         style="display: inline-block; padding: 14px 32px; background-color: #0066CC; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${isFr ? 'Voir le tableau de bord complet' : 'View full dashboard'}
      </a>
    </div>
  `;

  return { html: baseTemplate({ content }), text: subject, subject };
}

// ── 8. Quiz Failed Encouragement ────────────────────────────────

interface QuizFailedData {
  studentName: string;
  quizName: string;
  score: number;
  passingScore: number;
  courseSlug: string;
  locale?: 'fr' | 'en';
}

export function buildQuizFailedEmail(data: QuizFailedData) {
  const { studentName, quizName, score, passingScore, courseSlug, locale = 'fr' } = data;
  const isFr = locale === 'fr';

  const subject = isFr ? `Continuez! — ${quizName}` : `Keep going! — ${quizName}`;

  const content = `
    <h1 style="font-size: 24px; color: #1f2937; margin-bottom: 16px;">
      ${isFr ? `Ne lachez pas, ${escapeHtml(studentName)}!` : `Don't give up, ${escapeHtml(studentName)}!`}
    </h1>
    <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
      ${isFr
        ? `Votre score de ${score}% au quiz <strong>${escapeHtml(quizName)}</strong> n'a pas atteint le seuil de ${passingScore}%. Pas de souci — vous pouvez reessayer!`
        : `Your score of ${score}% on <strong>${escapeHtml(quizName)}</strong> didn't reach the ${passingScore}% threshold. No worries — you can try again!`}
    </p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      ${isFr
        ? `Conseil: Utilisez Aurelia, votre tutrice IA, pour revoir les notions difficiles avant votre prochaine tentative.`
        : `Tip: Use Aurelia, your AI tutor, to review difficult concepts before your next attempt.`}
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${SITE_URL}/learn/${escapeHtml(courseSlug)}"
         style="display: inline-block; padding: 14px 32px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${isFr ? 'Reviser avec Aurelia' : 'Review with Aurelia'}
      </a>
    </div>
  `;

  return { html: baseTemplate({ content }), text: subject, subject };
}
