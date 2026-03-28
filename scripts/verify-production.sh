#!/bin/bash
# Verify Koraline production is working
# Usage: bash scripts/verify-production.sh [base_url]
# Example: bash scripts/verify-production.sh https://attitudes.vip

echo "🔍 Verifying Koraline production..."
echo ""

BASE_URL="${1:-https://attitudes.vip}"

pages=(
  "/" "/pricing" "/signup" "/auth/signin" "/demo" "/blog" "/faq"
  "/contact" "/a-propos" "/privacy" "/terms" "/securite"
  "/platform/features" "/platform/features/commerce"
  "/platform/integrations" "/platform/pour/ecommerce"
  "/platform/calculateur-roi" "/platform/comparer"
  "/changelog" "/status" "/robots.txt" "/sitemap.xml"
  "/api/health"
)

ok=0; fail=0
for url in "${pages[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL$url" 2>/dev/null)
  if [ "$code" = "200" ]; then
    ok=$((ok+1))
    echo "  ✅ $url → $code"
  else
    fail=$((fail+1))
    echo "  ❌ $url → $code"
  fi
done

echo ""
echo "Results: $ok OK, $fail FAIL out of ${#pages[@]} pages"
if [ "$fail" -eq 0 ]; then
  echo "✅ All pages working!"
else
  echo "⚠️  Some pages need attention"
fi
