#!/bin/bash
# =============================================================
# verify-azure-deploy.sh - Post-deploy verification script
# Run after every Azure deployment to verify files are complete
# =============================================================

set -e

RESOURCE_GROUP="biocycle-peptides-prod"
APP_NAME="biocyclepeptides"
SITE_URL="https://biocyclepeptides.com"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STANDALONE_DIR="${SCRIPT_DIR}/.next/standalone"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  Azure Deploy Verification"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# Get Kudu credentials
CREDS=$(az webapp deployment list-publishing-credentials \
  --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --query "{user:publishingUserName, pass:publishingPassword}" --output json 2>/dev/null)
KUDU_USER=$(echo "$CREDS" | python3 -c "import json,sys; print(json.load(sys.stdin)['user'])")
KUDU_PASS=$(echo "$CREDS" | python3 -c "import json,sys; print(json.load(sys.stdin)['pass'])")
KUDU_URL="https://${APP_NAME}.scm.azurewebsites.net/api/command"

kudu_cmd() {
  curl -s -u "${KUDU_USER}:${KUDU_PASS}" "$KUDU_URL" \
    -H "Content-Type: application/json" \
    -d "{\"command\":\"bash -c \\\"$1\\\"\",\"dir\":\"/home\"}" 2>/dev/null \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('Output','').strip())" 2>/dev/null
}

ERRORS=0

# ── 1. Site Health ──
echo "1. Site Health Check"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/" --max-time 30 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "   ${GREEN}✓${NC} Homepage: HTTP $HTTP_CODE"
else
  echo -e "   ${RED}✗${NC} Homepage: HTTP $HTTP_CODE"
  ERRORS=$((ERRORS + 1))
fi

API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SITE_URL}/api/products/search?limit=1" --max-time 15 2>/dev/null)
if [ "$API_CODE" = "200" ]; then
  echo -e "   ${GREEN}✓${NC} API Search: HTTP $API_CODE"
else
  echo -e "   ${RED}✗${NC} API Search: HTTP $API_CODE"
  ERRORS=$((ERRORS + 1))
fi

SHOP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SITE_URL}/shop" --max-time 15 2>/dev/null)
if [ "$SHOP_CODE" = "200" ]; then
  echo -e "   ${GREEN}✓${NC} Shop page: HTTP $SHOP_CODE"
else
  echo -e "   ${RED}✗${NC} Shop page: HTTP $SHOP_CODE"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ── 2. Critical Files ──
echo "2. Critical Files on Azure"
for FILE in server.js package.json .next/server/app .next/static; do
  EXISTS=$(kudu_cmd "test -e /home/site/wwwroot/$FILE && echo YES || echo NO")
  if [ "$EXISTS" = "YES" ]; then
    echo -e "   ${GREEN}✓${NC} $FILE"
  else
    echo -e "   ${RED}✗${NC} $FILE MISSING"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# ── 3. Directory Comparison ──
echo "3. File Count Comparison (Local vs Azure)"

# Local counts
LOCAL_SERVER=$(find "$STANDALONE_DIR/.next/server" -type f 2>/dev/null | wc -l | tr -d ' ')
LOCAL_STATIC=$(find "$STANDALONE_DIR/.next/static" -type f 2>/dev/null | wc -l | tr -d ' ')
LOCAL_PUBLIC=$(find "$STANDALONE_DIR/public" -type f 2>/dev/null | wc -l | tr -d ' ')
LOCAL_SRC=$(find "$STANDALONE_DIR/src" -type f 2>/dev/null | wc -l | tr -d ' ')
LOCAL_MODULES=$(find "$STANDALONE_DIR/node_modules" -type f 2>/dev/null | wc -l | tr -d ' ')

