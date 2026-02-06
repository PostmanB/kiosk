#!/bin/sh
set -eu

escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/\"/\\\"/g'
}

SUPABASE_URL_ESCAPED="$(escape "${VITE_SUPABASE_URL}")"
SUPABASE_KEY_ESCAPED="$(escape "${VITE_SUPABASE_ANON_KEY}")"
KIOSK_PIN_ESCAPED="$(escape "${VITE_KIOSK_PIN}")"
STATS_PIN_ESCAPED="$(escape "${VITE_STATS_PIN}")"

cat > /srv/env.js <<EOF
window.__ENV__ = {
  VITE_SUPABASE_URL: "${SUPABASE_URL_ESCAPED}",
  VITE_SUPABASE_ANON_KEY: "${SUPABASE_KEY_ESCAPED}",
  VITE_KIOSK_PIN: "${KIOSK_PIN_ESCAPED}",
  VITE_STATS_PIN: "${STATS_PIN_ESCAPED}"
};
EOF

exec "$@"
