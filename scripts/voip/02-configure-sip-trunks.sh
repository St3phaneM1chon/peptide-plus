#!/bin/bash
# =============================================================================
# Phase 1: SIP Trunk Configuration - Telnyx (primary) + VoIP.ms (backup)
# BioCycle Peptides - VoIP Integration
#
# Run AFTER 01-install-fusionpbx.sh
# Run as root: sudo bash 02-configure-sip-trunks.sh
# =============================================================================

set -euo pipefail

PBX_DOMAIN="${PBX_DOMAIN:-pbx.biocyclepeptides.com}"

echo "============================================"
echo " SIP Trunk Configuration"
echo "============================================"

# ── Step 1: Telnyx SIP Trunk Gateway ─────────────────────
echo "[1/6] Creating Telnyx gateway..."

# Telnyx SIP credentials (set these before running)
TELNYX_USERNAME="${TELNYX_SIP_USERNAME:-}"
TELNYX_PASSWORD="${TELNYX_SIP_PASSWORD:-}"
TELNYX_PROXY="sip.telnyx.com"

if [ -z "$TELNYX_USERNAME" ]; then
  echo "ERROR: Set TELNYX_SIP_USERNAME and TELNYX_SIP_PASSWORD env vars first."
  echo "Get these from: Telnyx Portal > SIP Trunking > Credentials"
  echo ""
  echo "Example:"
  echo "  export TELNYX_SIP_USERNAME='your_username'"
  echo "  export TELNYX_SIP_PASSWORD='your_password'"
  echo "  export TELNYX_DID_CA='+15145551234'"
  exit 1
fi

# Create gateway XML in FreeSWITCH
GATEWAY_DIR="/etc/freeswitch/sip_profiles/external"
mkdir -p "$GATEWAY_DIR"

cat > "$GATEWAY_DIR/telnyx.xml" <<EOF
<include>
  <gateway name="telnyx">
    <param name="username" value="$TELNYX_USERNAME"/>
    <param name="password" value="$TELNYX_PASSWORD"/>
    <param name="realm" value="$TELNYX_PROXY"/>
    <param name="proxy" value="$TELNYX_PROXY"/>
    <param name="register" value="true"/>
    <param name="register-transport" value="tls"/>
    <param name="caller-id-in-from" value="true"/>
    <param name="retry-seconds" value="30"/>
    <param name="ping" value="25"/>
    <param name="ping-max" value="3"/>
    <param name="ping-min" value="1"/>
    <!-- Codec preference: Opus for HD, G.711 fallback -->
    <param name="codec-prefs" value="OPUS,PCMU,PCMA"/>
  </gateway>
</include>
EOF

echo "  Telnyx gateway XML created"

# ── Step 2: VoIP.ms Backup Gateway ──────────────────────
echo "[2/6] Creating VoIP.ms backup gateway..."

VOIPMS_USERNAME="${VOIPMS_SIP_USERNAME:-}"
VOIPMS_PASSWORD="${VOIPMS_SIP_PASSWORD:-}"
VOIPMS_PROXY="${VOIPMS_SERVER:-montreal1.voip.ms}"

if [ -n "$VOIPMS_USERNAME" ]; then
  cat > "$GATEWAY_DIR/voipms.xml" <<EOF
<include>
  <gateway name="voipms">
    <param name="username" value="$VOIPMS_USERNAME"/>
    <param name="password" value="$VOIPMS_PASSWORD"/>
    <param name="realm" value="$VOIPMS_PROXY"/>
    <param name="proxy" value="$VOIPMS_PROXY"/>
    <param name="register" value="true"/>
    <param name="caller-id-in-from" value="true"/>
    <param name="retry-seconds" value="30"/>
    <param name="ping" value="25"/>
    <param name="codec-prefs" value="PCMU,PCMA,G729"/>
  </gateway>
</include>
EOF
  echo "  VoIP.ms gateway XML created"
else
  echo "  VoIP.ms skipped (set VOIPMS_SIP_USERNAME to configure)"
fi

# ── Step 3: Inbound route (DID -> IVR or extension) ──────
echo "[3/6] Creating inbound route..."

TELNYX_DID_CA="${TELNYX_DID_CA:-}"

