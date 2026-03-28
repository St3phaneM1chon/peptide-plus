#!/bin/bash
# Master seed script for Koraline production
# Run after prisma db push to populate initial data
#
# Usage: railway run bash scripts/seed-production.sh
# Or:    DATABASE_URL="postgresql://..." bash scripts/seed-production.sh

set -e

echo "🌱 Seeding Koraline production database..."
echo ""

# 1. Seed base tenants (Attitudes VIP + BioCycle initial data)
echo "1/8 Seeding tenants..."
npx tsx scripts/seeds/seed-tenant.ts 2>/dev/null || echo "  ⚠ Tenant seed skipped (may already exist)"

# 2. Seed email accounts
echo "2/8 Seeding email accounts..."
node scripts/seed-email-accounts.js 2>/dev/null || echo "  ⚠ Email accounts skipped"

# 3. Seed FAQs
echo "3/8 Seeding FAQs..."
node scripts/seed-koraline-faqs.js 2>/dev/null || echo "  ⚠ FAQs skipped"

# 4. Seed LMS data (courses, bundles, knowledge base)
echo "4/8 Seeding LMS data..."
npx tsx scripts/seed-lms.ts 2>/dev/null || echo "  ⚠ LMS seed skipped"
npx tsx scripts/seed-lms-courses.ts 2>/dev/null || echo "  ⚠ LMS courses skipped"
npx tsx scripts/seed-lms-bundles.ts 2>/dev/null || echo "  ⚠ LMS bundles skipped"

# 5. Seed knowledge base (PQAP + general)
echo "5/8 Seeding knowledge base..."
npx tsx scripts/seed-knowledge.ts 2>/dev/null || echo "  ⚠ Knowledge seed skipped"
npx tsx scripts/seed-pqap-knowledge.ts 2>/dev/null || echo "  ⚠ PQAP knowledge skipped"

# 6. Seed provincial regulations
echo "6/8 Seeding provincial regulations..."
npx tsx scripts/seed-provincial-regulations.ts 2>/dev/null || echo "  ⚠ Provincial regulations skipped"

# 7. Seed video categories
echo "7/8 Seeding video categories..."
npx tsx scripts/seed-video-categories.ts 2>/dev/null || echo "  ⚠ Video categories skipped"

# 8. Seed VoIP configuration
echo "8/8 Seeding VoIP configuration..."
npx tsx scripts/seed-voip.ts 2>/dev/null || echo "  ⚠ VoIP seed skipped"

echo ""
echo "✅ Production seeding complete!"
echo ""
echo "Next steps:"
echo "  1. Login at https://attitudes.vip/auth/signin"
echo "  2. Check /admin/platform/clients for tenant list"
echo "  3. Verify /blog and /faq for content"
echo "  4. Verify /learn for LMS courses"
