/**
 * CRM Contact Enrichment (K15)
 * Enriches lead data from public sources (web scraping, domain lookup).
 * Includes AI-powered web enrichment via OpenAI.
 * Can be extended with Clearbit/Apollo APIs later.
 */
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Lazy OpenAI client
// ---------------------------------------------------------------------------

let _openai: ReturnType<typeof require> | null = null;

function getOpenAI(): { chat: { completions: { create: (params: Record<string, unknown>) => Promise<{ choices?: { message?: { content?: string } }[] }> } } } {
  if (_openai) return _openai;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: OpenAI } = require('openai');
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export interface EnrichmentResult {
  leadId: string;
  fieldsEnriched: string[];
  data: {
    companyDomain?: string;
    companySize?: string;
    industry?: string;
    linkedinUrl?: string;
    city?: string;
    country?: string;
  };
}

/**
 * Enrich a lead using email domain analysis.
 * Basic enrichment: extract company domain from email, infer company name.
 */
export async function enrichLead(leadId: string): Promise<EnrichmentResult> {
  const lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  const fieldsEnriched: string[] = [];
  const data: EnrichmentResult['data'] = {};
  const updateData: Record<string, unknown> = {};

  // Extract domain from email
  if (lead.email) {
    const domain = lead.email.split('@')[1];
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
      data.companyDomain = domain;
      if (!lead.companyName) {
        // Infer company name from domain
        const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        updateData.companyName = companyName;
        fieldsEnriched.push('companyName');
      }
    }
  }

  // Store enrichment in customFields
  if (Object.keys(data).length > 0) {
    const existingCustom = (lead.customFields as Record<string, unknown>) || {};
    updateData.customFields = { ...existingCustom, _enrichment: data, _enrichedAt: new Date().toISOString() };
    fieldsEnriched.push('customFields');
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.crmLead.update({
      where: { id: leadId },
      data: updateData as Parameters<typeof prisma.crmLead.update>[0]['data'],
    });
  }

  logger.info('Lead enriched', { leadId, fieldsEnriched });
  return { leadId, fieldsEnriched, data };
}

/**
 * Bulk enrich leads (e.g., for newly imported leads).
 */
