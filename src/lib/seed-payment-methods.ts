/**
 * SEED PAYMENT METHODS
 * Script to populate default payment method configurations
 */

import { PrismaClient } from '@prisma/client';
import { DEFAULT_PAYMENT_METHODS } from './payment-methods';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

export async function seedPaymentMethods() {
  logger.info('Starting payment methods seed...');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const country of DEFAULT_PAYMENT_METHODS) {
    logger.info('Processing country', { countryName: country.countryName, countryCode: country.countryCode });

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
            logger.info('Updated payment method', { methodType: method.methodType });
            updated++;
          } else {
            logger.info('Skipped payment method (already exists)', { methodType: method.methodType });
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
          logger.info('Created payment method', { methodType: method.methodType });
          created++;
        }
      } catch (error) {
        logger.error('Error processing payment method', { methodType: method.methodType, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  logger.info('Payment Methods Seed Summary', { created, updated, skipped, total: created + updated + skipped });
}

// Run if executed directly
if (require.main === module) {
  seedPaymentMethods()
    .catch((error) => {
      logger.error('Seed failed', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
