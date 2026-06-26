#!/usr/bin/env bash
# Deploy MeteoStation (no build). Pushes the library (src/Meteo/*.php), the UI, and config
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

# push <local-file> [query]   e.g. push src/Meteo/Server.php "file=Server.php&src"
push() { curl -s -X POST -H "$H" --data-binary "@$1" "$URL?edit=1${2:+&$2}&key=$KEY" -w "  [%{http_code}]\n"; }

echo "== library (src/Meteo -> FILE_DIR/src/Meteo) =="
for f in src/Meteo/*.php; do n=$(basename "$f"); printf '  %-14s' "$n"; push "$f" "file=$n&src"; done

echo "== UI + config (-> FILE_DIR) =="
printf '  %-14s' config.php;     push server/config.php       "file=config.php"
printf '  %-14s' dashboard.html; push src/dashboard.html      "file=dashboard.html"

echo "== bootstrap (-> the endpoint file itself) =="
printf '  %-14s' meteo.php;      push server/meteo.php

echo "done. verify: $URL?ui=1 , ?config=1 , ?push_selftest=1"
