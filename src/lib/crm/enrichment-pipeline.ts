/**
 * Waterfall Email Enrichment Pipeline
 *
 * 4-level cascade:
 *   1. Website Crawl (free) — regex + mailto: + /contact page
 *   2. Hunter.io API ($49/mo) — domain email lookup
 *   3. Email Pattern Generation — firstname.lastname@domain, verify via MX
 *   4. Apollo.io (free 100 credits/mo) — name+company → email+phone
 *
 * Each level runs only if the previous level did NOT find an email.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { updateListCounters } from './prospect-dedup';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichmentResult {
  prospectId: string;
  emailFound: string | null;
  source: string | null;
  additionalData: Record<string, unknown>;
}

export interface EnrichmentBatchResult {
  total: number;
  enriched: number;
  emailsFound: number;
  errors: number;
  results: EnrichmentResult[];
}

interface WebsiteCrawlResult {
  emails: string[];
  phones: string[];
  socialLinks: Record<string, string>;
  contactPageUrl: string | null;
  hasSSL: boolean;
  hasContactPage: boolean;
}

// ---------------------------------------------------------------------------
// Email regex patterns
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const SOCIAL_PATTERNS: Record<string, RegExp> = {
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/gi,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/gi,
  twitter: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9_]+/gi,
};

// Common generic email prefixes to skip
const GENERIC_PREFIXES = new Set([
  'noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster',
  'admin', 'webmaster', 'hostmaster', 'abuse',
]);

function isValidBusinessEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const prefix = lower.split('@')[0];
  if (GENERIC_PREFIXES.has(prefix)) return false;
  // Skip image/file extensions
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(lower)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Level 1: Website Crawl (free)
// ---------------------------------------------------------------------------

async function crawlWebsite(websiteUrl: string): Promise<WebsiteCrawlResult> {
  const result: WebsiteCrawlResult = {
    emails: [],
    phones: [],
    socialLinks: {},
    contactPageUrl: null,
    hasSSL: websiteUrl.startsWith('https'),
    hasContactPage: false,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadEngine/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) return result;
    const html = await res.text();

    // Extract emails
    const mailtoMatches = html.match(MAILTO_REGEX) || [];
    for (const m of mailtoMatches) {
      const email = m.replace(/^mailto:/i, '').toLowerCase();
      if (isValidBusinessEmail(email) && !result.emails.includes(email)) {
        result.emails.push(email);
      }
    }

    const emailMatches = html.match(EMAIL_REGEX) || [];
    for (const email of emailMatches) {
      const lower = email.toLowerCase();
      if (isValidBusinessEmail(lower) && !result.emails.includes(lower)) {
        result.emails.push(lower);
      }
    }

    // Extract phones
    const phoneMatches = html.match(PHONE_REGEX) || [];
    result.phones = [...new Set(phoneMatches)].slice(0, 5);

    // Extract social links
    for (const [platform, regex] of Object.entries(SOCIAL_PATTERNS)) {
      const match = html.match(regex);
      if (match) result.socialLinks[platform] = match[0];
    }

    // Find contact page
    const contactPageMatch = html.match(/href=["']([^"']*(?:contact|about|nous-joindre|contactez)[^"']*)["']/i);
    if (contactPageMatch) {
      try {
        const contactUrl = new URL(contactPageMatch[1], websiteUrl).toString();
        result.contactPageUrl = contactUrl;
        result.hasContactPage = true;

        // Crawl contact page for more emails
        const contactRes = await fetch(contactUrl, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadEngine/1.0)' },
          redirect: 'follow',
        });
        if (contactRes.ok) {
          const contactHtml = await contactRes.text();
          const contactEmails = contactHtml.match(EMAIL_REGEX) || [];
          for (const email of contactEmails) {
            const lower = email.toLowerCase();
            if (isValidBusinessEmail(lower) && !result.emails.includes(lower)) {
              result.emails.push(lower);
            }
          }
          const contactPhones = contactHtml.match(PHONE_REGEX) || [];
          for (const phone of contactPhones) {
            if (!result.phones.includes(phone)) result.phones.push(phone);
          }
        }
      } catch {
        // Contact page crawl failed, continue
      }
    }
  } catch {
    // Website crawl failed entirely
  }

  return result;
}

// ---------------------------------------------------------------------------
// Level 2: Hunter.io API
// ---------------------------------------------------------------------------

async function searchHunter(domain: string): Promise<{ emails: string[]; firstName?: string; lastName?: string; position?: string } | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=5`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return null;
    const data = await res.json();

    const emails: string[] = [];
    let firstName: string | undefined;
    let lastName: string | undefined;
    let position: string | undefined;

    if (data.data?.emails) {
      for (const entry of data.data.emails) {
        if (entry.value) emails.push(entry.value.toLowerCase());
        if (!firstName && entry.first_name) {
          firstName = entry.first_name;
          lastName = entry.last_name;
          position = entry.position;
        }
      }
    }

    return emails.length > 0 ? { emails, firstName, lastName, position } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Level 3: Email Pattern Generation + MX Verification
// ---------------------------------------------------------------------------

async function verifyMxRecord(domain: string): Promise<boolean> {
  try {
    const { promises: dns } = await import('dns');
    const mxRecords = await dns.resolveMx(domain);
    return mxRecords.length > 0;
  } catch {
    return false;
  }
}

function generateEmailPatterns(firstName: string, lastName: string, domain: string): string[] {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  if (!f || !l) return [];

  return [
    `${f}.${l}@${domain}`,
    `${f}${l}@${domain}`,
    `${f[0]}${l}@${domain}`,
    `${f}@${domain}`,
    `${f[0]}.${l}@${domain}`,
    `${l}.${f}@${domain}`,
    `${f}_${l}@${domain}`,
  ];
}

// ---------------------------------------------------------------------------
// Level 4: Apollo.io API
// ---------------------------------------------------------------------------

async function searchApollo(_name: string, companyName: string, domain?: string): Promise<{ email?: string; firstName?: string; lastName?: string; title?: string; linkedinUrl?: string } | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  try {
    const body: Record<string, unknown> = {
      q_organization_name: companyName,
      page: 1,
      per_page: 1,
    };
    if (domain) body.q_organization_domains = domain;

    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const person = data.people?.[0];
    if (!person) return null;

    return {
      email: person.email || undefined,
      firstName: person.first_name || undefined,
      lastName: person.last_name || undefined,
      title: person.title || undefined,
      linkedinUrl: person.linkedin_url || undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main Enrichment Pipeline (single prospect)
// ---------------------------------------------------------------------------

export async function enrichProspect(prospectId: string): Promise<EnrichmentResult> {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) throw new Error(`Prospect ${prospectId} not found`);

  const result: EnrichmentResult = {
    prospectId,
    emailFound: null,
    source: null,
    additionalData: {},
  };

  const updateData: Record<string, unknown> = {};
  let domain: string | undefined;

  // Extract domain from website
  if (prospect.website) {
    try {
      domain = new URL(prospect.website).hostname.replace(/^www\./, '');
    } catch {
      // Invalid URL
    }
  }

  // ---- Level 1: Website Crawl ----
  if (prospect.website && !prospect.email) {
    const crawlResult = await crawlWebsite(prospect.website);

    if (crawlResult.emails.length > 0) {
      result.emailFound = crawlResult.emails[0];
      result.source = 'website_crawl';
      updateData.email = crawlResult.emails[0];
      updateData.enrichmentSource = 'website_crawl';
    }

    // Always capture social links and extra data
    if (crawlResult.socialLinks.linkedin) {
      updateData.linkedinUrl = crawlResult.socialLinks.linkedin;
      result.additionalData.linkedin = crawlResult.socialLinks.linkedin;
    }

    // Update phone if we don't have one
    if (!prospect.phone && crawlResult.phones.length > 0) {
      updateData.phone = crawlResult.phones[0];
    }

    result.additionalData.hasSSL = crawlResult.hasSSL;
    result.additionalData.hasContactPage = crawlResult.hasContactPage;
    result.additionalData.socialLinks = crawlResult.socialLinks;
  }

  // ---- Level 2: Hunter.io ----
  if (!result.emailFound && domain) {
    const hunterResult = await searchHunter(domain);
    if (hunterResult && hunterResult.emails.length > 0) {
      result.emailFound = hunterResult.emails[0];
      result.source = 'hunter';
      updateData.email = hunterResult.emails[0];
      updateData.enrichmentSource = 'hunter';

      if (hunterResult.firstName && !prospect.firstName) {
        updateData.firstName = hunterResult.firstName;
        updateData.lastName = hunterResult.lastName;
      }
      if (hunterResult.position && !prospect.jobTitle) {
        updateData.jobTitle = hunterResult.position;
      }
    }
  }

  // ---- Level 3: Pattern generation + MX check ----
  if (!result.emailFound && domain && prospect.contactName) {
    const parts = prospect.contactName.trim().split(/\s+/);
    const firstName = prospect.firstName || parts[0] || '';
    const lastName = prospect.lastName || parts[parts.length - 1] || '';

    if (firstName && lastName) {
      const hasMx = await verifyMxRecord(domain);
      if (hasMx) {
        const patterns = generateEmailPatterns(firstName, lastName, domain);
        // We can't SMTP-verify without an SMTP library, but MX exists = domain accepts email
        // Use the most common pattern as best guess
        result.emailFound = patterns[0]; // firstname.lastname@domain
        result.source = 'pattern_generation';
        updateData.email = patterns[0];
        updateData.enrichmentSource = 'pattern_generation';

        if (!prospect.firstName) updateData.firstName = firstName;
        if (!prospect.lastName) updateData.lastName = lastName;
      }
    }
  }

  // ---- Level 4: Apollo.io ----
  if (!result.emailFound && prospect.companyName) {
    const apolloResult = await searchApollo(prospect.contactName, prospect.companyName, domain);
    if (apolloResult) {
      if (apolloResult.email) {
        result.emailFound = apolloResult.email;
        result.source = 'apollo';
        updateData.email = apolloResult.email;
        updateData.enrichmentSource = 'apollo';
      }
      if (apolloResult.firstName && !prospect.firstName) updateData.firstName = apolloResult.firstName;
      if (apolloResult.lastName && !prospect.lastName) updateData.lastName = apolloResult.lastName;
      if (apolloResult.title && !prospect.jobTitle) updateData.jobTitle = apolloResult.title;
      if (apolloResult.linkedinUrl && !prospect.linkedinUrl) updateData.linkedinUrl = apolloResult.linkedinUrl;
    }
  }

  // ---- Save enrichment ----
  if (Object.keys(updateData).length > 0) {
    updateData.enrichedAt = new Date();
    await prisma.prospect.update({
      where: { id: prospectId },
      data: updateData,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Batch Enrichment (entire list)
// ---------------------------------------------------------------------------

export async function enrichProspectList(
  listId: string,
  options: { maxConcurrent?: number; statusFilter?: string } = {},
): Promise<EnrichmentBatchResult> {
  const maxConcurrent = options.maxConcurrent || 3;
  const statusFilter = options.statusFilter || 'NEW';

  const prospects = await prisma.prospect.findMany({
    where: {
      listId,
      status: statusFilter as 'NEW' | 'VALIDATED',
      email: null, // Only enrich those without email
      website: { not: null }, // Must have a website to crawl
    },
    select: { id: true },
  });

  const results: EnrichmentResult[] = [];
  let enriched = 0;
  let emailsFound = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < prospects.length; i += maxConcurrent) {
    const batch = prospects.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map((p) => enrichProspect(p.id)),
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
        enriched++;
        if (r.value.emailFound) emailsFound++;
      } else {
        errors++;
        logger.warn('Enrichment failed for prospect', { error: r.reason });
      }
    }

    // Rate limit: 1 second between batches
    if (i + maxConcurrent < prospects.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await updateListCounters(listId);
  logger.info('Enrichment batch completed', { listId, total: prospects.length, enriched, emailsFound, errors });

  return { total: prospects.length, enriched, emailsFound, errors, results };
}
