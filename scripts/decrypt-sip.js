const crypto = require('crypto');
const key = Buffer.from('5e026d8da381ef846e678307c45720124befced167792a792ac7ce1e361a0070', 'hex');

function decryptToken(enc) {
  if (!enc) return null;
  try {
    const data = Buffer.from(enc, 'base64');
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const ct = data.subarray(32);
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    d.setAuthTag(authTag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf-8');
  } catch (e) {
    return 'DECRYPT_FAIL: ' + e.message;
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.sipExtension.findMany({
  select: { extension: true, sipUsername: true, sipPassword: true, sipDomain: true, userId: true }
}).then(exts => {
  console.log('=== SIP Extensions (decrypted) ===');
  exts.forEach(e => {
    console.log(JSON.stringify({
      extension: e.extension,
      sipUsername: decryptToken(e.sipUsername),
      sipPassword: decryptToken(e.sipPassword),
      sipDomain: e.sipDomain,
      userId: e.userId
    }, null, 2));
  });
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
