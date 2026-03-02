#!/bin/bash
# =============================================================================
# Phase 4: IVR + Queues + Time Conditions + Recording
# BioCycle Peptides - VoIP Integration
#
# This script creates FreeSWITCH dialplan XML for:
#   - IVR "Accueil" (FR/EN bilingual menu)
#   - Time conditions (business hours: Mon-Fri 9h-17h ET)
#   - Call center queues (Support, Ventes)
#   - Global call recording
#   - Voicemail-to-email
#
# NOTE: Most IVR/queue config is better done via FusionPBX GUI.
# This script provides the XML templates for reference/automation.
#
# Run as root: sudo bash 03-configure-ivr.sh
# =============================================================================

set -euo pipefail

PBX_DOMAIN="${PBX_DOMAIN:-pbx.biocyclepeptides.com}"
RECORDINGS_DIR="/var/lib/freeswitch/recordings"
SOUNDS_DIR="/usr/share/freeswitch/sounds/custom"

echo "============================================"
echo " IVR + Queues + Time Conditions"
echo "============================================"

# ── Step 1: Create custom sounds directory ───────────────
echo "[1/7] Setting up custom sounds..."

mkdir -p "$SOUNDS_DIR/fr" "$SOUNDS_DIR/en"

# Generate TTS prompts if piper-tts is available, otherwise create placeholders
cat > "$SOUNDS_DIR/prompts.txt" <<'PROMPTS'
# French Prompts (record these or generate with TTS)
fr/accueil.wav        = "Bienvenue chez BioCycle Peptides. Pour le support technique, appuyez 1. Pour la facturation, appuyez 2. Pour les informations générales, appuyez 3. Pour parler à un opérateur, appuyez 0."
fr/heures-fermees.wav = "Nos bureaux sont actuellement fermés. Nos heures d'ouverture sont du lundi au vendredi, de 9 heures à 17 heures, heure de l'Est. Veuillez laisser un message après le bip."
fr/enregistrement.wav = "Cet appel peut être enregistré à des fins de qualité et de formation."
fr/attente.wav        = "Veuillez patienter, un agent sera avec vous sous peu."
fr/sondage.wav        = "Avant de raccrocher, sur une échelle de 1 à 5, comment évaluez-vous le service reçu aujourd'hui?"

# English Prompts
en/welcome.wav        = "Welcome to BioCycle Peptides. For technical support, press 1. For billing, press 2. For general information, press 3. To speak with an operator, press 0."
en/after-hours.wav    = "Our offices are currently closed. Business hours are Monday through Friday, 9 AM to 5 PM Eastern Time. Please leave a message after the tone."
en/recording.wav      = "This call may be recorded for quality and training purposes."
en/hold.wav           = "Please hold, an agent will be with you shortly."
en/survey.wav         = "Before you hang up, on a scale of 1 to 5, how would you rate the service you received today?"
PROMPTS

echo "  Prompt list created at $SOUNDS_DIR/prompts.txt"
echo "  Record these WAV files (16kHz mono PCM) or use TTS"

# ── Step 2: IVR Dialplan - Main Menu (Accueil) ──────────
echo "[2/7] Creating IVR dialplan..."

DIALPLAN_DIR="/etc/freeswitch/dialplan/default"
mkdir -p "$DIALPLAN_DIR"

cat > "$DIALPLAN_DIR/10-ivr-accueil.xml" <<'EOF'
<include>
  <!-- IVR Accueil BioCycle Peptides -->
  <extension name="ivr-accueil">
    <condition field="destination_number" expression="^(5000)$">
      <!-- Recording consent announcement -->
      <action application="answer"/>
      <action application="sleep" data="500"/>
      <action application="set" data="record_session=true"/>

      <!-- Detect language preference (future: press 9 for English) -->
      <action application="set" data="default_language=fr"/>

      <!-- Play IVR menu with DTMF collection -->
      <action application="ivr" data="ivr-biocycle-accueil"/>
    </condition>
  </extension>
</include>
EOF

