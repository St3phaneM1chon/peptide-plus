/**
 * Service d'envoi d'emails - BioCycle Peptides
 * Compatible avec Resend, SendGrid, ou SMTP
 */

// Types pour les emails
export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string; // Base64
  contentType: string;
}

export interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  from?: EmailRecipient;
  replyTo?: string;
  attachments?: EmailAttachment[];
  tags?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Configuration par défaut
const DEFAULT_FROM: EmailRecipient = {
  email: process.env.SMTP_FROM || 'noreply@biocyclepeptides.com',
  name: 'BioCycle Peptides',
};

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@biocyclepeptides.com';

/**
 * Envoie un email via le provider configuré
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER || 'log'; // 'resend', 'sendgrid', 'smtp', 'log'
  
  const emailData = {
    ...options,
    from: options.from || DEFAULT_FROM,
  };

  try {
    switch (provider) {
      case 'resend':
        return await sendViaResend(emailData);
      case 'sendgrid':
        return await sendViaSendGrid(emailData);
      case 'smtp':
        return await sendViaSMTP(emailData);
      default:
        // Mode développement: log l'email
        return await logEmail(emailData);
    }
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Envoi via Resend
 */
async function sendViaResend(options: SendEmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not configured, falling back to log');
    return logEmail(options);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${options.from?.name} <${options.from?.email}>`,
      to: Array.isArray(options.to) 
        ? options.to.map(r => r.email) 
        : [options.to.email],
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo,
      tags: options.tags?.map(t => ({ name: t, value: 'true' })),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.message || 'Resend API error' };
  }

  return { success: true, messageId: data.id };
}

/**
 * Envoi via SendGrid
 */
async function sendViaSendGrid(options: SendEmailOptions): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('SENDGRID_API_KEY not configured, falling back to log');
    return logEmail(options);
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: recipients.map(r => ({ email: r.email, name: r.name })),
      }],
      from: { email: options.from?.email, name: options.from?.name },
      reply_to: options.replyTo ? { email: options.replyTo } : undefined,
      subject: options.subject,
      content: [
        { type: 'text/plain', value: options.text || '' },
        { type: 'text/html', value: options.html },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: text || 'SendGrid API error' };
  }

  return { success: true, messageId: response.headers.get('x-message-id') || undefined };
}

/**
 * Envoi via SMTP (nodemailer)
 */
async function sendViaSMTP(options: SendEmailOptions): Promise<EmailResult> {
  // Pour SMTP, vous devrez installer nodemailer
  // npm install nodemailer
  // et configurer SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  
  console.warn('SMTP not implemented yet, falling back to log');
  return logEmail(options);
}

/**
 * Mode développement: log l'email dans la console
 */
async function logEmail(options: SendEmailOptions): Promise<EmailResult> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  
  console.log('\n' + '='.repeat(60));
  console.log('📧 EMAIL (DEV MODE - NOT SENT)');
  console.log('='.repeat(60));
  console.log(`From: ${options.from?.name} <${options.from?.email}>`);
  console.log(`To: ${recipients.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', ')}`);
  console.log(`Subject: ${options.subject}`);
  if (options.replyTo) console.log(`Reply-To: ${options.replyTo}`);
  console.log('-'.repeat(60));
  // Log une version simplifiée du HTML
  const textPreview = options.text || options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 500);
  console.log(`Preview: ${textPreview}...`);
  console.log('='.repeat(60) + '\n');

  return { 
    success: true, 
    messageId: `dev-${Date.now()}-${Math.random().toString(36).substring(7)}` 
  };
}

// Export les constantes utiles
export { DEFAULT_FROM, SUPPORT_EMAIL };
