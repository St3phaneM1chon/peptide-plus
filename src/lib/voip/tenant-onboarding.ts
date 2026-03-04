/**
 * Tenant Onboarding — Self-Service VoIP Setup
 *
 * Flow:
 * 1. Create company (if not exists)
 * 2. Assign DID (phone number)
 * 3. Create default IVR menu
 * 4. Create default call queue
 * 5. Set up default voicemail
 *
 * Also provides brand provisioning for the 7 Attitudes VIP brands.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { BRAND_CONFIGS } from './tenant-context';

interface OnboardingResult {
  companyId: string;
  companySlug: string;
  phoneNumberAssigned?: string;
  ivrMenuId?: string;
  queueId?: string;
  steps: Array<{ step: string; status: 'ok' | 'skipped' | 'error'; detail?: string }>;
}

/**
 * Full onboarding for a new tenant.
 */
export async function onboardTenant(options: {
  ownerId: string;
  name: string;
  slug: string;
  contactEmail: string;
  phone?: string;
  assignDid?: string; // specific DID to assign
  brandKey?: string;  // pre-defined brand config
}): Promise<OnboardingResult> {
  const steps: OnboardingResult['steps'] = [];

  // Step 1: Create company
  let company = await prisma.company.findUnique({
    where: { slug: options.slug },
  });

  if (company) {
    steps.push({ step: 'create_company', status: 'skipped', detail: 'Already exists' });
  } else {
    company = await prisma.company.create({
      data: {
        name: options.name,
        slug: options.slug,
        contactEmail: options.contactEmail,
        phone: options.phone,
        ownerId: options.ownerId,
      },
    });
    steps.push({ step: 'create_company', status: 'ok' });
  }

  const companyId = company.id;
  const brandConfig = options.brandKey ? BRAND_CONFIGS[options.brandKey] : null;

  // Step 2: Assign DID
  let phoneNumberAssigned: string | undefined;
  if (options.assignDid) {
    try {
      await prisma.phoneNumber.updateMany({
        where: { number: options.assignDid, companyId: null },
        data: { companyId },
      });
      phoneNumberAssigned = options.assignDid;
      steps.push({ step: 'assign_did', status: 'ok', detail: options.assignDid });
    } catch {
      steps.push({ step: 'assign_did', status: 'error', detail: 'DID not available' });
    }
  } else {
    steps.push({ step: 'assign_did', status: 'skipped', detail: 'No DID specified' });
  }

  // Step 3: Default IVR menu
  let ivrMenuId: string | undefined;
  const existingIvr = await prisma.ivrMenu.findFirst({ where: { companyId } });
  if (existingIvr) {
    ivrMenuId = existingIvr.id;
    steps.push({ step: 'create_ivr', status: 'skipped', detail: 'Already has IVR' });
  } else {
    const ivr = await prisma.ivrMenu.create({
      data: {
        companyId,
        name: `${options.name} - Menu principal`,
        greetingText: `Bienvenue chez ${options.name}. Pour les ventes, appuyez 1. Pour le support, appuyez 2. Pour laisser un message, appuyez 0.`,
        timeoutSeconds: 10,
        maxRetries: 3,
        isActive: true,
        businessHoursStart: '09:00',
        businessHoursEnd: '17:00',
        businessDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        afterHoursAction: 'VOICEMAIL',
        options: {
          create: [
            { digit: '1', label: 'Ventes', action: 'QUEUE', targetId: 'sales' },
            { digit: '2', label: 'Support', action: 'QUEUE', targetId: 'support' },
            { digit: '0', label: 'Message vocal', action: 'VOICEMAIL' },
          ],
        },
      },
    });
    ivrMenuId = ivr.id;
    steps.push({ step: 'create_ivr', status: 'ok' });
  }

  // Step 4: Default queue
  let queueId: string | undefined;
  const existingQueue = await prisma.callQueue.findFirst({ where: { companyId } });
  if (existingQueue) {
    queueId = existingQueue.id;
    steps.push({ step: 'create_queue', status: 'skipped', detail: 'Already has queue' });
  } else {
    const queue = await prisma.callQueue.create({
      data: {
        companyId,
        name: 'General',
        strategy: 'RING_ALL',
        maxWaitSeconds: 120,
        announcePosition: true,
      },
    });
    queueId = queue.id;
    steps.push({ step: 'create_queue', status: 'ok' });
  }

  logger.info('[Onboarding] Tenant onboarded', {
    companyId,
    slug: options.slug,
    steps: steps.map(s => `${s.step}:${s.status}`).join(', '),
  });

  return {
    companyId,
    companySlug: options.slug,
    phoneNumberAssigned,
    ivrMenuId,
    queueId,
    steps,
  };
}

/**
 * Provision all 7 Attitudes VIP brands as tenants.
 * Requires the ownerUserId of the Attitudes VIP admin.
 */
export async function provisionAttitudesBrands(
  ownerUserId: string,
  contactEmail: string
): Promise<OnboardingResult[]> {
  const results: OnboardingResult[] = [];

  for (const [key, brand] of Object.entries(BRAND_CONFIGS)) {
    const result = await onboardTenant({
      ownerId: ownerUserId,
      name: brand.name,
      slug: brand.slug,
      contactEmail,
      brandKey: key,
    });
    results.push(result);
  }

  logger.info('[Onboarding] All Attitudes brands provisioned', {
    count: results.length,
    brands: results.map(r => r.companySlug),
  });

  return results;
}

/**
 * Get onboarding status for a tenant — what's configured, what's missing.
 */
export async function getOnboardingStatus(companyId: string): Promise<{
  companyId: string;
  checklist: Array<{ item: string; done: boolean; count?: number }>;
  completionPercent: number;
}> {
  const [phoneNumbers, ivrMenus, queues, extensions, campaigns] = await Promise.all([
    prisma.phoneNumber.count({ where: { companyId } }),
    prisma.ivrMenu.count({ where: { companyId, isActive: true } }),
    prisma.callQueue.count({ where: { companyId } }),
    prisma.sipExtension.count({ where: { companyId } }),
    prisma.dialerCampaign.count({ where: { companyId } }),
  ]);

  const checklist = [
    { item: 'Phone number assigned', done: phoneNumbers > 0, count: phoneNumbers },
    { item: 'IVR menu configured', done: ivrMenus > 0, count: ivrMenus },
    { item: 'Call queue created', done: queues > 0, count: queues },
    { item: 'SIP extensions set up', done: extensions > 0, count: extensions },
    { item: 'Dialer campaign created', done: campaigns > 0, count: campaigns },
  ];

  const done = checklist.filter(c => c.done).length;
  const completionPercent = Math.round((done / checklist.length) * 100);

  return { companyId, checklist, completionPercent };
}
