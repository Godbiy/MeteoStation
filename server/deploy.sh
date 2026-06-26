#!/usr/bin/env bash
# Deploy MeteoStation (no build). Pushes the backend (backend/*.php), the UI, and config
# into the host's FILE_DIR, then the thin bootstrap to the self-edit endpoint. Re-run after
# any edit (or push a single file by hand with ?edit=1&file=NAME[&src]).
#
# One-time host setup (a dir the web user can write — the web root can't create new files):
#   mkdir -p /st/petro/tmp/meteo && chmod -R 777 /st/petro/tmp/meteo
# Usage: ./server/deploy.sh [ENDPOINT_URL]
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${1:-https://stelnet.stelweld.com.pl/petro/MeteoStation/TestKurwa}"
KEY=$(sed -n "s/.*'EDIT_KEY' *=> *'\([^']*\)'.*/\1/p" server/config.php)
[ -n "$KEY" ] || { echo "no EDIT_KEY in server/config.php (copy config.example.php)"; exit 1; }
H="Content-Type: application/x-php"

# push <local-file> [query]   e.g. push backend/Server.php "file=Server.php&src"
push() { curl -s -X POST -H "$H" --data-binary "@$1" "$URL?edit=1${2:+&$2}&key=$KEY" -w "  [%{http_code}]\n"; }

echo "== backend (backend/*.php -> FILE_DIR/src/Meteo) =="
for f in backend/*.php; do n=$(basename "$f"); printf '  %-22s' "$n"; push "$f" "file=$n&src"; done

echo "== UI parts + assets (-> FILE_DIR, flat) =="
# The shell/css/js are split into named fragments (frontend/{html,css,js}/) that Ui.php
# concatenates on serve in an explicit order (see Ui::ORDER). The ?edit endpoint writes
# flat (basename only), so each fragment lands flat in FILE_DIR. sw.js + manifest are whole.
for f in frontend/html/* frontend/css/* frontend/js/* frontend/sw.js frontend/manifest.json; do
  n=$(basename "$f"); printf '  %-22s' "$n"; push "$f" "file=$n"
done
printf '  %-22s' config.php; push server/config.php "file=config.php"

echo "== bootstrap (-> the endpoint file itself) =="
printf '  %-14s' meteo.php;      push server/meteo.php

echo "done. verify: $URL?ui=1 , ?config=1 , ?push_selftest=1"
