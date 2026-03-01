#!/bin/bash
# ============================================================
# Network Speed Check - BioCycle Peptides Deploy Diagnostic
# Quick network health check before deploys/large operations
# Usage: ./scripts/network-check.sh [--full]
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

FULL_MODE=false
[[ "${1:-}" == "--full" ]] && FULL_MODE=true

echo ""
echo -e "${BOLD}${CYAN}══════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  Network Diagnostic - BioCycle Peptides  ${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════${NC}"
echo -e "  $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── 1. LATENCY ──────────────────────────────────────────────
echo -e "${BOLD}1. Latency (ping)${NC}"

test_ping() {
  local host=$1
  local label=$2
  local result
  result=$(ping -c 3 -t 5 "$host" 2>&1)
  local avg
  avg=$(echo "$result" | tail -1 | awk -F'/' '{print $5}')
  local loss
  loss=$(echo "$result" | grep "packet loss" | awk '{for(i=1;i<=NF;i++) if($i ~ /loss/) print $(i-1)}')

  if [[ -z "$avg" ]]; then
    echo -e "   ${RED}✗${NC} $label ($host): TIMEOUT"
    return 1
  fi

  local color=$GREEN
  local avg_int=${avg%.*}
  [[ $avg_int -gt 100 ]] && color=$YELLOW
  [[ $avg_int -gt 300 ]] && color=$RED

  echo -e "   ${color}●${NC} $label: ${BOLD}${avg}ms${NC} avg (${loss} loss)"
  return 0
}

test_ping "8.8.8.8" "Google DNS"
test_ping "biocyclepeptides.com" "Azure (prod)"
test_ping "github.com" "GitHub"

# ── 2. DNS RESOLUTION ──────────────────────────────────────
echo ""
echo -e "${BOLD}2. DNS Resolution${NC}"

test_dns() {
  local host=$1
  local start end elapsed
  start=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
  nslookup "$host" > /dev/null 2>&1
  end=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
  elapsed=$(( (end - start) / 1000000 ))

  local color=$GREEN
  [[ $elapsed -gt 200 ]] && color=$YELLOW
  [[ $elapsed -gt 1000 ]] && color=$RED

  echo -e "   ${color}●${NC} $host: ${BOLD}${elapsed}ms${NC}"
}

test_dns "biocyclepeptides.com"
test_dns "github.com"

# ── 3. DOWNLOAD SPEED ──────────────────────────────────────
echo ""
echo -e "${BOLD}3. Download Speed${NC}"

test_download() {
  local url=$1
  local label=$2
  local size_label=$3

  local start end elapsed
  start=$(python3 -c "import time; print(time.time())")

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}:%{size_download}:%{speed_download}" \
    --max-time 15 --connect-timeout 5 "$url" 2>/dev/null) || true

  end=$(python3 -c "import time; print(time.time())")

  local code size speed
  code=$(echo "$http_code" | cut -d: -f1)
  size=$(echo "$http_code" | cut -d: -f2)
  speed=$(echo "$http_code" | cut -d: -f3)

  if [[ "$code" == "000" ]] || [[ -z "$code" ]]; then
    echo -e "   ${RED}✗${NC} $label: TIMEOUT/ERREUR"
    return 1
  fi

  # Convert speed to Mbps
  local mbps
  mbps=$(python3 -c "print(f'{${speed:-0} * 8 / 1000000:.2f}')")

  local color=$GREEN
  local mbps_int=${mbps%.*}
  [[ $mbps_int -lt 10 ]] && color=$YELLOW
  [[ $mbps_int -lt 2 ]] && color=$RED

  local size_mb
  size_mb=$(python3 -c "print(f'{${size:-0} / 1048576:.1f}')")

  echo -e "   ${color}●${NC} $label ($size_label): ${BOLD}${mbps} Mbps${NC} (${size_mb} MB)"
}

# Small file test (quick)
test_download "https://speed.cloudflare.com/__down?bytes=1048576" "Cloudflare 1MB" "1 MB"

