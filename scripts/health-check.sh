#!/bin/bash
# BioCycle Peptides - Health Check Script
# Usage: ./scripts/health-check.sh [url]

URL=${1:-http://localhost:3000}

echo "🏥 Health Check - BioCycle Peptides"
echo "===================================="
echo "URL: $URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_endpoint() {
  local path=$1
  local expected_status=${2:-200}
  local full_url="${URL}${path}"
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "$full_url" --max-time 10)
  
  if [ "$response" = "$expected_status" ]; then
    echo -e "${GREEN}✓${NC} $path (HTTP $response)"
    return 0
  else
    echo -e "${RED}✗${NC} $path (HTTP $response, expected $expected_status)"
    return 1
  fi
}

FAILED=0

echo "Public Pages:"
check_endpoint "/" || ((FAILED++))
check_endpoint "/shop" || ((FAILED++))
check_endpoint "/contact" || ((FAILED++))
check_endpoint "/faq" || ((FAILED++))

echo ""
echo "API Endpoints:"
check_endpoint "/api/products" || ((FAILED++))
check_endpoint "/api/auth/session" || ((FAILED++))

echo ""
echo "Static Files:"
check_endpoint "/robots.txt" || ((FAILED++))

echo ""
echo "Security Headers:"
headers=$(curl -sI "$URL" --max-time 10)

check_header() {
  local header=$1
  if echo "$headers" | grep -qi "$header"; then
    echo -e "${GREEN}✓${NC} $header"
    return 0
  else
    echo -e "${RED}✗${NC} $header missing"
    return 1
  fi
}

check_header "Strict-Transport-Security" || ((FAILED++))
check_header "X-Frame-Options" || ((FAILED++))
check_header "X-Content-Type-Options" || ((FAILED++))
check_header "Content-Security-Policy" || ((FAILED++))

echo ""
echo "===================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All checks passed! ✓${NC}"
  exit 0
else
  echo -e "${RED}$FAILED check(s) failed${NC}"
  exit 1
fi
