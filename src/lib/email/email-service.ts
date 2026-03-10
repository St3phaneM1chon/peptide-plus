/**
 * Service d'envoi d'emails - BioCycle Peptides
 * Compatible avec Resend, SendGrid, ou SMTP
 */

import { logger } from '@/lib/logger';
import { addEmailTracking } from '@/lib/email/tracking';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { prisma } from '@/lib/db';
import { getRedisClient, isRedisAvailable } from '@/lib/redis';

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

export type EmailType = 'marketing' | 'transactional';

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
  /** Email type: 'marketing' adds tracking pixel + click tracking; 'transactional' does not */
  emailType?: EmailType;
  /** EmailLog ID for tracking pixel/click injection (only used when emailType is 'marketing') */
  emailLogId?: string;
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

// ---------------------------------------------------------------------------
// DB-backed email config with TTL cache
// ---------------------------------------------------------------------------

interface EmailConfig {
  provider: string;
  senderEmail: string;
  senderName: string;
  replyEmail: string;
}

let _configCache: { config: EmailConfig; expiresAt: number } | null = null;
const CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getEmailConfig(): Promise<EmailConfig> {
  if (_configCache && Date.now() < _configCache.expiresAt) {
    return _configCache.config;
  }

  try {
    const settings = await prisma.emailSettings.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    const config: EmailConfig = {
      provider: map['email.provider']?.toLowerCase() || process.env.EMAIL_PROVIDER || 'log',
      senderEmail: map['email.senderEmail'] || process.env.SMTP_FROM || 'noreply@biocyclepeptides.com',
      senderName: map['email.senderName'] || 'BioCycle Peptides',
      replyEmail: map['email.replyEmail'] || process.env.SMTP_FROM || '',
    };

    _configCache = { config, expiresAt: Date.now() + CONFIG_TTL_MS };
    return config;
  } catch (err) {
    logger.warn('[EmailService] Failed to read EmailSettings from DB, using env vars', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      provider: process.env.EMAIL_PROVIDER || 'log',
      senderEmail: process.env.SMTP_FROM || 'noreply@biocyclepeptides.com',
      senderName: 'BioCycle Peptides',
      replyEmail: process.env.SMTP_FROM || '',
    };
  }
}

// ---------------------------------------------------------------------------
// Plain text fallback: strip HTML to generate text/plain MIME part
// ---------------------------------------------------------------------------

/**
 * Convert HTML to plain text for multipart/alternative fallback.
 * Ensures deliverability for clients that don't render HTML.
 */
function htmlToText(html: string): string {
  let text = html;
  // Line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Paragraphs
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  // Links: <a href="url">text</a> → text (url)
  text = text.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)');
  // List items
  text = text.replace(/<li[^>]*>/gi, '- ');
  text = text.replace(/<\/li>/gi, '\n');
  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse excessive whitespace (but preserve intentional newlines)
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

// ---------------------------------------------------------------------------
// Rate limiting (Faille #3): prevent email flooding
// Redis-backed with in-memory fallback for single-instance deployments
// ---------------------------------------------------------------------------
const EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour in seconds for Redis
const EMAIL_RATE_LIMIT_MAX = 20; // Max emails per address per hour

// In-memory fallback (used when Redis is unavailable)
const emailRateMap = new Map<string, { count: number; resetAt: number }>();
let rateLimitCheckCount = 0;

/**
 * Check email rate limit using Redis (preferred) or in-memory fallback.
 * Uses Redis INCR + EXPIRE for atomic, distributed rate limiting.
 */
