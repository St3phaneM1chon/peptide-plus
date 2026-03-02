#!/bin/bash
# =============================================================================
# Phase 2b: mod_json_cdr + Post-Call Survey Lua Script
# BioCycle Peptides - VoIP Integration
#
# Configures:
#   1. mod_json_cdr: POST CDR data to peptide-plus API after each call
#   2. Post-call survey: Lua script for DTMF satisfaction rating
#
# Run as root: sudo bash 04-configure-cdr-webhook.sh
# =============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────
APP_URL="${APP_URL:-https://biocyclepeptides.com}"
CDR_WEBHOOK_SECRET="${CDR_WEBHOOK_SECRET:-}"
PBX_DOMAIN="${PBX_DOMAIN:-pbx.biocyclepeptides.com}"

if [ -z "$CDR_WEBHOOK_SECRET" ]; then
  echo "ERROR: Set CDR_WEBHOOK_SECRET (must match VOIP_CDR_WEBHOOK_SECRET in peptide-plus .env)"
  echo "Generate one: openssl rand -hex 32"
  exit 1
fi

CDR_ENDPOINT="$APP_URL/api/admin/voip/cdr/ingest"
SURVEY_ENDPOINT="$APP_URL/api/admin/voip/surveys/submit"

echo "============================================"
echo " CDR Webhook + Survey Configuration"
echo " CDR endpoint:    $CDR_ENDPOINT"
echo " Survey endpoint: $SURVEY_ENDPOINT"
echo "============================================"

# ── Step 1: Configure mod_json_cdr ───────────────────────
echo "[1/4] Configuring mod_json_cdr..."

# Enable the module
FS_MODULES="/etc/freeswitch/autoload_configs/modules.conf.xml"
if ! grep -q "mod_json_cdr" "$FS_MODULES"; then
  sed -i '/<\/modules>/i \    <load module="mod_json_cdr"/>' "$FS_MODULES"
  echo "  mod_json_cdr added to modules.conf.xml"
fi

# Configure mod_json_cdr to POST to our API
cat > /etc/freeswitch/autoload_configs/json_cdr.conf.xml <<EOF
<configuration name="json_cdr.conf" description="JSON CDR">
  <settings>
    <!-- POST CDR to peptide-plus API -->
    <param name="url" value="$CDR_ENDPOINT"/>

    <!-- Authentication header -->
    <param name="auth-scheme" value="basic"/>
    <param name="cred" value="Bearer:$CDR_WEBHOOK_SECRET"/>

    <!-- What to include in CDR -->
    <param name="encode-values" value="true"/>
    <param name="log-b-leg" value="true"/>
    <param name="prefix-a-leg" value="true"/>

    <!-- HTTP settings -->
    <param name="encode" value="true"/>
    <param name="retries" value="3"/>
    <param name="delay" value="5000"/>
    <param name="log-http-and-disk" value="false"/>
    <param name="log-dir" value="/var/log/freeswitch/json_cdr"/>
    <param name="err-log-dir" value="/var/log/freeswitch/json_cdr_err"/>

    <!-- Disable disk logging when HTTP succeeds -->
    <param name="disable-100-continue" value="true"/>
  </settings>
</configuration>
EOF

mkdir -p /var/log/freeswitch/json_cdr /var/log/freeswitch/json_cdr_err

echo "  mod_json_cdr configured -> $CDR_ENDPOINT"

# ── Step 2: Create post-call survey Lua script ───────────
echo "[2/4] Creating post-call survey Lua script..."

SCRIPTS_DIR="/usr/share/freeswitch/scripts"
mkdir -p "$SCRIPTS_DIR"

cat > "$SCRIPTS_DIR/post_call_survey.lua" <<'LUA_EOF'
--[[
  Post-Call Satisfaction Survey
  BioCycle Peptides - VoIP Integration

  Plays a prompt asking caller to rate service 1-5 via DTMF.
  POSTs result to peptide-plus API.

  Usage in dialplan:
    <action application="lua" data="post_call_survey.lua"/>
]]

-- Configuration
local SURVEY_URL = os.getenv("SURVEY_ENDPOINT") or "SURVEY_ENDPOINT_PLACEHOLDER"
local CDR_SECRET = os.getenv("CDR_WEBHOOK_SECRET") or "CDR_SECRET_PLACEHOLDER"

-- Get call info
local uuid = session:getVariable("uuid")
local caller_number = session:getVariable("caller_id_number") or "unknown"
local called_number = session:getVariable("destination_number") or "unknown"
local agent_ext = session:getVariable("last_bridge_to") or session:getVariable("dialed_user") or ""

-- Only proceed if call was answered and session is active
if not session:ready() then
  freeswitch.consoleLog("INFO", "[Survey] Session not ready, skipping survey for " .. uuid .. "\n")
  return
end

-- Answer if not already
session:answer()
session:sleep(500)

-- Play survey prompt
-- "Sur une echelle de 1 a 5, comment evaluez-vous le service recu?"
local prompt = "custom/fr/sondage.wav"
if not session:ready() then return end

session:streamFile(prompt)
session:sleep(300)

-- Collect single DTMF digit (1-5), timeout 10 seconds
local digits = session:playAndGetDigits(
  1,        -- min digits
  1,        -- max digits
  3,        -- max tries
  10000,    -- timeout ms
  "#",      -- terminators
  prompt,   -- file to play
  "ivr/ivr-that_was_an_invalid_entry.wav",  -- invalid sound
  "[1-5]"   -- digit regex (only 1-5 valid)
)

if not digits or digits == "" then
  freeswitch.consoleLog("INFO", "[Survey] No response for call " .. uuid .. "\n")
  session:streamFile("voicemail/vm-goodbye.wav")
  return
