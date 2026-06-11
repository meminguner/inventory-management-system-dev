#!/usr/bin/env bash
# Lokal → ims test sunucusuna deploy: rsync + uzakta docker compose up --build
# Kullanım: ./deploy.sh
set -euo pipefail

SERVER="root@49.12.68.83"
SSH_KEY="$HOME/.ssh/id_ed25519"
DEST="/opt/ims"

cd "$(dirname "$0")"

# Sunucu .env'i lokalden farklı (BIND_IP, DB_PASSWORD) — rsync ona dokunmaz
ssh -i "$SSH_KEY" -o BatchMode=yes "$SERVER" "test -f $DEST/.env" || {
    echo "HATA: sunucuda $DEST/.env yok — önce sunucuya özel .env oluşturulmalı." >&2
    exit 1
}

rsync -az --delete \
    -e "ssh -i $SSH_KEY" \
    --exclude .git \
    --exclude .env \
    --exclude node_modules/ \
    --exclude /server/tmp/ \
    --exclude /client/dist/ \
    --exclude .DS_Store \
    --exclude CLAUDE.md \
    --exclude AI_HANDOFF.md \
    --exclude AI_CONTEXT_AUTHORIZATION.md \
    --exclude AI_NOTES.md \
    --exclude .claude/ \
    ./ "$SERVER:$DEST/"

ssh -i "$SSH_KEY" -o BatchMode=yes "$SERVER" "cd $DEST && docker compose up -d --build"

echo "✓ Deploy tamam — telefondan/Mac'ten: http://ims:3000"
