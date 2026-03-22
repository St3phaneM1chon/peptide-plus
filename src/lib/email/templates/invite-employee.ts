/**
 * Email template for employee invitation
 * Sends a link to set up their account password
 */

import { baseTemplate } from './base-template';
import { escapeHtml } from './base-template';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

interface InviteEmployeeEmailData {
  recipientName: string;
  inviterName: string;
  inviteUrl: string;
  locale?: 'fr' | 'en';
}

export function buildInviteEmployeeEmail(data: InviteEmployeeEmailData): { html: string; text: string; subject: string } {
  const { recipientName, inviterName, inviteUrl, locale = 'fr' } = data;
  const isFr = locale === 'fr';

  const subject = isFr
    ? `Invitation à rejoindre ${SITE_NAME}`
    : `Invitation to join ${SITE_NAME}`;

  const safeName = escapeHtml(recipientName);
  const safeInviter = escapeHtml(inviterName);

  const content = `
    <h1 style="font-size: 24px; color: #1f2937; margin-bottom: 16px;">
      ${isFr ? `Bienvenue chez ${SITE_NAME}, ${safeName} !` : `Welcome to ${SITE_NAME}, ${safeName}!`}
    </h1>
    <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
      ${isFr
        ? `${safeInviter} vous a invité(e) à rejoindre l'équipe ${SITE_NAME}. Pour activer votre compte, veuillez configurer votre mot de passe en cliquant sur le bouton ci-dessous.`
        : `${safeInviter} has invited you to join the ${SITE_NAME} team. To activate your account, please set up your password by clicking the button below.`}
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(inviteUrl)}"
         style="display: inline-block; padding: 14px 32px; background-color: #CC5500; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
        ${isFr ? 'Configurer mon compte' : 'Set up my account'}
      </a>
    </div>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 8px;">
      ${isFr
        ? 'Ce lien expire dans 72 heures. Si vous n\'avez pas demandé cette invitation, vous pouvez ignorer cet email.'
        : 'This link expires in 72 hours. If you did not request this invitation, you can ignore this email.'}
    </p>
    <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
      ${isFr
        ? 'Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :'
        : 'If the button doesn\'t work, copy and paste this link in your browser:'}
      <br/>
      <a href="${escapeHtml(inviteUrl)}" style="color: #CC5500; word-break: break-all;">${escapeHtml(inviteUrl)}</a>
    </p>
  `;

  const html = baseTemplate({ content, locale, preheader: subject });

  const text = isFr
    ? `Bienvenue chez ${SITE_NAME}, ${recipientName} !\n\n${inviterName} vous a invité(e) à rejoindre l'équipe. Configurez votre mot de passe ici : ${inviteUrl}\n\nCe lien expire dans 72 heures.`
    : `Welcome to ${SITE_NAME}, ${recipientName}!\n\n${inviterName} has invited you to join the team. Set up your password here: ${inviteUrl}\n\nThis link expires in 72 hours.`;

  return { html, text, subject };
}