if [ -n "$TELNYX_DID_CA" ]; then
  # Strip + prefix for dialplan matching
  DID_STRIPPED="${TELNYX_DID_CA#+}"

  DIALPLAN_DIR="/etc/freeswitch/dialplan/public"
  mkdir -p "$DIALPLAN_DIR"

  cat > "$DIALPLAN_DIR/01-inbound-telnyx.xml" <<EOF
<include>
  <!-- Inbound from Telnyx: route DID $TELNYX_DID_CA to IVR -->
  <extension name="telnyx-inbound-$DID_STRIPPED">
    <condition field="destination_number" expression="^\\+?($DID_STRIPPED)\$">
      <!-- Transfer to IVR "accueil" (create in FusionPBX GUI) -->
      <!-- For initial testing, ring extension 1001 directly -->
      <action application="set" data="domain_name=$PBX_DOMAIN"/>
      <action application="set" data="domain_uuid=\${domain_uuid}"/>
      <!-- Recording consent announcement -->
      <action application="playback" data="ivr/ivr-recording_notification.wav"/>
      <action application="set" data="record_session=true"/>
      <!-- Route to extension 1001 for initial testing -->
      <action application="transfer" data="1001 XML \${domain_name}"/>
    </condition>
  </extension>
</include>
EOF
  echo "  Inbound route: $TELNYX_DID_CA -> extension 1001 (test)"
else
  echo "  Inbound route skipped (set TELNYX_DID_CA)"
fi

# ── Step 4: Outbound route (extensions -> PSTN via Telnyx) ──
echo "[4/6] Creating outbound route..."

DIALPLAN_DIR="/etc/freeswitch/dialplan/default"

cat > "$DIALPLAN_DIR/99-outbound-telnyx.xml" <<'EOF'
<include>
  <!-- Outbound calls: 10/11 digit North America via Telnyx -->
  <extension name="outbound-telnyx-na" continue="false">
    <condition field="destination_number" expression="^1?(\d{10})$">
      <action application="set" data="effective_caller_id_number=${outbound_caller_id_number}"/>
      <action application="set" data="effective_caller_id_name=${outbound_caller_id_name}"/>
      <action application="bridge" data="{absolute_codec_string=PCMU,PCMA}sofia/gateway/telnyx/+1$1"/>
    </condition>
  </extension>

  <!-- International calls via Telnyx (011 prefix) -->
  <extension name="outbound-telnyx-intl" continue="false">
    <condition field="destination_number" expression="^011(\d+)$">
      <action application="bridge" data="sofia/gateway/telnyx/+$1"/>
    </condition>
  </extension>

  <!-- E.164 format (+1xxx, +44xxx, etc.) -->
  <extension name="outbound-telnyx-e164" continue="false">
    <condition field="destination_number" expression="^(\+\d+)$">
      <action application="bridge" data="sofia/gateway/telnyx/$1"/>
    </condition>
  </extension>
</include>
EOF

echo "  Outbound routes: NA (10/11 digit) + International + E.164"

# ── Step 5: Apply configuration ──────────────────────────
echo "[5/6] Reloading FreeSWITCH..."

# Reload gateways
fs_cli -x "sofia profile external restart" 2>/dev/null || true
fs_cli -x "reloadxml" 2>/dev/null || true

sleep 3

# ── Step 6: Verify ───────────────────────────────────────
echo "[6/6] Verifying gateway status..."

echo ""
echo "--- Gateway Status ---"
fs_cli -x "sofia status" 2>/dev/null || echo "(fs_cli not available, check manually)"
echo ""

if [ -n "$TELNYX_USERNAME" ]; then
  echo "--- Telnyx Gateway ---"
  fs_cli -x "sofia status gateway telnyx" 2>/dev/null || true
fi

if [ -n "$VOIPMS_USERNAME" ]; then
  echo "--- VoIP.ms Gateway ---"
  fs_cli -x "sofia status gateway voipms" 2>/dev/null || true
fi

echo ""
echo "============================================"
echo " SIP Trunk Configuration Complete!"
echo "============================================"
echo ""
echo "Test inbound:  Call $TELNYX_DID_CA from a mobile"
echo "Test outbound: From ext 1001, dial a mobile number"
echo ""
echo "Telnyx dashboard: https://portal.telnyx.com"
echo "VoIP.ms panel:    https://voip.ms/m/manage.php"
echo ""
echo "Next: ./03-configure-ivr.sh"
