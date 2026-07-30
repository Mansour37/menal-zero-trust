#!/bin/bash
# ══════════════════════════════════════════════════════════
# Hassaniya Crowdsource — Hetzner Server Setup
# Run: ssh root@YOUR_IP 'bash -s' < deploy/setup-server.sh
# ══════════════════════════════════════════════════════════

set -euo pipefail

DEPLOY_USER="deploy"
SSH_PORT=2222

echo "══════════════════════════════════════════════════════"
echo "  Hassaniya Crowdsource — Server Setup"
echo "══════════════════════════════════════════════════════"

# 1. System updates
echo "[1/9] Updating system..."
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban unattended-upgrades apt-listchanges

# 2. Create deploy user
echo "[2/9] Creating deploy user..."
if ! id "$DEPLOY_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" $DEPLOY_USER
    usermod -aG sudo $DEPLOY_USER
    mkdir -p /home/$DEPLOY_USER/.ssh
    cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
fi

# 3. SSH hardening
echo "[3/9] Hardening SSH..."
cat > /etc/ssh/sshd_config.d/hardened.conf << 'SSHEOF'
Port 2222
PermitRootLogin no
PasswordAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy
SSHEOF

# 4. Firewall
echo "[4/9] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow $SSH_PORT/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
echo "y" | ufw enable

# 5. Fail2ban
echo "[5/9] Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
F2BEOF
systemctl enable fail2ban
systemctl restart fail2ban

# 6. Auto security updates
echo "[6/9] Configuring auto-updates..."
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'UUEOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
UUEOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUEOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUEOF

# 7. Docker
echo "[7/9] Installing Docker..."
curl -fsSL https://get.docker.com | sh
usermod -aG docker $DEPLOY_USER

# 8. App directory
echo "[8/9] Creating app directory..."
mkdir -p /opt/hassaniya
chown $DEPLOY_USER:$DEPLOY_USER /opt/hassaniya

# 9. Daily backup cron
echo "[9/9] Setting up daily backups..."
cat > /etc/cron.daily/hassaniya-backup << 'CRONEOF'
#!/bin/bash
cd /opt/hassaniya
docker compose --profile backup run --rm pg-backup
CRONEOF
chmod +x /etc/cron.daily/hassaniya-backup

echo ""
echo "══════════════════════════════════════════════════════"
echo "  SETUP COMPLETE!"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  SSH port changed to $SSH_PORT"
echo "  Reconnect: ssh -p $SSH_PORT deploy@YOUR_IP"
echo ""
echo "  Next steps:"
echo "  1. scp your project to /opt/hassaniya/"
echo "  2. Create .env from .env.example"
echo "  3. Replace YOUR_DOMAIN in Caddyfile"
echo "  4. Point DNS: app.DOMAIN + api.DOMAIN → server IP"
echo "  5. cd /opt/hassaniya && docker compose up -d"
echo ""
echo "  Backups: daily auto via cron to docker volume 'backups'"
echo "  Manual:  docker compose --profile backup run --rm pg-backup"
echo "  Restore: gunzip < backup.sql.gz | docker compose exec -T postgres psql -U hassaniya hassaniya"
echo ""
echo "  Hetzner Cloud Firewall:"
echo "  - TCP 2222 (SSH)"
echo "  - TCP 80 (HTTP)"
echo "  - TCP 443 (HTTPS)"
echo "  - Block all else"
echo ""
echo "══════════════════════════════════════════════════════"

systemctl restart sshd