# Medium file test
test_download "https://speed.cloudflare.com/__down?bytes=10485760" "Cloudflare 10MB" "10 MB"

if $FULL_MODE; then
  # Large file test (only in full mode)
  test_download "https://speed.cloudflare.com/__down?bytes=104857600" "Cloudflare 100MB" "100 MB"
fi

# ── 4. UPLOAD SPEED (estimate via POST) ────────────────────
echo ""
echo -e "${BOLD}4. Upload Speed (estimate)${NC}"

# Generate 1MB of data and POST it
UPLOAD_RESULT=$(curl -s -o /dev/null -w "%{speed_upload}" \
  --max-time 15 --connect-timeout 5 \
  -X POST "https://speed.cloudflare.com/__up" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @<(dd if=/dev/zero bs=1048576 count=1 2>/dev/null) 2>/dev/null) || UPLOAD_RESULT="0"

UPLOAD_MBPS=$(python3 -c "print(f'{${UPLOAD_RESULT:-0} * 8 / 1000000:.2f}')")

UPLOAD_COLOR=$GREEN
UPLOAD_INT=${UPLOAD_MBPS%.*}
[[ $UPLOAD_INT -lt 5 ]] && UPLOAD_COLOR=$YELLOW
[[ $UPLOAD_INT -lt 1 ]] && UPLOAD_COLOR=$RED

echo -e "   ${UPLOAD_COLOR}●${NC} Upload 1MB: ${BOLD}${UPLOAD_MBPS} Mbps${NC}"

# ── 5. PRODUCTION ENDPOINTS ────────────────────────────────
echo ""
echo -e "${BOLD}5. Production Endpoints${NC}"

test_endpoint() {
  local url=$1
  local label=$2
  local result
  result=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" --max-time 10 "$url" 2>/dev/null) || result="000:0"

  local code time_s
  code=$(echo "$result" | cut -d: -f1)
  time_s=$(echo "$result" | cut -d: -f2)
  local time_ms
  time_ms=$(python3 -c "print(f'{${time_s:-0} * 1000:.0f}')")

  local color=$GREEN
  [[ "$code" != "200" ]] && color=$RED
  [[ $time_ms -gt 3000 ]] && color=$YELLOW

  echo -e "   ${color}●${NC} $label: HTTP ${BOLD}$code${NC} in ${time_ms}ms"
}

test_endpoint "https://biocyclepeptides.com/api/health" "Health API"
test_endpoint "https://biocyclepeptides.com" "Homepage"

if $FULL_MODE; then
  test_endpoint "https://biocyclepeptides.com/admin/media/connections" "Connections page"
  echo ""
  echo -e "${BOLD}6. GitHub API${NC}"
  test_endpoint "https://api.github.com/rate_limit" "GitHub API"
  test_endpoint "https://github.com/St3phaneM1chon/peptide-plus" "GitHub Repo"
fi

# ── SUMMARY ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}──────────────────────────────────────────${NC}"

# Determine overall verdict
DL_INT=${mbps%.*}
if [[ $DL_INT -ge 10 ]] && [[ $UPLOAD_INT -ge 5 ]]; then
  echo -e "${GREEN}${BOLD}  ✓ RESEAU OK${NC} — Deploy/push safe"
elif [[ $DL_INT -ge 2 ]] && [[ $UPLOAD_INT -ge 1 ]]; then
  echo -e "${YELLOW}${BOLD}  ⚠ RESEAU LENT${NC} — Deploy possible mais lent"
  echo -e "  Conseil: Eviter les gros pushes, verifier routeur"
else
  echo -e "${RED}${BOLD}  ✗ RESEAU INSUFFISANT${NC} — NE PAS deployer"
  echo -e "  Actions: Reset routeur, verifier WiFi, attendre"
fi

echo -e "${BOLD}${CYAN}──────────────────────────────────────────${NC}"
echo ""
