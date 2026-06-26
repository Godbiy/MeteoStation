#!/usr/bin/env bash
# Deploy the MeteoStation server. No build step: meteo.php is served to the host's self-edit
# endpoint, and the UI + config are pushed into FILE_DIR (a host dir the web user can write,
# e.g. /st/petro/tmp/meteo) and read from disk at runtime.
#
# One-time host setup:  mkdir -p /st/petro/tmp/meteo && chmod 777 /st/petro/tmp/meteo
# Usage:  ./server/deploy.sh [ENDPOINT_URL]
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${1:-https://stelnet.stelweld.com.pl/petro/MeteoStation/TestKurwa}"
KEY=$(sed -n "s/.*'EDIT_KEY' *=> *'\([^']*\)'.*/\1/p" server/config.php)
[ -n "$KEY" ] || { echo "no EDIT_KEY in server/config.php (copy config.example.php)"; exit 1; }
H="Content-Type: application/x-php"

push() {  # push <local-file> [remote-name-in-FILE_DIR]
    curl -s -X POST -H "$H" --data-binary "@$1" \
        "$URL?edit=1${2:+&file=$2}&key=$KEY" -w "  [%{http_code}]\n"
}

echo -n "config.php     "; push server/config.php    config.php
echo -n "dashboard.html "; push server/dashboard.html dashboard.html
echo -n "serial.html    "; push server/serial.html    serial.html
echo -n "meteo.php      "; push server/meteo.php
echo "done. verify: $URL?ui=1 , ?config=1 , ?push_selftest=1"
