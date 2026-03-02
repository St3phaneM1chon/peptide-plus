#!/bin/bash
# =============================================================================
# Phase 0: FusionPBX + FreeSWITCH Installation on Debian 12 ARM64 (UTM VM)
# BioCycle Peptides - VoIP Integration
#
# Prerequisites:
#   - UTM VM created: Debian 12 ARM64, 4 cores, 8GB RAM, 40GB disk
#   - Network: bridged adapter (VM gets its own IP on LAN)
#   - SSH access configured
#
# Run as root: sudo bash 01-install-fusionpbx.sh
# =============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────
PBX_DOMAIN="${PBX_DOMAIN:-pbx.biocyclepeptides.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@biocyclepeptides.com}"
TIMEZONE="America/Toronto"

echo "============================================"
echo " FusionPBX + FreeSWITCH Installer"
echo " Domain: $PBX_DOMAIN"
echo "============================================"

# ── Step 1: System prep ────────────────────────────────────
echo "[1/8] System update and prerequisites..."
apt-get update && apt-get upgrade -y
apt-get install -y \
  curl wget git sudo gnupg2 ca-certificates \
  lsb-release apt-transport-https software-properties-common \
  net-tools dnsutils htop tmux vim \
  certbot python3-certbot-nginx \
  fail2ban ufw

# Set timezone
timedatectl set-timezone "$TIMEZONE"

# ── Step 2: Install FreeSWITCH 20.x ───────────────────────
echo "[2/8] Installing FreeSWITCH..."

# SignalWire repo for FreeSWITCH packages
TOKEN="${SIGNALWIRE_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "WARNING: No SIGNALWIRE_TOKEN set. Using FusionPBX install script instead."
  echo "Get a free token at https://id.signalwire.com/personal_tokens"
fi

# Use the official FusionPBX install script (includes FreeSWITCH)
cd /usr/src
if [ ! -d "fusionpbx-install.sh" ]; then
  git clone https://github.com/fusionpbx/fusionpbx-install.sh.git
fi
cd fusionpbx-install.sh/debian

# Run the install (this installs FreeSWITCH + FusionPBX + nginx + PostgreSQL)
bash install.sh

echo "FusionPBX installed. Saving credentials..."

# The installer prints the database password and admin password
# They're also saved to /root/fusionpbx-install-credentials.txt
if [ -f /root/fusionpbx-install-credentials.txt ]; then
  echo "Credentials saved to /root/fusionpbx-install-credentials.txt"
  cat /root/fusionpbx-install-credentials.txt
fi

# ── Step 3: Configure TLS (Let's Encrypt) ─────────────────
echo "[3/8] Setting up TLS..."

# Stop nginx temporarily for certbot
systemctl stop nginx

certbot certonly --standalone \
  -d "$PBX_DOMAIN" \
  --email "$ADMIN_EMAIL" \
  --agree-tos \
  --non-interactive || {
  echo "Certbot failed. You may need to configure DNS first."
  echo "Manual: certbot certonly --standalone -d $PBX_DOMAIN"
}

# Link certs for FreeSWITCH
CERT_DIR="/etc/letsencrypt/live/$PBX_DOMAIN"
FS_CERT_DIR="/etc/freeswitch/tls"

if [ -d "$CERT_DIR" ]; then
  mkdir -p "$FS_CERT_DIR"
  cat "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem" > "$FS_CERT_DIR/wss.pem"
  cat "$CERT_DIR/fullchain.pem" > "$FS_CERT_DIR/cafile.pem"
  chown -R www-data:www-data "$FS_CERT_DIR"
  chmod 600 "$FS_CERT_DIR/wss.pem"
  echo "TLS certificates linked for FreeSWITCH WSS"
fi

# ── Step 4: Configure nginx reverse proxy for WSS ─────────
echo "[4/8] Configuring nginx for WSS..."

