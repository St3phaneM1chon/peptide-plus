/**
 * Migration Script: Convert legacy Wishlist to WishlistCollection + WishlistItem
 *
 * This script migrates data from the old flat Wishlist model to the new
 * hierarchical WishlistCollection + WishlistItem structure.
 *
 * Run with: npx tsx scripts/migrate-wishlist-to-collections.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateWishlists() {
  console.log('🚀 Starting wishlist migration...\n');

  try {
    // Get all legacy wishlist entries
    const legacyWishlists = await prisma.wishlist.findMany({
      orderBy: { userId: 'asc' },
    });

    console.log(`Found ${legacyWishlists.length} legacy wishlist entries`);

    if (legacyWishlists.length === 0) {
      console.log('✅ No legacy wishlist entries to migrate');
      return;
    }

    // Group by userId
    const wishlistsByUser = legacyWishlists.reduce((acc, item) => {
      if (!acc[item.userId]) {
        acc[item.userId] = [];
      }
      acc[item.userId].push(item);
      return acc;
    }, {} as Record<string, typeof legacyWishlists>);

    console.log(`Found ${Object.keys(wishlistsByUser).length} users with wishlists\n`);

    let migratedUsers = 0;
    let migratedItems = 0;
    let skippedUsers = 0;

    for (const [userId, items] of Object.entries(wishlistsByUser)) {
      console.log(`Processing user ${userId}...`);

      // Check if user already has a collection (to avoid duplicates)
      const existingCollection = await prisma.wishlistCollection.findFirst({
        where: { userId },
      });

      if (existingCollection) {
        console.log(`  ⚠️  User already has a wishlist collection, skipping`);
        skippedUsers++;
        continue;
      }

      // Create default wishlist collection for this user
      const collection = await prisma.wishlistCollection.create({
        data: {
          userId,
          name: 'My Wishlist',
          isDefault: true,
        },
      });

      console.log(`  ✓ Created wishlist collection: ${collection.id}`);

      // Migrate items
      for (const item of items) {
        try {
          await prisma.wishlistItem.create({
            data: {
              collectionId: collection.id,
              productId: item.productId,
              createdAt: item.createdAt,
            },
          });
          migratedItems++;
        } catch (error) {
          console.log(`  ⚠️  Failed to migrate item for product ${item.productId}: ${error}`);
        }
      }

      console.log(`  ✓ Migrated ${items.length} items`);
      migratedUsers++;
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  - Users migrated: ${migratedUsers}`);
    console.log(`  - Users skipped: ${skippedUsers}`);
    console.log(`  - Items migrated: ${migratedItems}`);
    console.log(`  - Legacy entries: ${legacyWishlists.length}`);

    // Ask if we should delete legacy data
    console.log('\n⚠️  Migration complete!');
    console.log('   Legacy Wishlist table still exists with original data.');
    console.log('   You can manually delete it after verifying the migration.');
    console.log('   To delete: DROP TABLE "Wishlist";');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateWishlists()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
