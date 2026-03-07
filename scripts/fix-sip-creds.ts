import { encryptToken, decryptToken } from '../src/lib/platform/crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasourceUrl: 'postgresql://peptide:peptide123@localhost:5433/peptide_plus' });

async function main() {
  const extensions = await prisma.sipExtension.findMany();

  for (const ext of extensions) {
    const decUser = decryptToken(ext.sipUsername);
    const decPass = decryptToken(ext.sipPassword);

    if (decUser && decPass) {
      console.log(ext.extension, ': already encrypted OK');
      continue;
    }

    // Plaintext — encrypt it
    const encUser = encryptToken(ext.sipUsername);
    const encPass = encryptToken(ext.sipPassword);

    if (!encUser || !encPass) {
      console.log(ext.extension, ': SKIP empty');
      continue;
    }

    await prisma.sipExtension.update({
      where: { id: ext.id },
      data: { sipUsername: encUser, sipPassword: encPass },
    });

    // Verify
    const vUser = decryptToken(encUser);
    const vPass = decryptToken(encPass);
    console.log(ext.extension, ': encrypted', vUser, '/', vPass ? 'OK' : 'FAIL');
  }

  await prisma.$disconnect();
}

main();