cat > /etc/nginx/sites-available/fusionpbx-wss <<EOF
# WebSocket Secure proxy for WebRTC softphone
server {
    listen 443 ssl http2;
    server_name $PBX_DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$PBX_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$PBX_DOMAIN/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # FusionPBX web UI
    location / {
        root /var/www/fusionpbx;
        index index.php;
        try_files \$uri \$uri/ =404;

        location ~ \.php\$ {
            fastcgi_pass unix:/var/run/php/php-fpm.sock;
            fastcgi_index index.php;
            include fastcgi_params;
            fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        }
    }

    # WebSocket proxy to FreeSWITCH mod_verto (port 8082 by default)
    location /ws {
        proxy_pass https://127.0.0.1:7443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

# HTTP redirect
server {
    listen 80;
    server_name $PBX_DOMAIN;
    return 301 https://\$server_name\$request_uri;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/fusionpbx-wss /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# ── Step 5: Configure FreeSWITCH for WebRTC ───────────────
echo "[5/8] Configuring FreeSWITCH for WebRTC..."

# Enable WSS in internal SIP profile
FS_INTERNAL="/etc/freeswitch/sip_profiles/internal.xml"
if [ -f "$FS_INTERNAL" ]; then
  # Ensure WSS is enabled
  if ! grep -q "wss-binding" "$FS_INTERNAL"; then
    sed -i '/<\/settings>/i \    <param name="wss-binding" value=":7443"/>' "$FS_INTERNAL"
  fi
fi

# Configure mod_verto for WebRTC
mkdir -p /etc/freeswitch/autoload_configs
cat > /etc/freeswitch/autoload_configs/verto.conf.xml <<'VERTO_EOF'
<configuration name="verto.conf" description="Verto Configuration">
  <settings>
    <param name="debug" value="0"/>
  </settings>
  <profiles>
    <profile name="default-v4">
      <param name="bind-local" value="0.0.0.0:8081"/>
      <param name="bind-local" value="0.0.0.0:8082" secure="true"/>
      <param name="force-register-domain" value="$${domain}"/>
      <param name="secure-combined" value="/etc/freeswitch/tls/wss.pem"/>
      <param name="secure-chain" value="/etc/freeswitch/tls/cafile.pem"/>
      <param name="userauth" value="true"/>
      <param name="codec-string" value="opus@48000h@20i,PCMU,PCMA"/>
      <param name="rtp-ip" value="$${local_ip_v4}"/>
    </profile>
  </profiles>
</configuration>
VERTO_EOF

# ── Step 6: Configure ESL (Event Socket Layer) ────────────
echo "[6/8] Configuring ESL..."

# Bind ESL to localhost only (security)
ESL_CONF="/etc/freeswitch/autoload_configs/event_socket.conf.xml"
if [ -f "$ESL_CONF" ]; then
  sed -i 's/listen-ip" value="[^"]*"/listen-ip" value="127.0.0.1"/' "$ESL_CONF"
fi

# ── Step 7: Firewall ──────────────────────────────────────
echo "[7/8] Configuring firewall..."

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp      # HTTP (redirect)
ufw allow 443/tcp     # HTTPS + WSS
ufw allow 5060/udp    # SIP (internal, consider restricting to trunk IPs)
ufw allow 5060/tcp    # SIP TCP
ufw allow 5080/udp    # SIP external (for SIP trunks)
ufw allow 5080/tcp    # SIP external TCP
ufw allow 16384:32768/udp  # RTP media

# Restrict SIP to known trunk IPs (uncomment and customize)
# TELNYX_IPS="52.0.202.2 52.0.115.90 52.1.230.195 52.0.78.40"
# for ip in $TELNYX_IPS; do
#   ufw allow from $ip to any port 5080
# done

echo "y" | ufw enable

# ── Step 8: Fail2ban for SIP ──────────────────────────────
echo "[8/8] Configuring fail2ban for SIP protection..."

cat > /etc/fail2ban/jail.d/freeswitch.conf <<'F2B_EOF'
[freeswitch]
enabled  = true
port     = 5060,5080
protocol = udp
filter   = freeswitch
logpath  = /var/log/freeswitch/freeswitch.log
maxretry = 5
bantime  = 3600
findtime = 300
F2B_EOF

cat > /etc/fail2ban/filter.d/freeswitch.conf <<'F2B_FILTER'
[Definition]
failregex = \[WARNING\] sofia_reg.c:\d+ SIP Registration Failed from.*\[<HOST>\]
            \[WARNING\] sofia_reg.c:\d+ Can't find user.*from.*\[<HOST>\]
ignoreregex =
F2B_FILTER

systemctl restart fail2ban

# ── Done ──────────────────────────────────────────────────
echo ""
echo "============================================"
echo " Installation Complete!"
echo "============================================"
echo ""
echo "1. Access FusionPBX: https://$PBX_DOMAIN"
echo "2. Credentials: /root/fusionpbx-install-credentials.txt"
echo "3. Create extensions 1001-1005 in FusionPBX GUI"
echo "4. Test WebRTC: install FusionPBX Browser Phone extension"
echo ""
echo "Next steps:"
echo "  - Configure DNS: $PBX_DOMAIN -> $(curl -s ifconfig.me)"
echo "  - Run: ./02-configure-sip-trunks.sh"
echo "  - Router: Disable SIP ALG, forward ports 5080, 443, 16384-32768/UDP"
echo ""
echo "FreeSWITCH status: $(fs_cli -x 'status' 2>/dev/null | head -1 || echo 'check with fs_cli')"
