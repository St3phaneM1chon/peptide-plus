/**
 * Sync SIP extensions to Azure DB
 * Encrypts credentials with the Azure ENCRYPTION_KEY and upserts into production DB.
 * Uses Prisma client with overridden DATABASE_URL.
 *
 * Usage: DATABASE_URL="postgresql://...azure..." ENCRYPTION_KEY="azure-key" node scripts/sync-sip-to-azure.js
 */
const crypto = require('crypto');

const AZURE_KEY_HEX = '12d7c0807c42d1612b6b704a1f7367dc8c9314d02be0bb0e2d3137ec35a12c37';
const AZURE_KEY = Buffer.from(AZURE_KEY_HEX, 'hex');

function encryptWithKey(plaintext, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

// SIP credentials (plaintext, decrypted from local DB)
const extensions = [
  {
    extension: '1001',
    sipUsername: 'gencredVG2dhewysAeL5M7evDApcI7IAjuRTe9yv8useRp7np',
    sipPassword: '269add9fc0904fe19e24ee376ebd83b6',
    sipDomain: 'sip.telnyx.com',
    userId: 'cmksh6e4m001ff6x4h5tf5ukn',
  },
  {
    extension: '1002',
    sipUsername: 'gencredoFlyopVRvYH6peL1cYCjTJzIOIXfqB1ynaGqGnKTBV',
    sipPassword: 'c5e5336b5c044021866288657bfd23f9',
    sipDomain: 'sip.telnyx.com',
    userId: 'cmkt1zp8f00dsnvfrsj8lwnar',
  },
  {
    extension: '1003',
    sipUsername: 'gencredcburoAENSnVNn6zyne0MUbGtVq2o4gxU2ggOTScDm7',
    sipPassword: '95eaca8dcc17493abbe0a851a886ac3d',
    sipDomain: 'sip.telnyx.com',
    userId: 'cmkud90bb0000fjkv243ec127',
  },
  {
    extension: '1004',
    sipUsername: 'gencrednuyPw3tg9y2Ra978VYp9BSItET1W37af5WjYJ2Rqx9',
    sipPassword: '7a76f293e91043d69b48441febdce103',
    sipDomain: 'sip.telnyx.com',
    userId: 'cmln12ze00000b7g9t4b5ghvf',
  },
  {
    extension: '1005',
    sipUsername: 'gencredmHxAT4gMp86NmIQD6meKFfROPojOA4Db1wZAz3WLuP',
    sipPassword: 'd711d62774bd4fa3b04882ac67664957',
    sipDomain: 'sip.telnyx.com',
    userId: 'usr_b42701a750afa6a21f56a38c9bd7ab73',
  },
];

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  // Check existing extensions
  const existing = await prisma.sipExtension.findMany({
    select: { extension: true, userId: true, status: true }
  });
  console.log(`Existing extensions: ${existing.length}`);
  existing.forEach(e => console.log(`  ${e.extension} → ${e.userId} (${e.status})`));

  // Check users exist
  const userIds = extensions.map(e => e.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, role: true }
  });
  console.log(`\nUsers found: ${users.length}/${userIds.length}`);
  users.forEach(u => console.log(`  ${u.id} → ${u.email} (${u.role})`));

  const foundUserIds = new Set(users.map(u => u.id));

  // Check VoipConnection
  const voipConns = await prisma.voipConnection.findMany({
    select: { id: true, provider: true }
  });
  console.log(`\nVoipConnections: ${voipConns.length}`);
  voipConns.forEach(v => console.log(`  ${v.provider} (${v.id})`));

  // Upsert extensions (only for users that exist in Azure DB)
  console.log('\n=== Upserting SIP Extensions ===');
  for (const ext of extensions) {
    if (!foundUserIds.has(ext.userId)) {
      console.log(`SKIP: ${ext.extension} → user ${ext.userId} does not exist in Azure DB`);
      continue;
    }

    const encUsername = encryptWithKey(ext.sipUsername, AZURE_KEY);
    const encPassword = encryptWithKey(ext.sipPassword, AZURE_KEY);

    try {
      await prisma.sipExtension.upsert({
        where: { extension: ext.extension },
        update: {
          sipUsername: encUsername,
          sipPassword: encPassword,
          sipDomain: ext.sipDomain,
          userId: ext.userId,
          updatedAt: new Date(),
        },
        create: {
          extension: ext.extension,
          sipUsername: encUsername,
          sipPassword: encPassword,
          sipDomain: ext.sipDomain,
          userId: ext.userId,
          status: 'ONLINE',
        },
      });
      console.log(`OK: ${ext.extension} → ${ext.userId}`);
    } catch (e) {
      console.error(`FAIL: ${ext.extension} → ${e.message}`);
    }
  }

  // Final check
  const final = await prisma.sipExtension.findMany({
    select: { extension: true, sipDomain: true, userId: true, status: true },
    orderBy: { extension: 'asc' }
  });
  console.log('\n=== Final state ===');
  final.forEach(r => console.log(`  ${r.extension} | ${r.sipDomain} | ${r.userId} | ${r.status}`));

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
