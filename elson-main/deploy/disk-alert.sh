#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Elson — Disk capacity alert
# Emails ALERT_EMAILS (via the Zoho SMTP creds in .env) when the root
# disk OR the audio volume (/mnt/audio) reaches THRESHOLD%.
# Sends the full disk state. De-duplicated: at most one alert / 24h,
# and re-armed automatically once usage drops back below the threshold.
# Run hourly via cron (as root).
# ──────────────────────────────────────────────────────────────
ENV=/opt/hassaniya/.env
THRESHOLD=${THRESHOLD:-70}
FLAG=/tmp/.elson_disk_alert_sent

get() { grep -E "^$1=" "$ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r'; }
SMTP_HOST=$(get SMTP_HOST); SMTP_PORT=$(get SMTP_PORT)
SMTP_USER=$(get SMTP_USER); SMTP_PASS=$(get SMTP_PASS)
RCPTS=$(get ALERT_EMAILS)
[ -z "$SMTP_USER" ] || [ -z "$RCPTS" ] && exit 0
[ -z "$SMTP_PORT" ] && SMTP_PORT=587
# Build a --mail-rcpt arg per address + a combined To: header
RCPT_ARGS=""; TO_HDR=""
IFS=',' read -ra _ADDR <<< "$RCPTS"
for a in "${_ADDR[@]}"; do a=$(echo "$a" | xargs); [ -z "$a" ] && continue
  RCPT_ARGS="$RCPT_ARGS --mail-rcpt $a"; TO_HDR="${TO_HDR:+$TO_HDR, }$a"; done

pct() { df --output=pcent "$1" 2>/dev/null | tail -1 | tr -dc '0-9'; }
ROOT=$(pct /); AUDIO=$(pct /mnt/audio)
MAX=${ROOT:-0}; [ "${AUDIO:-0}" -gt "$MAX" ] && MAX=$AUDIO

# Below threshold → re-arm and exit
if [ "$MAX" -lt "$THRESHOLD" ]; then rm -f "$FLAG"; exit 0; fi
# Dedup: only once per 24h
if [ -f "$FLAG" ] && [ $(( $(date +%s) - $(stat -c %Y "$FLAG") )) -lt 86400 ]; then exit 0; fi
touch "$FLAG"

DF=$(df -h / /mnt/audio 2>/dev/null | sed 's/^/   /')
AUD=$(du -sh /mnt/audio/recordings 2>/dev/null | cut -f1)
NFILES=$(find /mnt/audio/recordings -type f 2>/dev/null | wc -l)
WHEN=$(date -u '+%Y-%m-%d %H:%M UTC')

BODY=$(cat <<EOF
From: Elson Alerts <${SMTP_USER}>
To: ${TO_HDR}
Subject: [ALERTE] Elson - disque a ${MAX}% (serveur hassaniya-prod)
Content-Type: text/plain; charset=UTF-8

ALERTE CAPACITE DISQUE - ${WHEN}

Le disque a atteint ${MAX}% (seuil d'alerte : ${THRESHOLD}%).
  - racine (/)        : ${ROOT}%
  - volume audio (/mnt/audio) : ${AUDIO}%

Etat des disques :
${DF}

Audios : ${AUD} (${NFILES} fichiers) sur le volume Hetzner elson-audio.

Recommandation : si on approche de 85-90%, agrandir le volume Hetzner
(elson-audio) -- ca se fait a chaud, sans interruption.

-- Alerte automatique du serveur Elson
EOF
)

echo "$BODY" | curl -s --max-time 30 --url "smtp://${SMTP_HOST}:${SMTP_PORT}" --ssl-reqd \
  --mail-from "$SMTP_USER" $RCPT_ARGS \
  --user "${SMTP_USER}:${SMTP_PASS}" --upload-file - \
  && echo "[disk-alert] email envoye a ${TO_HDR} (disque a ${MAX}%)" \
  || echo "[disk-alert] ECHEC envoi email"
