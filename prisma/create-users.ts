/**
 * Script to create initial users for BioCycle Peptides
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/create-users.ts
 * Or: npx tsx prisma/create-users.ts
 */

import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Generate a unique referral code
function generateReferralCode(name: string): string {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${name.substring(0, 3).toUpperCase()}${random}`;
}

async function main() {
  console.log('👤 Creating users for BioCycle Peptides...\n');

  const password = 'St3ph@ne1234';
  const hashedPassword = await hash(password, 12);

  // 1. SUPERUSER (OWNER role)
  const superuser = await prisma.user.upsert({
    where: { email: 'superuser@biocyclepeptides.com' },
    update: {
      password: hashedPassword,
      role: UserRole.OWNER,
      emailVerified: new Date(),
    },
    create: {
      email: 'superuser@biocyclepeptides.com',
      name: 'Super User',
      password: hashedPassword,
      role: UserRole.OWNER,
      emailVerified: new Date(),
      locale: 'fr',
      timezone: 'America/Toronto',
      referralCode: generateReferralCode('superuser'),
      mfaEnabled: false,
    },
  });
  console.log(`✅ SUPERUSER created:
   - Email: superuser@biocyclepeptides.com
   - Password: St3ph@ne1234
   - Role: OWNER
   - ID: ${superuser.id}\n`);

  // 2. CLIENT (CLIENT role - business customer)
  const client = await prisma.user.upsert({
    where: { email: 'client@biocyclepeptides.com' },
    update: {
      password: hashedPassword,
      role: UserRole.CLIENT,
      emailVerified: new Date(),
    },
    create: {
      email: 'client@biocyclepeptides.com',
      name: 'Client Test',
      password: hashedPassword,
      role: UserRole.CLIENT,
      emailVerified: new Date(),
      locale: 'fr',
      timezone: 'America/Toronto',
      referralCode: generateReferralCode('client'),
      mfaEnabled: false,
      loyaltyPoints: 500,
      lifetimePoints: 1500,
      loyaltyTier: 'SILVER',
    },
  });
  console.log(`✅ CLIENT created:
   - Email: client@biocyclepeptides.com
   - Password: St3ph@ne1234
   - Role: CLIENT
   - ID: ${client.id}\n`);

  // 3. CUSTOMER (CUSTOMER role - regular customer)
  const customer = await prisma.user.upsert({
    where: { email: 'customer@biocyclepeptides.com' },
    update: {
      password: hashedPassword,
      role: UserRole.CUSTOMER,
      emailVerified: new Date(),
    },
    create: {
      email: 'customer@biocyclepeptides.com',
      name: 'Customer Test',
      password: hashedPassword,
      role: UserRole.CUSTOMER,
      emailVerified: new Date(),
      locale: 'fr',
      timezone: 'America/Toronto',
      referralCode: generateReferralCode('customer'),
      mfaEnabled: false,
      loyaltyPoints: 150,
      lifetimePoints: 350,
      loyaltyTier: 'BRONZE',
    },
  });
  console.log(`✅ CUSTOMER created:
   - Email: customer@biocyclepeptides.com
   - Password: St3ph@ne1234
   - Role: CUSTOMER
   - ID: ${customer.id}\n`);

  // Create sample addresses for customer
  await prisma.userAddress.upsert({
    where: { id: 'customer-shipping-address' },
    update: {},
    create: {
      id: 'customer-shipping-address',
      userId: customer.id,
      label: 'Livraison',
      isDefault: true,
      recipientName: 'Customer Test',
      addressLine1: '123 Rue Test',
      city: 'Montreal',
      state: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
      phone: '514-555-1234',
    },
  });

  await prisma.userAddress.upsert({
    where: { id: 'customer-billing-address' },
    update: {},
    create: {
      id: 'customer-billing-address',
      userId: customer.id,
      label: 'Facturation',
      isDefault: false,
      recipientName: 'Customer Test',
      addressLine1: '123 Rue Test',
      city: 'Montreal',
      state: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
      phone: '514-555-1234',
    },
  });

  console.log('📍 Sample addresses created for customer\n');

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    USERS CREATED SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n🔐 All users use password: St3ph@ne1234\n');
  console.log('┌─────────────┬──────────────────────────────────┬──────────┐');
  console.log('│ Username    │ Email                            │ Role     │');
  console.log('├─────────────┼──────────────────────────────────┼──────────┤');
  console.log('│ superuser   │ superuser@biocyclepeptides.com   │ OWNER    │');
  console.log('│ client      │ client@biocyclepeptides.com      │ CLIENT   │');
  console.log('│ customer    │ customer@biocyclepeptides.com    │ CUSTOMER │');
  console.log('└─────────────┴──────────────────────────────────┴──────────┘');
  console.log('\n✅ All users created successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error creating users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