# Azure counts
AZURE_COUNTS=$(kudu_cmd "echo \$(find /home/site/wwwroot/.next/server -type f 2>/dev/null | wc -l) \$(find /home/site/wwwroot/.next/static -type f 2>/dev/null | wc -l) \$(find /home/site/wwwroot/public -type f 2>/dev/null | wc -l) \$(find /home/site/wwwroot/src -type f 2>/dev/null | wc -l) \$(find /home/site/wwwroot/node_modules -type f 2>/dev/null | wc -l)")
AZURE_SERVER=$(echo "$AZURE_COUNTS" | awk '{print $1}')
AZURE_STATIC=$(echo "$AZURE_COUNTS" | awk '{print $2}')
AZURE_PUBLIC=$(echo "$AZURE_COUNTS" | awk '{print $3}')
AZURE_SRC=$(echo "$AZURE_COUNTS" | awk '{print $4}')
AZURE_MODULES=$(echo "$AZURE_COUNTS" | awk '{print $5}')

compare() {
  local name=$1 local_count=$2 azure_count=$3
  if [ "$azure_count" -ge "$local_count" ] 2>/dev/null; then
    echo -e "   ${GREEN}✓${NC} $name: Local=$local_count Azure=$azure_count"
  else
    echo -e "   ${RED}✗${NC} $name: Local=$local_count Azure=$azure_count (${RED}MISSING FILES${NC})"
    ERRORS=$((ERRORS + 1))
  fi
}

compare ".next/server" "$LOCAL_SERVER" "$AZURE_SERVER"
compare ".next/static" "$LOCAL_STATIC" "$AZURE_STATIC"
compare "public"       "$LOCAL_PUBLIC"  "$AZURE_PUBLIC"
compare "src (locales)" "$LOCAL_SRC"   "$AZURE_SRC"
compare "node_modules" "$LOCAL_MODULES" "$AZURE_MODULES"
echo ""

# ── 4. Database Check ──
echo "4. Database Verification"
DB_URL=$(az webapp config appsettings list --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --output json 2>/dev/null \
  | python3 -c "import json,sys; data=json.load(sys.stdin); print(next((d['value'] for d in data if d['name']=='DATABASE_URL'),''))" 2>/dev/null)

if [ -n "$DB_URL" ]; then
  PROD_TABLES=$(PGPASSWORD='NewBioCycle2026Prod' psql "postgresql://biocycleadmin@biocyclepeptides-db.postgres.database.azure.com:5432/peptide_plus?sslmode=require" -t -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d ' ')
  LOCAL_TABLES=$(PGPASSWORD=peptide123 psql -h localhost -p 5433 -U peptide -d peptide_plus -t -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d ' ')

  if [ "$PROD_TABLES" -ge "$LOCAL_TABLES" ] 2>/dev/null; then
    echo -e "   ${GREEN}✓${NC} Tables: Local=$LOCAL_TABLES Azure=$PROD_TABLES"
  else
    echo -e "   ${RED}✗${NC} Tables: Local=$LOCAL_TABLES Azure=$PROD_TABLES (${RED}DRIFT${NC})"
    ERRORS=$((ERRORS + 1))
  fi

  PROD_PRODUCTS=$(PGPASSWORD='NewBioCycle2026Prod' psql "postgresql://biocycleadmin@biocyclepeptides-db.postgres.database.azure.com:5432/peptide_plus?sslmode=require" -t -c "SELECT count(*) FROM \"Product\";" 2>/dev/null | tr -d ' ')
  LOCAL_PRODUCTS=$(PGPASSWORD=peptide123 psql -h localhost -p 5433 -U peptide -d peptide_plus -t -c "SELECT count(*) FROM \"Product\";" 2>/dev/null | tr -d ' ')
  echo -e "   ${GREEN}✓${NC} Products: Local=$LOCAL_PRODUCTS Azure=$PROD_PRODUCTS"
else
  echo -e "   ${YELLOW}⚠${NC} Cannot read DATABASE_URL from Azure settings"
fi
echo ""

# ── Summary ──
echo "========================================"
if [ "$ERRORS" -eq 0 ]; then
  echo -e "  ${GREEN}ALL CHECKS PASSED${NC} (0 errors)"
else
  echo -e "  ${RED}$ERRORS ERROR(S) DETECTED${NC}"
fi
echo "========================================"

exit $ERRORS
