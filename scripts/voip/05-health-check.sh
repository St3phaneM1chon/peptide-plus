#!/bin/bash
# =============================================================================
# VoIP Health Check - Quick diagnostic for the entire telephony stack
# Run on the PBX VM: sudo bash 05-health-check.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_URL="${APP_URL:-https://biocyclepeptides.com}"
PBX_DOMAIN="${PBX_DOMAIN:-pbx.biocyclepeptides.com}"
PASS=0
FAIL=0
WARN=0

check() {
  local name="$1" status="$2"
  if [ "$status" = "OK" ]; then
    echo -e "  ${GREEN}[OK]${NC} $name"
    PASS=$((PASS+1))
  elif [ "$status" = "WARN" ]; then
    echo -e "  ${YELLOW}[WARN]${NC} $name"
    WARN=$((WARN+1))
  else
    echo -e "  ${RED}[FAIL]${NC} $name"
    FAIL=$((FAIL+1))
  fi
}

echo "============================================"
echo " VoIP Health Check - $(date)"
echo "============================================"

# ── FreeSWITCH ──────────────────────────────────────────
echo ""
echo "--- FreeSWITCH ---"
if systemctl is-active --quiet freeswitch; then
  check "FreeSWITCH service" "OK"
else
  check "FreeSWITCH service" "FAIL"
fi

FS_STATUS=$(fs_cli -x "status" 2>/dev/null | head -1 || echo "")
if echo "$FS_STATUS" | grep -qi "UP"; then
  check "FreeSWITCH status: $FS_STATUS" "OK"
else
  check "FreeSWITCH status: $FS_STATUS" "FAIL"
fi

SOFIA=$(fs_cli -x "sofia status" 2>/dev/null || echo "")
if echo "$SOFIA" | grep -q "RUNNING"; then
  check "Sofia SIP module running" "OK"
else
  check "Sofia SIP module" "FAIL"
fi

# ── SIP Gateways ────────────────────────────────────────
echo ""
echo "--- SIP Gateways ---"
TELNYX_STATUS=$(fs_cli -x "sofia status gateway telnyx" 2>/dev/null || echo "NOT FOUND")
if echo "$TELNYX_STATUS" | grep -qi "REGED"; then
  check "Telnyx gateway: REGISTERED" "OK"
elif echo "$TELNYX_STATUS" | grep -qi "NOREG\|TRYING"; then
  check "Telnyx gateway: $TELNYX_STATUS" "WARN"
else
  check "Telnyx gateway: $TELNYX_STATUS" "FAIL"
fi

VOIPMS_STATUS=$(fs_cli -x "sofia status gateway voipms" 2>/dev/null || echo "NOT CONFIGURED")
if echo "$VOIPMS_STATUS" | grep -qi "REGED"; then
  check "VoIP.ms gateway: REGISTERED" "OK"
elif echo "$VOIPMS_STATUS" | grep -qi "NOT CONFIGURED\|NOT FOUND"; then
  check "VoIP.ms gateway: not configured (optional)" "WARN"
else
  check "VoIP.ms gateway: $VOIPMS_STATUS" "FAIL"
fi

# ── Extensions ──────────────────────────────────────────
echo ""
echo "--- Extensions ---"
REG_COUNT=$(fs_cli -x "show registrations" 2>/dev/null | grep -c "^" || echo "0")
REG_COUNT=$((REG_COUNT - 2)) # subtract header/footer
if [ "$REG_COUNT" -gt 0 ]; then
  check "$REG_COUNT extensions registered" "OK"
else
  check "No extensions registered" "WARN"
fi

# ── Networking ──────────────────────────────────────────
echo ""
echo "--- Networking ---"
if ss -tlnp | grep -q ":5060"; then
  check "SIP port 5060 listening" "OK"
else
  check "SIP port 5060" "FAIL"
fi

if ss -tlnp | grep -q ":5080"; then
  check "SIP external port 5080 listening" "OK"
else
  check "SIP external port 5080" "WARN"
fi

if ss -tlnp | grep -q ":7443\|:8082"; then
  check "WSS port (7443/8082) listening" "OK"
else
  check "WSS port for WebRTC" "FAIL"
fi

if ss -tlnp | grep -q ":443"; then
  check "HTTPS port 443 (nginx)" "OK"
else
  check "HTTPS port 443" "FAIL"
fi

# ── TLS Certificates ────────────────────────────────────
echo ""
echo "--- TLS ---"
CERT_FILE="/etc/letsencrypt/live/$PBX_DOMAIN/fullchain.pem"
if [ -f "$CERT_FILE" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
  EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo "0")
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

  if [ "$DAYS_LEFT" -gt 30 ]; then
    check "TLS cert valid ($DAYS_LEFT days left)" "OK"
  elif [ "$DAYS_LEFT" -gt 0 ]; then
    check "TLS cert expiring soon ($DAYS_LEFT days!)" "WARN"
  else
    check "TLS cert EXPIRED" "FAIL"
  fi
else
  check "TLS certificate not found" "FAIL"
fi

# ── CDR Webhook ─────────────────────────────────────────
echo ""
echo "--- CDR Integration ---"
CDR_ERRORS=$(ls /var/log/freeswitch/json_cdr_err/ 2>/dev/null | wc -l)
if [ "$CDR_ERRORS" -eq 0 ]; then
  check "No CDR webhook errors" "OK"
else
  check "$CDR_ERRORS CDR webhook errors in queue" "WARN"
fi

# ── peptide-plus API ────────────────────────────────────
echo ""
echo "--- peptide-plus API ---"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/health" 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ]; then
  check "peptide-plus API reachable ($API_STATUS)" "OK"
elif [ "$API_STATUS" = "000" ]; then
  check "peptide-plus API unreachable (network?)" "FAIL"
else
  check "peptide-plus API: HTTP $API_STATUS" "WARN"
fi

# ── Disk Space ──────────────────────────────────────────
echo ""
echo "--- System ---"
DISK_USED=$(df / --output=pcent | tail -1 | tr -d ' %')
if [ "$DISK_USED" -lt 80 ]; then
  check "Disk usage: ${DISK_USED}%" "OK"
elif [ "$DISK_USED" -lt 90 ]; then
  check "Disk usage: ${DISK_USED}% (getting full)" "WARN"
else
  check "Disk usage: ${DISK_USED}% CRITICAL" "FAIL"
fi

RECORDING_SIZE=$(du -sh /var/lib/freeswitch/recordings/ 2>/dev/null | cut -f1 || echo "N/A")
echo "  Recordings storage: $RECORDING_SIZE"

# ── Summary ─────────────────────────────────────────────
echo ""
echo "============================================"
TOTAL=$((PASS+FAIL+WARN))
echo -e "  ${GREEN}PASS: $PASS${NC} | ${RED}FAIL: $FAIL${NC} | ${YELLOW}WARN: $WARN${NC} | Total: $TOTAL"
echo "============================================"

exit $FAIL
