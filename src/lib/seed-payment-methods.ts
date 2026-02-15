/**
 * SEED PAYMENT METHODS
 * Script to populate default payment method configurations
 */

import { PrismaClient } from '@prisma/client';
import { DEFAULT_PAYMENT_METHODS } from './payment-methods';

const prisma = new PrismaClient();

export async function seedPaymentMethods() {
  console.log('Starting payment methods seed...');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const country of DEFAULT_PAYMENT_METHODS) {
    console.log(`\nProcessing ${country.countryName} (${country.countryCode})...`);

    for (const method of country.methods) {
      try {
        // Check if configuration already exists
        const existing = await prisma.paymentMethodConfig.findUnique({
          where: {
            countryCode_methodType: {
              countryCode: country.countryCode,
              methodType: method.methodType,
            },
          },
        });

        if (existing) {
          // Update if inactive or configuration has changed
          if (!existing.isActive || existing.sortOrder !== method.sortOrder) {
            await prisma.paymentMethodConfig.update({
              where: { id: existing.id },
              data: {
                provider: method.provider,
                isActive: true,
                sortOrder: method.sortOrder,
                minAmount: method.minAmount || null,
                maxAmount: method.maxAmount || null,
              },
            });
            console.log(`  ✓ Updated: ${method.methodType}`);
            updated++;
          } else {
            console.log(`  - Skipped: ${method.methodType} (already exists)`);
            skipped++;
          }
        } else {
          // Create new configuration
          await prisma.paymentMethodConfig.create({
            data: {
              countryCode: country.countryCode,
              methodType: method.methodType,
              provider: method.provider,
              isActive: true,
              sortOrder: method.sortOrder,
              minAmount: method.minAmount || null,
              maxAmount: method.maxAmount || null,
            },
          });
          console.log(`  + Created: ${method.methodType}`);
          created++;
        }
      } catch (error) {
        console.error(`  ✗ Error processing ${method.methodType}:`, error);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Payment Methods Seed Summary:');
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total: ${created + updated + skipped}`);
  console.log('='.repeat(50) + '\n');
}

// Run if executed directly
if (require.main === module) {
  seedPaymentMethods()
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
