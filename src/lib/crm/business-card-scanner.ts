/**
 * Business Card Scanner OCR (N6 - Business Card Scanner)
 * Scans business cards via camera -> auto-creates leads.
 * Uses OpenAI Vision API to extract text from card images,
 * then parses structured fields and creates CrmLead records.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Lazy OpenAI client (NEVER instantiate at top-level)
// ---------------------------------------------------------------------------

let _openai: any | null = null;

function getOpenAI(): any {
  if (_openai) return _openai;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set - required for business card scanning');
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: OpenAI } = require('openai');
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessCardData {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  website?: string;
  linkedin?: string;
  rawText: string;
  confidence: number;
}

export interface ScanResult {
  id: string;
  parsedData: BusinessCardData;
  leadId: string | null;
  leadCreated: boolean;
  duplicateOf: string | null;
  scannedAt: string;
  userId: string;
}

export interface ScanHistoryEntry {
  id: string;
  parsedData: BusinessCardData;
  leadId: string | null;
  leadCreated: boolean;
  scannedAt: string;
}

export interface ScannerStats {
  totalScans: number;
  leadsCreated: number;
  duplicatesFound: number;
  avgConfidence: number;
  scansByDay: { date: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Process a business card image using OpenAI Vision API.
 * Extracts text and returns structured contact information.
 */
