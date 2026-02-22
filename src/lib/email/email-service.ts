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
  /** Unsubscribe URL for List-Unsubscribe header (CAN-SPAM / RGPD / LCAP compliance) */
  unsubscribeUrl?: string;
  /** In-Reply-To header for email threading */
  inReplyTo?: string;
  /** References header for email threading */
  references?: string;
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

  // Build headers for compliance and threading
  const headers: Record<string, string> = {};
  if (options.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<mailto:unsubscribe@biocyclepeptides.com>, <${options.unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  // Email threading headers
  if (options.inReplyTo) headers['In-Reply-To'] = options.inReplyTo;
  if (options.references) headers['References'] = options.references;

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
      tags: options.tags?.slice(0, 5).map(t => ({ name: t.slice(0, 256), value: 'true' })),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      ...(options.attachments?.length ? {
        attachments: options.attachments.map(a => ({
          filename: a.filename,
          content: a.content,
          content_type: a.contentType,
        })),
      } : {}),
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

  // Build SendGrid headers for compliance and threading (top-level, not in personalizations)
  const sgHeaders: Record<string, string> = {};
  if (options.unsubscribeUrl) {
    sgHeaders['List-Unsubscribe'] = `<mailto:unsubscribe@biocyclepeptides.com>, <${options.unsubscribeUrl}>`;
    sgHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  if (options.inReplyTo) sgHeaders['In-Reply-To'] = options.inReplyTo;
  if (options.references) sgHeaders['References'] = options.references;

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
      ...(Object.keys(sgHeaders).length > 0 ? { headers: sgHeaders } : {}),
      ...(options.attachments?.length ? {
        attachments: options.attachments.map(a => ({
          filename: a.filename,
          content: a.content,
          type: a.contentType,
          disposition: 'attachment' as const,
        })),
      } : {}),
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
// Cached SMTP transporter (lazy singleton to reuse connection pool)
let _smtpTransporter: unknown = null;
let _smtpConfig = '';

async function sendViaSMTP(options: SendEmailOptions): Promise<EmailResult> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD), falling back to log');
    return logEmail(options);
  }

  const nodemailer = await import('nodemailer');

  // Reuse transporter if config hasn't changed
  const configKey = `${host}:${port}:${user}`;
  if (!_smtpTransporter || _smtpConfig !== configKey) {
    _smtpTransporter = nodemailer.default.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    _smtpConfig = configKey;
  }

  const transporter = _smtpTransporter as ReturnType<typeof nodemailer.default.createTransport>;
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  // Sanitize names to prevent CRLF header injection
  const sanitizeName = (name: string) => name.replace(/[\r\n]/g, '');
  const toAddresses = recipients.map(r => r.name ? `"${sanitizeName(r.name)}" <${r.email}>` : r.email).join(', ');

  const headers: Record<string, string> = {};
  if (options.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<mailto:unsubscribe@biocyclepeptides.com>, <${options.unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  if (options.inReplyTo) headers['In-Reply-To'] = options.inReplyTo;
  if (options.references) headers['References'] = options.references;

  const info = await transporter.sendMail({
    from: options.from?.name ? `"${sanitizeName(options.from.name)}" <${options.from.email}>` : options.from?.email,
    to: toAddresses,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    ...(options.attachments?.length ? {
      attachments: options.attachments.map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.contentType,
      })),
    } : {}),
  });

  return { success: true, messageId: info.messageId };
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
  if (options.unsubscribeUrl) console.log(`List-Unsubscribe: <${options.unsubscribeUrl}>`);
  console.log('-'.repeat(60));
  // Log une version simplifiée du HTML
  const textPreview = options.text || options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 500);
  console.log(`Preview: ${textPreview}...`);
  console.log('='.repeat(60) + '\n');

  return { 
    success: true, 
    messageId: `dev-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`
  };
}

// Export les constantes utiles
export { DEFAULT_FROM, SUPPORT_EMAIL };
