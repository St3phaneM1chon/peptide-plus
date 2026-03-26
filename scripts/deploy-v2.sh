#!/bin/bash
# V2 Mega Audit — Deploy Script
# Run this after the V2 session to deploy to Railway/Azure
#
# Usage: bash scripts/deploy-v2.sh
#
# This script:
# 1. Validates the build
# 2. Syncs schema to production DB
# 3. Imports PQAP content (optional)
# 4. Pushes to Git (triggers CI/CD)

set -e

echo "=== V2 Deploy Script ==="
echo ""

# Step 1: Validate
echo "Step 1: Validating..."
npx prisma validate
npx prisma generate
NODE_OPTIONS='--max-old-space-size=8192' npm run build
echo "✅ Build passed"
echo ""

# Step 2: Schema sync (requires DATABASE_URL for production)
echo "Step 2: Schema sync"
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set — skipping schema push"
  echo "    Run: DATABASE_URL=<prod_url> npx prisma db push"
else
  echo "Pushing schema to production..."
  npx prisma db push --accept-data-loss=false
  echo "✅ Schema synced"
fi
echo ""

# Step 3: Optional content import
echo "Step 3: Content import (optional)"
echo "  To import PQAP manual content:"
echo "    psql \$DATABASE_URL < scripts/pqap-content-seed.sql"
echo "  To import exam questions:"
echo "    psql \$DATABASE_URL < scripts/pqap-questions-seed.sql"
echo ""

# Step 4: Git push
echo "Step 4: Git status"
git status --short
echo ""
echo "Ready to push. Run:"
echo "  git push origin main"
echo ""
echo "=== V2 Deploy Script Complete ==="
