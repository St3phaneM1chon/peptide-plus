/**
 * CRM Local Presence - 3F.4
 *
 * Manages a pool of caller ID numbers to display local numbers
 * matching the lead's area code when making outbound calls.
 * This increases answer rates by showing a familiar local number.
 *
 * The caller ID pool is stored in a JSON config file.
 * In production, this would be backed by a database table or
 * integrated with Telnyx's number management API.
 */

import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CallerIdEntry {
  number: string;    // E.164 format: "+15145551234"
  areaCode: string;  // "514"
  region: string;    // "Montreal, QC"
  addedAt: string;   // ISO date
}

interface CallerIdPoolConfig {
  entries: CallerIdEntry[];
}

// ---------------------------------------------------------------------------
// Config file path
// ---------------------------------------------------------------------------

const CONFIG_DIR = process.env.NODE_ENV === 'production'
  ? '/tmp'
  : path.resolve(process.cwd(), 'data');

const CONFIG_PATH = path.join(CONFIG_DIR, 'caller-id-pool.json');

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function ensureConfigDir(): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  } catch {
    // Directory may already exist
  }
}

function readPool(): CallerIdPoolConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw) as CallerIdPoolConfig;
    }
  } catch (err) {
    logger.warn('Local presence: failed to read pool config, using defaults', {
      event: 'local_presence_config_error',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Default pool with common Canadian/US area codes
  return {
    entries: [
      { number: '+15145550100', areaCode: '514', region: 'Montreal, QC', addedAt: new Date().toISOString() },
      { number: '+14385550100', areaCode: '438', region: 'Montreal, QC', addedAt: new Date().toISOString() },
      { number: '+14505550100', areaCode: '450', region: 'South Shore, QC', addedAt: new Date().toISOString() },
      { number: '+14185550100', areaCode: '418', region: 'Quebec City, QC', addedAt: new Date().toISOString() },
      { number: '+18195550100', areaCode: '819', region: 'Sherbrooke, QC', addedAt: new Date().toISOString() },
      { number: '+16135550100', areaCode: '613', region: 'Ottawa, ON', addedAt: new Date().toISOString() },
      { number: '+14165550100', areaCode: '416', region: 'Toronto, ON', addedAt: new Date().toISOString() },
      { number: '+16475550100', areaCode: '647', region: 'Toronto, ON', addedAt: new Date().toISOString() },
      { number: '+17785550100', areaCode: '778', region: 'Vancouver, BC', addedAt: new Date().toISOString() },
      { number: '+14035550100', areaCode: '403', region: 'Calgary, AB', addedAt: new Date().toISOString() },
      { number: '+12125550100', areaCode: '212', region: 'New York, NY', addedAt: new Date().toISOString() },
      { number: '+13105550100', areaCode: '310', region: 'Los Angeles, CA', addedAt: new Date().toISOString() },
    ],
  };
}

function writePool(config: CallerIdPoolConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// extractAreaCode
// ---------------------------------------------------------------------------

/**
 * Extract the area code from a phone number.
 * Handles E.164 format (+1XXXXXXXXXX) and plain options.
 */
function extractAreaCode(phone: string): string | null {
  // Remove non-digit characters
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    // US/CA format: XXXXXXXXXX
    return digits.substring(0, 3);
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    // US/CA format with country code: 1XXXXXXXXXX
    return digits.substring(1, 4);
  }

  return null;
}

// ---------------------------------------------------------------------------
// getLocalCallerId
// ---------------------------------------------------------------------------

/**
 * Get a local caller ID number matching the lead's area code.
 *
 * Looks up the caller ID pool for a number with the same area code
 * as the lead's phone number. If no exact match is found, returns null
 * (the system should use the default/main caller ID).
 *
 * @param leadPhone - The lead's phone number (any format)
 * @returns A local caller ID number in E.164 format, or null if no match
 */
export async function getLocalCallerId(leadPhone: string): Promise<string | null> {
  const areaCode = extractAreaCode(leadPhone);

  if (!areaCode) {
    logger.debug('Local presence: could not extract area code', {
      event: 'local_presence_no_area_code',
      leadPhone,
    });
    return null;
  }

  const pool = readPool();

  // Find a matching caller ID
  const match = pool.entries.find((entry) => entry.areaCode === areaCode);

  if (match) {
    logger.debug('Local presence: matched caller ID', {
      event: 'local_presence_matched',
      leadAreaCode: areaCode,
      callerId: match.number,
      region: match.region,
    });
    return match.number;
  }

  // No match found - try matching first digit of area code (same region)
  const regionMatch = pool.entries.find(
    (entry) => entry.areaCode.charAt(0) === areaCode.charAt(0)
  );

  if (regionMatch) {
    logger.debug('Local presence: partial region match', {
      event: 'local_presence_partial_match',
      leadAreaCode: areaCode,
      matchedAreaCode: regionMatch.areaCode,
      callerId: regionMatch.number,
    });
    return regionMatch.number;
  }

  logger.debug('Local presence: no matching caller ID', {
    event: 'local_presence_no_match',
    leadAreaCode: areaCode,
  });

  return null;
}

// ---------------------------------------------------------------------------
// getCallerIdPool
// ---------------------------------------------------------------------------

/**
 * List all available caller ID numbers in the pool.
 *
 * @returns Array of caller ID entries with number, area code, and region
 */
export async function getCallerIdPool(): Promise<
  Array<{ number: string; areaCode: string; region: string }>
> {
  const pool = readPool();
  return pool.entries.map((entry) => ({
    number: entry.number,
    areaCode: entry.areaCode,
    region: entry.region,
  }));
}

// ---------------------------------------------------------------------------
// addCallerIdToPool
// ---------------------------------------------------------------------------

/**
 * Add a new caller ID number to the pool.
 *
 * @param number - Phone number in E.164 format
 * @param areaCode - The area code (e.g., "514")
 * @param region - Human-readable region description (e.g., "Montreal, QC")
 */
export async function addCallerIdToPool(
  number: string,
  areaCode: string,
  region: string
): Promise<void> {
  const pool = readPool();

  // Check for duplicates
  const existing = pool.entries.find((e) => e.number === number);
  if (existing) {
    logger.warn('Local presence: duplicate caller ID', {
      event: 'local_presence_duplicate',
      number,
      areaCode,
    });
    throw new Error(`Caller ID ${number} already exists in the pool`);
  }

  pool.entries.push({
    number,
    areaCode,
    region,
    addedAt: new Date().toISOString(),
  });

  writePool(pool);

  logger.info('Local presence: caller ID added to pool', {
    event: 'local_presence_added',
    number,
    areaCode,
    region,
    totalInPool: pool.entries.length,
  });
}