async function checkEmailRateLimit(toEmail: string): Promise<boolean> {
  const normalizedEmail = toEmail.toLowerCase().trim();

  // Try Redis first for distributed rate limiting
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const redisKey = `email_rl:${normalizedEmail}`;
        const count = await redis.incr(redisKey);
        if (count === 1) {
          // First email in this window -- set TTL
          await redis.expire(redisKey, EMAIL_RATE_LIMIT_WINDOW_SECONDS);
        }
        if (count > EMAIL_RATE_LIMIT_MAX) {
          logger.warn('[EmailService] Redis rate limit exceeded', { email: normalizedEmail, count });
          return false;
        }
        return true;
      }
    } catch (err) {
      logger.warn('[EmailService] Redis rate limit check failed, falling back to memory', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fallback: in-memory rate limiting
  return checkEmailRateLimitMemory(normalizedEmail);
}

function checkEmailRateLimitMemory(key: string): boolean {
  const now = Date.now();
  const entry = emailRateMap.get(key);
  if (!entry || entry.resetAt < now) {
    emailRateMap.set(key, { count: 1, resetAt: now + EMAIL_RATE_LIMIT_WINDOW_MS });
  } else if (entry.count >= EMAIL_RATE_LIMIT_MAX) {
    return false;
  } else {
    entry.count++;
  }

  // Auto-cleanup: every 1000 calls, scan and evict expired entries
  rateLimitCheckCount++;
  if (rateLimitCheckCount % 1000 === 0) {
    evictRateLimitCache();
  }

  return true;
}

// Evict expired entries from the in-memory rate limit cache
function evictRateLimitCache(): void {
  const now = Date.now();
  for (const [key, entry] of emailRateMap) {
    if (entry.resetAt < now) emailRateMap.delete(key);
  }
}

// ---------------------------------------------------------------------------
// replyTo validation (Faille MEDIUM): reject invalid or CRLF-injected replyTo
// ---------------------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeReplyTo(replyTo: string | undefined): string | undefined {
  if (!replyTo) return undefined;
  // Strip CRLF to prevent header injection (same treatment as sanitizeName)
  const cleaned = replyTo.replace(/[\r\n]/g, '').trim();
  if (!EMAIL_REGEX.test(cleaned)) {
    logger.warn(`[EmailService] Invalid replyTo address rejected: ${cleaned}`);
    return undefined;
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Safety limits
// ---------------------------------------------------------------------------
const MAX_SUBJECT_LENGTH = 998; // SMTP RFC 2822 line length limit
const MAX_HTML_SIZE = 20_000_000; // 20 MB – SendGrid payload limit

/**
 * Envoie un email via le provider configuré
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  // AMELIORATION: Use crypto.randomUUID instead of Math.random for request IDs
  const requestId = crypto.randomUUID().replace(/-/g, '');

  // Read config from DB (cached 5min) with env var fallback
  const config = await getEmailConfig();
  const provider = config.provider;

  // Subject length validation (SMTP limit)
  options.subject = options.subject.slice(0, MAX_SUBJECT_LENGTH);

  // Tags array type guard
  const safeTags = Array.isArray(options.tags) ? options.tags.slice(0, 5) : [];
  options.tags = safeTags;

  // HTML content size check
  if (options.html && options.html.length > MAX_HTML_SIZE) {
    logger.warn('HTML content exceeds maximum size', { requestId, size: options.html.length, maxSize: MAX_HTML_SIZE });
    return { success: false, error: 'HTML content exceeds maximum allowed size' };
  }

  const emailData = {
    ...options,
    from: options.from || {
      email: config.senderEmail,
      name: config.senderName,
    },
    replyTo: sanitizeReplyTo(options.replyTo || config.replyEmail || undefined),
  };

  // Rate limit check (Faille #3) - now async for Redis support
  const recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
  for (const r of recipients) {
    if (!(await checkEmailRateLimit(r.email))) {
      logger.warn('Email rate limit exceeded', { requestId, recipient: r.email });
      return { success: false, error: 'Rate limit exceeded for this recipient' };
    }
  }

  // Bounce auto-suppression: skip sending to addresses that have bounced
  for (const r of recipients) {
    const bounceCheck = await shouldSuppressEmail(r.email);
    if (bounceCheck.suppressed) {
      logger.info('Email suppressed due to bounce', { requestId, recipient: r.email, reason: bounceCheck.reason });
      return { success: false, error: `Recipient suppressed: ${bounceCheck.reason}` };
    }
  }

  // Inject tracking pixel and click tracking for marketing emails
  // Must happen BEFORE text fallback generation so tracking pixel doesn't appear in text
  if (emailData.emailType === 'marketing' && emailData.emailLogId && emailData.html) {
    try {
      emailData.html = addEmailTracking(emailData.html, emailData.emailLogId);
    } catch (trackingErr) {
      // Non-fatal: send the email without tracking rather than failing
      logger.warn('[EmailService] Failed to inject tracking, sending without', {
        requestId,
        emailLogId: emailData.emailLogId,
        error: trackingErr instanceof Error ? trackingErr.message : String(trackingErr),
      });
    }
  }

  // Auto-generate plain text fallback from HTML when not provided
  if (!emailData.text && emailData.html) {
    emailData.text = htmlToText(emailData.html);
  }

  logger.info('Sending email', { requestId, provider, to: recipients.map(r => r.email), subject: emailData.subject.slice(0, 80) });

  // Try the configured provider first with retries, then fallback to others
  const primaryResult = await sendWithRetries(provider, emailData, requestId);

  if (primaryResult.success) {
    return primaryResult;
  }

  // ---------------------------------------------------------------------------
  // Fallback chain: try other providers if the primary one failed
  // ---------------------------------------------------------------------------
  const fallbackOrder: Array<'resend' | 'sendgrid' | 'smtp'> = ['resend', 'sendgrid', 'smtp'];

  for (const fallbackProvider of fallbackOrder) {
    if (fallbackProvider === provider) continue; // Already tried

    // Verify the fallback provider has credentials before attempting
    if (!hasProviderCredentials(fallbackProvider)) continue;

    logger.warn(`[EmailService] Fallback to ${fallbackProvider} after ${provider} failed`, {
      requestId,
      primaryError: primaryResult.error,
    });

    const fallbackResult = await sendWithRetries(fallbackProvider, emailData, requestId);

    if (fallbackResult.success) {
      logger.info(`[EmailService] Email sent via fallback provider ${fallbackProvider}`, {
        requestId,
        originalProvider: provider,
      });
      return fallbackResult;
    }

    logger.warn(`[EmailService] Fallback provider ${fallbackProvider} also failed`, {
      requestId,
      error: fallbackResult.error,
    });
  }

  // All providers failed
  logger.error('[EmailService] All providers failed (primary + fallbacks)', {
    requestId,
    primaryProvider: provider,
  });
  return { success: false, error: 'Failed to send email: all providers exhausted' };
}

// ---------------------------------------------------------------------------
// Provider credential check for fallback chain
// ---------------------------------------------------------------------------

/**
 * Check if a provider has the necessary credentials configured.
 * Used by the fallback chain to skip providers that can't possibly work.
 */
function hasProviderCredentials(provider: string): boolean {
  switch (provider) {
    case 'resend':
      return !!process.env.RESEND_API_KEY;
    case 'sendgrid':
      return !!process.env.SENDGRID_API_KEY;
    case 'smtp':
      return !!(process.env.SMTP_HOST && process.env.SMTP_USER && (process.env.SMTP_PASSWORD || process.env.SMTP_PASS));
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Retry logic extracted for reuse by primary + fallback providers
// ---------------------------------------------------------------------------

/**
 * Send an email via a specific provider with exponential backoff retries.
 * Returns the result after all retry attempts are exhausted.
 */
async function sendWithRetries(
  provider: string,
  emailData: SendEmailOptions,
  requestId: string
): Promise<EmailResult> {
  const MAX_RETRIES = 3;
  const BACKOFF_BASE_MS = 1000; // 1s, 4s, 16s (base^(2*attempt))

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let result: EmailResult;

      switch (provider) {
        case 'resend':
          result = await sendViaResend(emailData);
          break;
        case 'sendgrid':
          result = await sendViaSendGrid(emailData);
          break;
        case 'smtp':
          result = await sendViaSMTP(emailData);
          break;
        default:
          // Mode développement: log l'email (no retry needed)
          return await logEmail(emailData);
      }

      // If the provider returned a non-retryable error (e.g., invalid address), don't retry
      if (!result.success && attempt < MAX_RETRIES && isRetryableError(result.error)) {
        const delay = BACKOFF_BASE_MS * Math.pow(4, attempt); // 1s, 4s, 16s
        logger.warn('Email send failed, retrying', { requestId, provider, attempt: attempt + 1, delay, error: result.error });
        await sleep(delay);
        continue;
      }

      if (result.success && attempt > 0) {
        logger.info('Email send succeeded after retry', { requestId, provider, attempts: attempt + 1 });
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (attempt < MAX_RETRIES) {
        const delay = BACKOFF_BASE_MS * Math.pow(4, attempt); // 1s, 4s, 16s
        logger.warn('Email send threw error, retrying', { requestId, provider, attempt: attempt + 1, delay, error: errorMsg });
        await sleep(delay);
        continue;
      }

      // Faille #29: don't leak error details (may contain API keys/PII)
      const isDevMode = process.env.NODE_ENV !== 'production';
      if (isDevMode) logger.error('Email send error (all retries exhausted)', { error: errorMsg });
      logger.error('Email send failed', { requestId, provider, attempts: attempt + 1, error: errorMsg });
      return {
        success: false,
        error: 'Failed to send email',
      };
    }
  }

  // Should never reach here, but TypeScript needs a return
  return { success: false, error: 'Failed to send email' };
}

// ---------------------------------------------------------------------------
// Retry helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine if an email send error is retryable.
 * Rate limits, server errors, and timeouts are retryable.
 * Invalid addresses, auth errors, and payload errors are not.
 */
function isRetryableError(error?: string): boolean {
  if (!error) return true; // Unknown errors are retried by default
  const lower = error.toLowerCase();
  // Non-retryable errors
  if (lower.includes('invalid') || lower.includes('not found') || lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('bad request')) {
    return false;
  }
  // Retryable errors
  return true;
}

/**
 * Envoi via Resend
 */
async function sendViaResend(options: SendEmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not configured, falling back to log');
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

  // Sanitize names to prevent CRLF header injection (Faille #1)
  const sanitizeName = (name: string) => name.replace(/[\r\n]/g, '');

  const safeTags = Array.isArray(options.tags) ? options.tags.slice(0, 5) : [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: `${sanitizeName(options.from?.name || 'BioCycle Peptides')} <${options.from?.email}>`,
        to: Array.isArray(options.to)
          ? options.to.map(r => r.email)
          : [options.to.email],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        tags: safeTags.map(t => ({ name: t.slice(0, 256), value: 'true' })),
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
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Envoi via SendGrid
 */
async function sendViaSendGrid(options: SendEmailOptions): Promise<EmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    logger.warn('SENDGRID_API_KEY not configured, falling back to log');
    return logEmail(options);
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  // Sanitize names to prevent CRLF header injection (Faille #1)
  const sanitizeSgName = (name: string) => name.replace(/[\r\n]/g, '');

  // Build headers for compliance and threading
  // Faille #7: List-Unsubscribe MUST be in personalizations.headers for SendGrid v3
  const sgHeaders: Record<string, string> = {};
  if (options.unsubscribeUrl) {
    sgHeaders['List-Unsubscribe'] = `<mailto:unsubscribe@biocyclepeptides.com>, <${options.unsubscribeUrl}>`;
    sgHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  if (options.inReplyTo) sgHeaders['In-Reply-To'] = options.inReplyTo;
  if (options.references) sgHeaders['References'] = options.references;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        personalizations: [{
          to: recipients.map(r => ({ email: r.email, name: r.name ? sanitizeSgName(r.name) : undefined })),
          ...(Object.keys(sgHeaders).length > 0 ? { headers: sgHeaders } : {}),
        }],
        from: { email: options.from?.email, name: options.from?.name ? sanitizeSgName(options.from.name) : undefined },
        reply_to: options.replyTo ? { email: options.replyTo } : undefined,
        subject: options.subject,
        content: [
          { type: 'text/plain', value: options.text || '' },
          { type: 'text/html', value: options.html },
        ],
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
      await response.text(); // consume response body
      return { success: false, error: 'SendGrid API error' }; // Faille #20: don't leak API response details
    }

    return { success: true, messageId: response.headers.get('x-message-id') || undefined };
  } finally {
    clearTimeout(timeout);
  }
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
    logger.warn('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD), falling back to log');
    return logEmail(options);
  }

  // SECURITY FIX: Use dynamic import instead of eval('require') to prevent
  // webpack from bundling nodemailer at build time while avoiding eval().
  // nodemailer is only needed at runtime when SMTP provider is selected.
  const nodemailer = await import('nodemailer');

  // Reuse transporter if config hasn't changed
  const configKey = `${host}:${port}:${user}`;
  if (!_smtpTransporter || _smtpConfig !== configKey) {
    const nm = (nodemailer as unknown as { default?: typeof nodemailer }).default || nodemailer;
    _smtpTransporter = nm.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    _smtpConfig = configKey;
  }

  const transporter = _smtpTransporter as ReturnType<typeof nodemailer.createTransport>;
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
  
  const textPreview = options.text || options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 500);
  logger.info('EMAIL (DEV MODE - NOT SENT)', {
    from: `${options.from?.name} <${options.from?.email}>`,
    to: recipients.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', '),
    subject: options.subject,
    replyTo: options.replyTo || undefined,
    unsubscribeUrl: options.unsubscribeUrl || undefined,
    preview: `${textPreview}...`,
  });

  return { 
    success: true, 
    messageId: `dev-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`
  };
}

// Export les constantes utiles
export { DEFAULT_FROM, SUPPORT_EMAIL };