# IVR definition
cat > "/etc/freeswitch/ivr_menus/ivr-biocycle-accueil.xml" <<EOF
<include>
  <menus>
    <menu name="ivr-biocycle-accueil"
          greet-long="custom/fr/accueil.wav"
          greet-short="custom/fr/accueil.wav"
          invalid-sound="ivr/ivr-that_was_an_invalid_entry.wav"
          exit-sound="voicemail/vm-goodbye.wav"
          timeout="10000"
          inter-digit-timeout="2000"
          max-failures="3"
          max-timeouts="3"
          digit-len="1">

      <!-- 1 = Support technique -> Queue Support -->
      <entry action="menu-exec-app"
             digits="1"
             param="transfer 5001 XML $PBX_DOMAIN"/>

      <!-- 2 = Facturation -> Queue Ventes/Facturation -->
      <entry action="menu-exec-app"
             digits="2"
             param="transfer 5002 XML $PBX_DOMAIN"/>

      <!-- 3 = Info generale -> Ring group bureau -->
      <entry action="menu-exec-app"
             digits="3"
             param="transfer 5003 XML $PBX_DOMAIN"/>

      <!-- 0 = Operateur -> Extension 1001 (reception) -->
      <entry action="menu-exec-app"
             digits="0"
             param="transfer 1001 XML $PBX_DOMAIN"/>

      <!-- 9 = English menu (future) -->
      <entry action="menu-exec-app"
             digits="9"
             param="transfer 5000 XML $PBX_DOMAIN"/>

      <!-- * = Repeat menu -->
      <entry action="menu-top"
             digits="*"/>
    </menu>
  </menus>
</include>
EOF

echo "  IVR 'Accueil' created (ext 5000)"

# ── Step 3: Call Center Queues ───────────────────────────
echo "[3/7] Creating call center queues..."

cat > "$DIALPLAN_DIR/11-queue-support.xml" <<'EOF'
<include>
  <!-- Queue: Support Technique -->
  <extension name="queue-support">
    <condition field="destination_number" expression="^(5001)$">
      <action application="answer"/>
      <action application="playback" data="custom/fr/attente.wav"/>
      <action application="set" data="fifo_music=local_stream://moh"/>
      <action application="set" data="fifo_orbit_exten=1001:30"/>
      <!-- FIFO queue: round-robin to support agents -->
      <action application="fifo" data="support@${domain_name} in"/>
    </condition>
  </extension>
</include>
EOF

cat > "$DIALPLAN_DIR/12-queue-ventes.xml" <<'EOF'
<include>
  <!-- Queue: Ventes / Facturation -->
  <extension name="queue-ventes">
    <condition field="destination_number" expression="^(5002)$">
      <action application="answer"/>
      <action application="playback" data="custom/fr/attente.wav"/>
      <action application="set" data="fifo_music=local_stream://moh"/>
      <action application="set" data="fifo_orbit_exten=1001:45"/>
      <action application="fifo" data="ventes@${domain_name} in"/>
    </condition>
  </extension>
</include>
EOF

cat > "$DIALPLAN_DIR/13-queue-info.xml" <<'EOF'
<include>
  <!-- Queue: Information generale (ring group) -->
  <extension name="ring-group-info">
    <condition field="destination_number" expression="^(5003)$">
      <action application="answer"/>
      <action application="set" data="call_timeout=30"/>
      <action application="set" data="continue_on_fail=true"/>
      <!-- Ring all office extensions simultaneously -->
      <action application="bridge" data="user/1001@${domain_name},user/1002@${domain_name},user/1003@${domain_name}"/>
      <!-- If no answer, go to voicemail -->
      <action application="transfer" data="1001 XML ${domain_name}" />
    </condition>
  </extension>
</include>
EOF

echo "  Queue 'Support' (5001), 'Ventes' (5002), Ring Group 'Info' (5003)"

# ── Step 4: Time Conditions ──────────────────────────────
echo "[4/7] Creating time conditions..."

