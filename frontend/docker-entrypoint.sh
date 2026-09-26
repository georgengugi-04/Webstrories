#!/bin/sh
# Regenerates env.js from real environment variables before nginx starts.
# This is what makes the API base URL configurable per-deployment without
# rebuilding the image — set API_BASE_URL / WHATSAPP_NUMBER when you run
# or deploy the container, and this file picks them up.
#
# Runs automatically: nginx:alpine executes every script in
# /docker-entrypoint.d/ (in name order) before starting nginx.
set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
WHATSAPP_NUMBER="${WHATSAPP_NUMBER:-2547XXXXXXXX}"

cat > /usr/share/nginx/html/env.js <<EOF
// Generated at container startup by docker-entrypoint.sh — do not edit
// directly inside a running container, it will be overwritten on restart.
window.GREENTRACK_API_BASE = "${API_BASE_URL}";
window.GREENTRACK_WHATSAPP_NUMBER = "${WHATSAPP_NUMBER}";
EOF

echo "[greentrack-frontend] env.js written — API_BASE_URL=${API_BASE_URL}"