export async function bulkEnrichLeads(leadIds: string[]): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];
  for (const id of leadIds) {
    try {
      results.push(await enrichLead(id));
    } catch (err) {
      logger.warn('Enrichment failed for lead', { leadId: id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Web scraping enrichment (K15)
// ---------------------------------------------------------------------------

export interface WebEnrichmentResult {
  contactId: string;
  fieldsEnriched: string[];
  data: {
    companySize?: string;
    industry?: string;
    description?: string;
    technologies?: string[];
    socialProfiles?: Record<string, string>;
    revenue?: string;
    headquarters?: string;
    foundedYear?: number;
  };
}

export interface DomainEnrichment {
  domain: string;
  companyName?: string;
  companySize?: string;
  industry?: string;
  description?: string;
  techStack?: string[];
  headquarters?: string;
  foundedYear?: number;
}

/**
 * Fetch text content from a URL. Uses native fetch with timeout.
 * Returns raw HTML text (limited to first 8000 chars for AI processing).
 */
async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BioCyclePeptides/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    const text = await response.text();
    // Strip HTML tags for cleaner AI processing
    const cleaned = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.slice(0, 8000);
  } catch {
    return null;
  }
}

/**
 * Use OpenAI to extract structured company/contact data from scraped web content.
 */
async function extractStructuredData(
  content: string,
  context: string,
): Promise<{
  companyName?: string;
  companySize?: string;
  industry?: string;
  description?: string;
  technologies?: string[];
  headquarters?: string;
  foundedYear?: number;
  revenue?: string;
  socialProfiles?: Record<string, string>;
}> {
  try {
    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: process.env.ENRICHMENT_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Extract structured company/contact information from the provided web page content. ' +
            'Return ONLY a JSON object with these optional fields:\n' +
            '- "companyName": string\n' +
            '- "companySize": string (e.g., "11-50", "51-200", "201-500")\n' +
            '- "industry": string\n' +
            '- "description": string (1-2 sentences)\n' +
            '- "technologies": string[] (tech stack mentioned)\n' +
            '- "headquarters": string (city, country)\n' +
            '- "foundedYear": number\n' +
            '- "revenue": string (estimated range)\n' +
            '- "socialProfiles": { "linkedin"?: string, "twitter"?: string }\n' +
            'Only include fields you can confidently extract. Return {} if nothing found.',
        },
        {
          role: 'user',
          content: `Context: ${context}\n\nWeb content:\n${content.slice(0, 4000)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    logger.error('[Enrichment] AI extraction failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

/**
 * Enrich a contact/lead by scraping web sources (company website, LinkedIn).
 * Uses OpenAI to extract structured data from scraped content.
 */
export async function enrichFromWeb(contactId: string): Promise<WebEnrichmentResult> {
  const lead = await prisma.crmLead.findUnique({ where: { id: contactId } });
  if (!lead) throw new Error('Contact/lead not found');

  const fieldsEnriched: string[] = [];
  const data: WebEnrichmentResult['data'] = {};

  // Determine domain from email
  let domain: string | null = null;
  if (lead.email) {
    const emailDomain = lead.email.split('@')[1];
    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'];
    if (emailDomain && !freeProviders.includes(emailDomain)) {
      domain = emailDomain;
    }
  }

  // Try company website
  if (domain) {
    const content = await fetchPageContent(`https://${domain}`);
    if (content) {
      const extracted = await extractStructuredData(
        content,
        `Company website for ${lead.companyName || domain}`,
      );

      if (extracted.companySize) { data.companySize = extracted.companySize; fieldsEnriched.push('companySize'); }
      if (extracted.industry) { data.industry = extracted.industry; fieldsEnriched.push('industry'); }
      if (extracted.description) { data.description = extracted.description; fieldsEnriched.push('description'); }
      if (extracted.technologies) { data.technologies = extracted.technologies; fieldsEnriched.push('technologies'); }
      if (extracted.headquarters) { data.headquarters = extracted.headquarters; fieldsEnriched.push('headquarters'); }
      if (extracted.foundedYear) { data.foundedYear = extracted.foundedYear; fieldsEnriched.push('foundedYear'); }
      if (extracted.revenue) { data.revenue = extracted.revenue; fieldsEnriched.push('revenue'); }
      if (extracted.socialProfiles) { data.socialProfiles = extracted.socialProfiles; fieldsEnriched.push('socialProfiles'); }
    }
  }

  // Store enrichment data in customFields
  if (fieldsEnriched.length > 0) {
    const existingCustom = (lead.customFields as Record<string, unknown>) || {};
    await prisma.crmLead.update({
      where: { id: contactId },
      data: {
        companyName: lead.companyName || (data as Record<string, unknown>).companyName as string || undefined,
        customFields: {
          ...existingCustom,
          _webEnrichment: data,
          _webEnrichedAt: new Date().toISOString(),
        },
      } as Parameters<typeof prisma.crmLead.update>[0]['data'],
    });
  }

  logger.info('[Enrichment] Web enrichment complete', { contactId, fieldsEnriched });
  return { contactId, fieldsEnriched, data };
}

/**
 * Get company info from a domain (size, industry, tech stack).
 * Scrapes the domain's website and uses AI extraction.
 */
export async function enrichFromDomain(domain: string): Promise<DomainEnrichment> {
  const result: DomainEnrichment = { domain };

  const content = await fetchPageContent(`https://${domain}`);
  if (!content) {
    logger.warn('[Enrichment] Could not fetch domain', { domain });
    return result;
  }

  const extracted = await extractStructuredData(
    content,
    `Company website: ${domain}`,
  );

  if (extracted.companyName) result.companyName = extracted.companyName;
  if (extracted.companySize) result.companySize = extracted.companySize;
  if (extracted.industry) result.industry = extracted.industry;
  if (extracted.description) result.description = extracted.description;
  if (extracted.technologies) result.techStack = extracted.technologies;
  if (extracted.headquarters) result.headquarters = extracted.headquarters;
  if (extracted.foundedYear) result.foundedYear = extracted.foundedYear;

  logger.info('[Enrichment] Domain enrichment complete', {
    domain,
    fieldsFound: Object.keys(result).length - 1,
  });

  return result;
}