# Wrap the inbound route with time condition
cat > "/etc/freeswitch/dialplan/public/00-time-condition.xml" <<EOF
<include>
  <!-- Time Condition: Business Hours Mon-Fri 9:00-17:00 ET -->
  <extension name="time-condition-business-hours" continue="true">
    <condition wday="2-6" time-of-day="09:00-17:00" break="on-false">
      <!-- Business hours: set flag -->
      <action application="set" data="business_hours=true"/>
      <anti-action application="set" data="business_hours=false"/>
    </condition>
  </extension>

  <!-- Route based on business hours -->
  <extension name="inbound-with-hours">
    <condition field="destination_number" expression="^\\+?1?\\d{10}\$">
      <condition field="\${business_hours}" expression="^true\$" break="on-false">
        <!-- During business hours -> IVR Accueil -->
        <action application="transfer" data="5000 XML $PBX_DOMAIN"/>
        <!-- After hours -> Voicemail message + voicemail -->
        <anti-action application="answer"/>
        <anti-action application="playback" data="custom/fr/heures-fermees.wav"/>
        <anti-action application="sleep" data="1000"/>
        <anti-action application="voicemail" data="default \${domain_name} 1001"/>
      </condition>
    </condition>
  </extension>
</include>
EOF

echo "  Time condition: Mon-Fri 9h-17h ET -> IVR | After hours -> Voicemail"

# ── Step 5: Global Call Recording ────────────────────────
echo "[5/7] Enabling global call recording..."

mkdir -p "$RECORDINGS_DIR"
chown -R www-data:www-data "$RECORDINGS_DIR"

cat > "$DIALPLAN_DIR/05-global-recording.xml" <<'EOF'
<include>
  <!-- Global call recording for all inbound/outbound calls -->
  <extension name="global-recording" continue="true">
    <condition field="destination_number" expression=".*">
      <condition field="${record_session}" expression="^true$" break="on-false">
        <action application="set" data="RECORD_STEREO=true"/>
        <action application="set" data="recording_follow_transfer=true"/>
        <action application="set" data="record_path=/var/lib/freeswitch/recordings/${domain_name}/archive/${strftime(%Y/%b/%d)}"/>
        <action application="set" data="record_name=${uuid}.wav"/>
        <action application="set" data="record_append=true"/>
        <action application="record_session" data="${record_path}/${record_name}"/>
      </condition>
    </condition>
  </extension>
</include>
EOF

echo "  Recording: stereo WAV, organized by date in $RECORDINGS_DIR"

# ── Step 6: Voicemail-to-Email ───────────────────────────
echo "[6/7] Configuring voicemail-to-email..."

# This is configured per-extension in FusionPBX GUI
# Here we ensure the voicemail module settings are correct
VM_CONF="/etc/freeswitch/autoload_configs/voicemail.conf.xml"
if [ -f "$VM_CONF" ]; then
  echo "  Voicemail config exists. Configure per-extension in FusionPBX:"
  echo "    Extensions > Edit > Voicemail > Email Address"
  echo "    Enable: Voicemail Enabled = true"
  echo "    Enable: Voicemail File = attach"
  echo "    Enable: Voicemail Keep Local After Email = true"
fi

# ── Step 7: Reload ───────────────────────────────────────
echo "[7/7] Reloading FreeSWITCH configuration..."

fs_cli -x "reloadxml" 2>/dev/null || true

echo ""
echo "============================================"
echo " IVR + Queues Configuration Complete!"
echo "============================================"
echo ""
echo "IVR Accueil:      ext 5000 (auto-routed from inbound)"
echo "Queue Support:    ext 5001 (DTMF 1)"
echo "Queue Ventes:     ext 5002 (DTMF 2)"
echo "Ring Group Info:  ext 5003 (DTMF 3)"
echo "Operator:         ext 1001 (DTMF 0)"
echo ""
echo "Business hours:   Mon-Fri 9:00-17:00 ET"
echo "After hours:      Message + Voicemail (ext 1001)"
echo ""
echo "Recording:        Global (stereo WAV) in $RECORDINGS_DIR"
echo ""
echo "TODO:"
echo "  1. Record custom WAV prompts (see $SOUNDS_DIR/prompts.txt)"
echo "  2. Add agents to FIFO queues in FusionPBX"
echo "  3. Configure voicemail email per extension in FusionPBX GUI"
echo "  4. Test: call DID -> IVR -> press 1 -> agent phone rings"
echo ""
echo "Next: ./04-configure-cdr-webhook.sh"