end

local score = tonumber(digits) or 0
freeswitch.consoleLog("INFO", "[Survey] Call " .. uuid .. " scored " .. score .. "/5\n")

-- Thank the caller
session:streamFile("ivr/ivr-thank_you.wav")
session:sleep(300)
session:streamFile("voicemail/vm-goodbye.wav")

-- POST result to peptide-plus API
local api = freeswitch.API()
local post_data = string.format(
  '{"pbxUuid":"%s","callerNumber":"%s","calledNumber":"%s","agentExtension":"%s","overallScore":%d,"method":"dtmf"}',
  uuid, caller_number, called_number, agent_ext, score
)

-- Use curl via system command (mod_curl alternative)
local curl_cmd = string.format(
  'curl -s -X POST "%s" -H "Content-Type: application/json" -H "Authorization: Bearer %s" -d \'%s\'',
  SURVEY_URL, CDR_SECRET, post_data
)

local result = api:executeString("system " .. curl_cmd)
freeswitch.consoleLog("INFO", "[Survey] POST result: " .. (result or "nil") .. "\n")
LUA_EOF

# Replace placeholders with actual values
sed -i "s|SURVEY_ENDPOINT_PLACEHOLDER|$SURVEY_ENDPOINT|" "$SCRIPTS_DIR/post_call_survey.lua"
sed -i "s|CDR_SECRET_PLACEHOLDER|$CDR_WEBHOOK_SECRET|" "$SCRIPTS_DIR/post_call_survey.lua"

echo "  Lua survey script created at $SCRIPTS_DIR/post_call_survey.lua"

# ── Step 3: Add survey to dialplan (post-hangup) ────────
echo "[3/4] Adding survey trigger to dialplan..."

DIALPLAN_DIR="/etc/freeswitch/dialplan/default"

cat > "$DIALPLAN_DIR/90-post-call-survey.xml" <<'EOF'
<include>
  <!-- Post-call survey: transfer caller to survey after agent hangup -->
  <extension name="post-call-survey-trigger" continue="true">
    <condition field="destination_number" expression="^(9999)$">
      <!-- Survey extension: called via transfer after agent hangup -->
      <action application="answer"/>
      <action application="lua" data="post_call_survey.lua"/>
      <action application="hangup"/>
    </condition>
  </extension>
</include>
EOF

echo "  Survey dialplan: transfer to 9999 after call to trigger survey"
echo "  To enable: in queue/extension config, set 'transfer_after_bridge=9999'"

# ── Step 4: Create recording upload cron ─────────────────
echo "[4/4] Creating recording upload cron..."

# Cron script to trigger peptide-plus recording upload
cat > /usr/local/bin/voip-cron-recordings.sh <<EOF
#!/bin/bash
# Trigger peptide-plus cron to upload pending recordings
curl -s -X POST "$APP_URL/api/cron/voip-recordings" \
  -H "Authorization: Bearer \$(cat /etc/freeswitch/cron-secret.txt)" \
  -H "Content-Type: application/json" \
  > /dev/null 2>&1
EOF

cat > /usr/local/bin/voip-cron-transcriptions.sh <<EOF
#!/bin/bash
# Trigger peptide-plus cron to transcribe recordings
curl -s -X POST "$APP_URL/api/cron/voip-transcriptions" \
  -H "Authorization: Bearer \$(cat /etc/freeswitch/cron-secret.txt)" \
  -H "Content-Type: application/json" \
  > /dev/null 2>&1
EOF

cat > /usr/local/bin/voip-cron-notifications.sh <<EOF
#!/bin/bash
# Trigger peptide-plus cron for missed call/voicemail notifications
curl -s -X POST "$APP_URL/api/cron/voip-notifications" \
  -H "Authorization: Bearer \$(cat /etc/freeswitch/cron-secret.txt)" \
  -H "Content-Type: application/json" \
  > /dev/null 2>&1
EOF

chmod +x /usr/local/bin/voip-cron-*.sh

# Add to crontab
(crontab -l 2>/dev/null | grep -v voip-cron; cat <<CRON
# VoIP cron jobs - BioCycle Peptides
*/15 * * * * /usr/local/bin/voip-cron-recordings.sh
*/30 * * * * /usr/local/bin/voip-cron-transcriptions.sh
*/10 * * * * /usr/local/bin/voip-cron-notifications.sh
CRON
) | crontab -

echo "  Cron jobs installed:"
echo "    - Recordings upload: every 15 min"
echo "    - Transcriptions:    every 30 min"
echo "    - Notifications:     every 10 min"

# ── Reload ───────────────────────────────────────────────
echo ""
echo "Reloading FreeSWITCH..."
fs_cli -x "reload mod_json_cdr" 2>/dev/null || true
fs_cli -x "reloadxml" 2>/dev/null || true

echo ""
echo "============================================"
echo " CDR + Survey Configuration Complete!"
echo "============================================"
echo ""
echo "CDR webhook:  $CDR_ENDPOINT"
echo "Survey API:   $SURVEY_ENDPOINT"
echo "Auth:         Bearer token (VOIP_CDR_WEBHOOK_SECRET)"
echo ""
echo "Test CDR:"
echo "  1. Make a test call between extensions"
echo "  2. Check: curl $APP_URL/api/admin/voip/call-logs"
echo "  3. Verify CDR appears in admin dashboard"
echo ""
echo "Test Survey:"
echo "  1. Transfer a call to ext 9999"
echo "  2. Listen to prompt, press 1-5"
echo "  3. Check: CallSurvey record in database"
echo ""
echo "Cron jobs: crontab -l | grep voip"