export async function processBusinessCard(imageBase64: string): Promise<BusinessCardData> {
  const openai = getOpenAI();

  const prompt = `Analyze this business card image and extract all contact information.
Return a JSON object with these fields (use null for missing fields):
- firstName: first name
- lastName: last name
- fullName: full name as printed
- title: job title / position
- company: company name
- email: email address
- phone: office/main phone number
- mobile: mobile phone number
- fax: fax number
- address: street address
- city: city
- state: state or province
- zipCode: zip/postal code
- country: country
- website: website URL
- linkedin: LinkedIn URL or profile
- rawText: all text visible on the card

Also include a "confidence" field (0.0-1.0) indicating how confident you are in the extraction.

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const content = response.choices?.[0]?.message?.content || '{}';

    // Parse JSON response, handling possible markdown wrapping
    let cleanJson = content.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleanJson) as BusinessCardData;

    logger.info('[BusinessCardScanner] Card processed', {
      confidence: parsed.confidence,
      hasEmail: !!parsed.email,
      hasPhone: !!parsed.phone,
      company: parsed.company,
    });

    return {
      ...parsed,
      rawText: parsed.rawText || content,
      confidence: parsed.confidence || 0.5,
    };
  } catch (err) {
    logger.error('[BusinessCardScanner] OCR failed', { error: err instanceof Error ? err.message : String(err) });
    throw new Error(`Business card processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Parse raw text into structured business card fields.
 * Fallback for when Vision API is not available or for text-only input.
 */
export function parseBusinessCardText(extractedText: string): BusinessCardData {
  const lines = extractedText.split('\n').map((l) => l.trim()).filter(Boolean);

  const result: BusinessCardData = {
    rawText: extractedText,
    confidence: 0.4,
  };

  for (const line of lines) {
    // Email detection
    const emailMatch = line.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
    if (emailMatch && !result.email) {
      result.email = emailMatch[0].toLowerCase();
      continue;
    }

    // Phone detection (various formats)
    const phoneMatch = line.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
    if (phoneMatch) {
      const label = line.toLowerCase();
      if (label.includes('fax')) {
        result.fax = phoneMatch[0];
      } else if (label.includes('mob') || label.includes('cell') || label.includes('mobile')) {
        result.mobile = phoneMatch[0];
      } else if (!result.phone) {
        result.phone = phoneMatch[0];
      }
      continue;
    }

    // Website detection
    const urlMatch = line.match(/(?:https?:\/\/)?(?:www\.)?[\w.-]+\.\w{2,}(?:\/\S*)?/i);
    if (urlMatch && !result.website && !line.includes('@')) {
      result.website = urlMatch[0];
      continue;
    }

    // LinkedIn detection
    if (line.toLowerCase().includes('linkedin.com')) {
      result.linkedin = line;
      continue;
    }
  }

  // First line is often the name if it does not contain email/phone/url
  const nameLine = lines.find(
    (l) => !l.includes('@') && !l.match(/\d{3,}/) && !l.match(/www\./) && l.length < 50,
  );
  if (nameLine) {
    result.fullName = nameLine;
    const parts = nameLine.split(/\s+/);
    if (parts.length >= 2) {
      result.firstName = parts[0];
      result.lastName = parts.slice(1).join(' ');
    } else {
      result.firstName = nameLine;
    }
  }

  return result;
}

/**
 * Create a CrmLead from parsed business card data with dedup check.
 * Returns the lead ID and whether it was newly created or matched an existing lead.
 */
export async function createLeadFromCard(
  parsedData: BusinessCardData,
  userId: string,
): Promise<ScanResult> {
  const scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Check for duplicate by email first
  let duplicateOf: string | null = null;

  if (parsedData.email) {
    const existingByEmail = await prisma.crmLead.findFirst({
      where: { email: parsedData.email.toLowerCase() },
      select: { id: true },
    });

    if (existingByEmail) {
      duplicateOf = existingByEmail.id;

      // Update existing lead with any new info from the card
      const updateData: Record<string, unknown> = {};
      if (parsedData.phone && !await hasPhone(existingByEmail.id)) {
        updateData.phone = parsedData.phone;
      }
      if (parsedData.company) {
        updateData.companyName = parsedData.company;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.crmLead.update({
          where: { id: existingByEmail.id },
          data: updateData as Parameters<typeof prisma.crmLead.update>[0]['data'],
        });
      }

      // Log the scan as activity
      await logScanActivity(scanId, parsedData, userId, existingByEmail.id, false);

      logger.info('[BusinessCardScanner] Duplicate found by email', { email: parsedData.email, leadId: existingByEmail.id });

      return {
        id: scanId,
        parsedData,
        leadId: existingByEmail.id,
        leadCreated: false,
        duplicateOf: existingByEmail.id,
        scannedAt: new Date().toISOString(),
        userId,
      };
    }
  }

  // Check for duplicate by phone
  if (parsedData.phone && !duplicateOf) {
    const normalizedPhone = parsedData.phone.replace(/\D/g, '');
    if (normalizedPhone.length >= 7) {
      const leadsWithPhone = await prisma.crmLead.findMany({
        where: { phone: { not: null } },
        select: { id: true, phone: true },
        take: 500,
      });

      for (const lead of leadsWithPhone) {
        if (!lead.phone) continue;
        const leadNorm = lead.phone.replace(/\D/g, '');
        const shortLead = leadNorm.length > 10 ? leadNorm.slice(-10) : leadNorm;
        const shortInput = normalizedPhone.length > 10 ? normalizedPhone.slice(-10) : normalizedPhone;

        if (shortLead === shortInput) {
          duplicateOf = lead.id;

          await logScanActivity(scanId, parsedData, userId, lead.id, false);

          logger.info('[BusinessCardScanner] Duplicate found by phone', { phone: parsedData.phone, leadId: lead.id });

          return {
            id: scanId,
            parsedData,
            leadId: lead.id,
            leadCreated: false,
            duplicateOf: lead.id,
            scannedAt: new Date().toISOString(),
            userId,
          };
        }
      }
    }
  }

  // No duplicate found — create new lead
  const contactName = parsedData.fullName
    || [parsedData.firstName, parsedData.lastName].filter(Boolean).join(' ')
    || 'Unknown';

  const lead = await prisma.crmLead.create({
    data: {
      contactName,
      email: parsedData.email?.toLowerCase() || null,
      phone: parsedData.phone || parsedData.mobile || null,
      companyName: parsedData.company || null,
      source: 'MANUAL',
      status: 'NEW',
      assignedToId: userId,
      customFields: {
        _businessCard: {
          source: 'business_card',
          title: parsedData.title,
          website: parsedData.website,
          linkedin: parsedData.linkedin,
          mobile: parsedData.mobile,
          fax: parsedData.fax,
          address: parsedData.address,
          city: parsedData.city,
          state: parsedData.state,
          zipCode: parsedData.zipCode,
          country: parsedData.country,
          scannedAt: new Date().toISOString(),
          confidence: parsedData.confidence,
        },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  await logScanActivity(scanId, parsedData, userId, lead.id, true);

  logger.info('[BusinessCardScanner] Lead created from card', { leadId: lead.id, contactName });

  return {
    id: scanId,
    parsedData,
    leadId: lead.id,
    leadCreated: true,
    duplicateOf: null,
    scannedAt: new Date().toISOString(),
    userId,
  };
}

/**
 * Get the history of scanned business cards for a user.
 */
export async function getBusinessCardHistory(userId: string): Promise<ScanHistoryEntry[]> {
  const activities = await prisma.crmActivity.findMany({
    where: {
      performedById: userId,
      type: 'NOTE',
      metadata: {
        path: ['source'],
        equals: 'business_card_scan',
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return activities.map((a) => {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    return {
      id: (meta.scanId as string) || a.id,
      parsedData: (meta.parsedData as BusinessCardData) || { rawText: '', confidence: 0 },
      leadId: a.leadId,
      leadCreated: (meta.leadCreated as boolean) || false,
      scannedAt: a.createdAt.toISOString(),
    };
  });
}

/**
 * Get scanning statistics for a given period.
 */
export async function getScannerStats(
  period: { start: string; end: string },
): Promise<ScannerStats> {
  const activities = await prisma.crmActivity.findMany({
    where: {
      type: 'NOTE',
      metadata: {
        path: ['source'],
        equals: 'business_card_scan',
      },
      createdAt: {
        gte: new Date(period.start),
        lte: new Date(period.end),
      },
    },
    select: { metadata: true, createdAt: true },
    take: 1000,
  });

  let leadsCreated = 0;
  let duplicatesFound = 0;
  let totalConfidence = 0;
  const scansByDayMap = new Map<string, number>();

  for (const a of activities) {
    const meta = (a.metadata || {}) as Record<string, unknown>;

    if (meta.leadCreated === true) leadsCreated++;
    if (meta.duplicateOf) duplicatesFound++;

    const parsedData = meta.parsedData as BusinessCardData | undefined;
    totalConfidence += parsedData?.confidence || 0;

    const dateKey = a.createdAt.toISOString().split('T')[0];
    scansByDayMap.set(dateKey, (scansByDayMap.get(dateKey) || 0) + 1);
  }

  const scansByDay = Array.from(scansByDayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalScans: activities.length,
    leadsCreated,
    duplicatesFound,
    avgConfidence: activities.length > 0 ? Math.round((totalConfidence / activities.length) * 100) / 100 : 0,
    scansByDay,
  };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

async function hasPhone(leadId: string): Promise<boolean> {
  const lead = await prisma.crmLead.findUnique({
    where: { id: leadId },
    select: { phone: true },
  });
  return !!lead?.phone;
}

async function logScanActivity(
  scanId: string,
  parsedData: BusinessCardData,
  userId: string,
  leadId: string,
  leadCreated: boolean,
): Promise<void> {
  await prisma.crmActivity.create({
    data: {
      type: 'NOTE',
      title: `Business card scan: ${parsedData.fullName || parsedData.email || 'Unknown'}`,
      description: `Scanned business card${leadCreated ? ' → new lead created' : ' → matched existing lead'}`,
      performedById: userId,
      leadId,
      metadata: {
        source: 'business_card_scan',
        scanId,
        parsedData,
        leadCreated,
        duplicateOf: leadCreated ? null : leadId,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}
