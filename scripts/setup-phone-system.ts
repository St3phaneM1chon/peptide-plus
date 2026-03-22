/**
 * Phone System Setup Script
 *
 * Seeds the database with IVR menus, phone number configurations,
 * and configures all Telnyx DIDs for production use.
 *
 * Usage:
 *   npx tsx scripts/setup-phone-system.ts
 *   npx tsx scripts/setup-phone-system.ts --dry-run
 *
 * This script is idempotent — safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PHONE_NUMBERS, IVR_MENUS, QUEUE_CONFIG, type IvrMenuConfig } from '../src/lib/voip/phone-system-config';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Attitudes VIP Phone System Setup           ║');
  console.log('║   IVR + Multi-DID + Voicemail + Multi-Lang   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

  // Step 1: Ensure company exists
  const company = await ensureCompany();

  // Step 2: Ensure VoIP connection exists
  const connection = await ensureVoipConnection();

  // Step 3: Create IVR menus
  const menuIdMap = await createIvrMenus(company.id);

  // Step 4: Resolve sub_menu targets (menus referencing other menus)
  await resolveSubMenuTargets(menuIdMap);

  // Step 5: Create/update call queues
  await ensureCallQueues(company.id);

  // Step 6: Configure phone numbers
  await configurePhoneNumbers(connection.id, menuIdMap);

  // Step 7: Ensure SIP extensions exist for staff
  await ensureExtensions(company.id);

  console.log('\n✅ Phone system setup complete!');
  console.log('\nNext steps:');
  console.log('  1. Set TELNYX_WEBHOOK_SECRET in .env');
  console.log('  2. Configure Telnyx webhook URL: https://attitudes.vip/api/voip/webhooks/telnyx');
  console.log('  3. Configure SMS webhook URL: https://attitudes.vip/api/webhooks/sms-inbound');
  console.log('  4. Test: Call +14388030370 → "Bienvenue chez Attitudes VIP"');
  console.log('  5. Press 1 → Stéphane rings | Press 2 → Caroline rings');
  console.log('  6. Press 4 → Stéphane rings (tech support)');
  console.log('  7. No answer opt 2 → Caroline voicemail (NOT Stéphane)');
}

async function ensureCompany(): Promise<{ id: string }> {
  console.log('📋 Step 1: Ensuring company exists...');

  const existing = await prisma.company.findFirst({
    where: { OR: [{ name: { contains: 'BioCycle' } }, { name: { contains: 'Attitudes' } }] },
    select: { id: true, name: true },
  });

  if (existing) {
    console.log(`  ✓ Company found: ${existing.name} (${existing.id})`);
    return existing;
  }

  // Company requires an owner — find an OWNER-role user
  const ownerUser = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    select: { id: true, name: true },
  });

  if (!ownerUser) {
    console.log('  ⚠ No OWNER user found. Skipping company creation.');
    console.log('  → IVR menus will be created without a company link.');
    return { id: '' };
  }

  if (isDryRun) {
    console.log(`  [DRY RUN] Would create company "Attitudes VIP Inc." (owner: ${ownerUser.name})`);
    return { id: 'dry-run-company-id' };
  }

  const company = await prisma.company.create({
    data: {
      name: 'Attitudes VIP Inc.',
      slug: 'attitudes-vip',
      contactEmail: 'info@attitudes.vip',
      ownerId: ownerUser.id,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  console.log(`  ✓ Company created: ${company.name} (${company.id})`);
  return company;
}

async function ensureVoipConnection(): Promise<{ id: string }> {
  console.log('📞 Step 2: Ensuring VoIP connection exists...');

  const existing = await prisma.voipConnection.findUnique({
    where: { provider: 'telnyx' },
    select: { id: true },
  });

  if (existing) {
    console.log(`  ✓ Telnyx connection found (${existing.id})`);
    return existing;
  }

  if (isDryRun) {
    console.log('  [DRY RUN] Would create Telnyx VoIP connection');
    return { id: 'dry-run-connection-id' };
  }

  const conn = await prisma.voipConnection.create({
    data: {
      provider: 'telnyx',
      isEnabled: true,
      accountSid: process.env.TELNYX_CONNECTION_ID || '2907808239930311884',
    },
    select: { id: true },
  });

  console.log(`  ✓ Telnyx connection created (${conn.id})`);
  return conn;
}

async function createIvrMenus(companyId: string): Promise<Map<string, string>> {
  console.log('🎛️  Step 3: Creating IVR menus...');

  const menuIdMap = new Map<string, string>();

  // First pass: upsert menus without afterHoursMenuId (to avoid FK issues)
  for (const menuConfig of IVR_MENUS) {
    const menuData = {
      companyId,
      name: menuConfig.name,
      description: menuConfig.description,
      greetingText: menuConfig.greetingText,
      language: menuConfig.language,
      timezone: menuConfig.timezone,
      businessHoursStart: menuConfig.businessHoursStart,
      businessHoursEnd: menuConfig.businessHoursEnd,
      inputTimeout: 7,
      maxRetries: 3,
      timeoutAction: menuConfig.timeoutAction,
      timeoutTarget: menuConfig.timeoutTarget,
      isActive: true,
    };

    const existing = await prisma.ivrMenu.findUnique({
      where: { companyId_name: { companyId, name: menuConfig.name } },
      select: { id: true },
    });

    if (isDryRun) {
      const fakeId = existing?.id || `dry-run-menu-${menuConfig.name.replace(/\s/g, '-').toLowerCase()}`;
      menuIdMap.set(menuConfig.name, fakeId);
      console.log(`  [DRY RUN] Would ${existing ? 'update' : 'create'} menu "${menuConfig.name}"`);
      continue;
    }

    let menuId: string;

    if (existing) {
      // Update existing menu with latest config
      await prisma.ivrMenu.update({
        where: { id: existing.id },
        data: menuData,
      });
      menuId = existing.id;
      console.log(`  ✓ Menu "${menuConfig.name}" updated (${menuId})`);
    } else {
      const menu = await prisma.ivrMenu.create({
        data: menuData,
        select: { id: true },
      });
      menuId = menu.id;
      console.log(`  ✓ Menu "${menuConfig.name}" created (${menuId})`);
    }

    menuIdMap.set(menuConfig.name, menuId);

    // Upsert menu options — delete old ones and recreate for clean state
    if (existing) {
      await prisma.ivrMenuOption.deleteMany({ where: { menuId } });
    }

    for (let i = 0; i < menuConfig.options.length; i++) {
      const opt = menuConfig.options[i];

      await prisma.ivrMenuOption.create({
        data: {
          menuId,
          digit: opt.digit,
          label: opt.label,
          action: opt.action,
          target: opt.target,
          announcement: opt.announcement,
          sortOrder: i,
        },
      });
    }

    console.log(`    └─ ${menuConfig.options.length} options ${existing ? 'updated' : 'created'}`);
  }

  // Second pass: link afterHoursMenuId
  for (const menuConfig of IVR_MENUS) {
    if (!menuConfig.afterHoursMenuName) continue;

    const menuId = menuIdMap.get(menuConfig.name);
    const afterHoursId = menuIdMap.get(menuConfig.afterHoursMenuName);

    if (menuId && afterHoursId && !isDryRun) {
      await prisma.ivrMenu.update({
        where: { id: menuId },
        data: { afterHoursMenuId: afterHoursId },
      });
      console.log(`  ↳ "${menuConfig.name}" → after hours: "${menuConfig.afterHoursMenuName}"`);
    }
  }

  return menuIdMap;
}

async function resolveSubMenuTargets(menuIdMap: Map<string, string>) {
  console.log('🔗 Step 4: Resolving sub_menu targets...');

  if (isDryRun) {
    console.log('  [DRY RUN] Would resolve sub_menu targets');
    return;
  }

  // Find all options with action='sub_menu' where target is a menu name
  const subMenuOptions = await prisma.ivrMenuOption.findMany({
    where: { action: 'sub_menu' },
  });

  for (const opt of subMenuOptions) {
    // If target is already a cuid, skip
    if (opt.target.length > 20) continue;

    const resolvedId = menuIdMap.get(opt.target);
    if (resolvedId) {
      await prisma.ivrMenuOption.update({
        where: { id: opt.id },
        data: { target: resolvedId },
      });
      console.log(`  ✓ Resolved "${opt.target}" → ${resolvedId}`);
    }
  }
}

async function ensureCallQueues(companyId: string) {
  console.log('📋 Step 5: Creating/updating call queues...');

  for (const [queueName, config] of Object.entries(QUEUE_CONFIG)) {
    const existing = await prisma.callQueue.findFirst({
      where: { companyId, name: queueName },
      select: { id: true },
    });

    const data = {
      companyId,
      name: queueName,
      strategy: config.strategy === 'ring_all' ? 'RING_ALL' as const : 'RING_ALL' as const,
      ringTimeout: config.ringTimeout,
      maxWaitTime: 120,
      wrapUpTime: 10,
      announcePosition: true,
      announceInterval: 30,
      overflowAction: 'voicemail',
      overflowTarget: config.overflowVoicemail,
      isActive: true,
    };

    if (isDryRun) {
      console.log(`  [DRY RUN] Would ${existing ? 'update' : 'create'} queue "${queueName}" → agents ${config.agents.join(', ')}`);
      continue;
    }

    let queueId: string;

    if (existing) {
      await prisma.callQueue.update({
        where: { id: existing.id },
        data,
      });
      queueId = existing.id;
      console.log(`  ✓ Queue "${queueName}" updated (${queueId})`);
    } else {
      const queue = await prisma.callQueue.create({
        data,
        select: { id: true },
      });
      queueId = queue.id;
      console.log(`  ✓ Queue "${queueName}" created (${queueId})`);
    }

    // Sync queue members — find users by extension
    for (const ext of config.agents) {
      const sipExt = await prisma.sipExtension.findFirst({
        where: { extension: ext },
        select: { userId: true },
      });

      if (!sipExt) {
        console.log(`    ⚠ Extension ${ext} not found, skipping member assignment`);
        continue;
      }

      const existingMember = await prisma.callQueueMember.findFirst({
        where: { queueId, userId: sipExt.userId },
      });

      if (!existingMember) {
        await prisma.callQueueMember.create({
          data: {
            queueId,
            userId: sipExt.userId,
            priority: 0,
            penalty: 0,
          },
        });
        console.log(`    ✓ Agent ext ${ext} added to "${queueName}"`);
      } else {
        console.log(`    ✓ Agent ext ${ext} already in "${queueName}"`);
      }
    }
  }

  // Clean up old queues that are no longer in config
  const oldQueueNames = ['general-queue', 'sales-queue', 'support-queue', 'billing-queue'];
  for (const oldName of oldQueueNames) {
    const old = await prisma.callQueue.findFirst({
      where: { name: oldName },
      select: { id: true },
    });
    if (old) {
      await prisma.callQueue.update({
        where: { id: old.id },
        data: { isActive: false },
      });
      console.log(`  ⚠ Deactivated old queue "${oldName}"`);
    }
  }
}

async function configurePhoneNumbers(connectionId: string, menuIdMap: Map<string, string>) {
  console.log('📱 Step 6: Configuring phone numbers...');

  for (const config of PHONE_NUMBERS) {
    const existing = await prisma.phoneNumber.findUnique({
      where: { number: config.number },
      select: { id: true },
    });

    // Resolve IVR menu ID
    let routeToIvr: string | null = null;
    if (config.routeToIvr) {
      routeToIvr = menuIdMap.get(config.routeToIvr) || null;
    }

    const data = {
      connectionId,
      number: config.number,
      displayName: config.displayName,
      country: config.country,
      type: config.type as 'LOCAL' | 'TOLL_FREE' | 'MOBILE',
      region: config.region,
      language: config.language,
      routeToIvr,
      forwardTo: config.forwardTo || null,
      isActive: true,
      monthlyCost: config.monthlyCost,
    };

    if (existing) {
      if (!isDryRun) {
        await prisma.phoneNumber.update({
          where: { id: existing.id },
          data,
        });
      }
      console.log(`  ✓ Updated ${config.number} (${config.displayName})`);
    } else {
      if (!isDryRun) {
        await prisma.phoneNumber.create({ data });
      }
      console.log(`  ✓ Created ${config.number} (${config.displayName})`);
    }

    const routing = config.forwardTo
      ? `FORWARD → ${config.forwardTo}`
      : config.routeToIvr
        ? `IVR: ${config.routeToIvr}`
        : 'DEFAULT';
    console.log(`    └─ ${config.region} | ${config.language} | ${routing}`);
  }
}

async function ensureExtensions(companyId: string) {
  console.log('👤 Step 7: Ensuring SIP extensions...');

  // Find owner/employee users
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ['OWNER', 'EMPLOYEE'] } },
    select: { id: true, name: true, email: true },
    take: 5,
  });

  if (staffUsers.length === 0) {
    console.log('  ⚠ No staff users found. Extensions will be created when staff is added.');
    return;
  }

  const extensions = ['1001', '1002', '1003', '1004', '1005'];

  for (let i = 0; i < staffUsers.length && i < extensions.length; i++) {
    const user = staffUsers[i];
    const extNum = extensions[i];

    const existingByUser = await prisma.sipExtension.findFirst({
      where: { userId: user.id },
      select: { id: true, extension: true },
    });

    if (existingByUser) {
      console.log(`  ✓ ${user.name || user.email} → ext ${existingByUser.extension}`);
      continue;
    }

    // Also check if extension number is already taken
    const existingByExt = await prisma.sipExtension.findFirst({
      where: { extension: extNum },
      select: { id: true },
    });

    if (existingByExt) {
      console.log(`  ⚠ Extension ${extNum} already assigned, skipping ${user.name || user.email}`);
      continue;
    }

    if (!isDryRun) {
      await prisma.sipExtension.create({
        data: {
          userId: user.id,
          extension: extNum,
          sipUsername: `ext${extNum}`,
          sipPassword: `AvExt${extNum}!${randomUUID().slice(0, 8)}`,
          sipDomain: 'sip.telnyx.com',
          isRegistered: false,
          status: 'OFFLINE',
          companyId,
        },
      });
    }

    console.log(`  ✓ ${user.name || user.email} → ext ${extNum} (created)`);
  }
}

// Run
main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Setup failed:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
