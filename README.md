# MeteoStation

Solar-powered wind weather station: an **ATmega328P-AU @ 1 MHz** samples wind speed
(anemometer) and direction (8-point vane), then POSTs the batch over an **A7672E GSM
module** (HTTP, binary payload) to a small PHP backend. A self-contained web dashboard
(PWA, works offline) shows live + historical data, charts, battery/solar, and web-push
alerts.

## Repo layout

```
backend/         PHP library, one class per file: Server (pure router), Api (station POST +
                 history/config), Store (persistence), Payload (binary decode + CRC),
                 WebPush (VAPID), Ui (dashboard/PWA), Admin (edit). namespace Meteo.
frontend/        UI split into one-concern-per-file fragments the server ASSEMBLES on
                 serve (no build): html/page.NN.*.html (shell), css/app.NN.*.css, js/app.NN.*.js,
                 plus sw.js, manifest.json. Served via ?ui=1 / ?asset=NAME / ?sw=1 / ?manifest=1
firmware/        AVR firmware (C). main.c = non-blocking state machine; gsm.c, sensor.c,
                 power.c, dbgUart.c (soft-UART debug). config.h = all build flags.
firmware/probes/ standalone hardware bring-up sketches (gitignored)
server/          stelnet host adapter: meteo.php (thin bootstrap), deploy.sh, config.example.php
                 (config.php + test_ci.py gitignored)
examples/        standalone/ — ready-to-run server for a normal PHP host (index.php + .htaccess)
docs/            datasheets (A7672E), PCB/schematic JSON + viewers, AVR cheatsheet
build/           firmware build outputs (gitignored)
```

## Firmware — build & flash

Toolchain: `avr-gcc` + `avrdude` (USBasp). On this machine: `C:/avr-gcc/bin`, `C:/avrdude`.

```bash
# Compile
avr-gcc -mmcu=atmega328p -Os -std=gnu11 -Wall -Wextra \
  -o build/meteo.elf firmware/main.c firmware/dbgUart.c firmware/gsm.c \
     firmware/sensor.c firmware/power.c

# HEX
avr-objcopy -O ihex -R .eeprom build/meteo.elf build/meteo.hex

# Flash (USBasp)
avrdude -p m328p -c usbasp -B 100 -U flash:w:build/meteo.hex:i

# Fuses (one-time): 8 MHz RC / CKDIV8 -> 1 MHz, BOD off
avrdude -p m328p -c usbasp -B 100 -U lfuse:w:0x62:m -U hfuse:w:0xD9:m -U efuse:w:0xFF:m
```

Debug: soft-UART TX on **PC1 @ 4800 baud** (connect a USB-UART RX). `DEBUG_LEVEL` in
`config.h`: `0` silent, `1` states/errors, `2` full AT trace.

Key flags in `firmware/config.h`: `FAST_TEST_MODE`, `DEBUG_SENSOR_ONLY`, `DEBUG_LEVEL`,
`GSM_MAX_RETRIES`, `SERVER_URL` (where the firmware POSTs).

## Server — deploy

The backend is the `Meteo\*` library in [`backend`](backend). There is **no build step**.
On the stelnet host, `server/meteo.php` is a thin bootstrap that autoloads the library from
`FILE_DIR/src/Meteo` and runs it; the library, UI, and secrets are served from `FILE_DIR` at
runtime (the web root can't take new files). For a normal host, see
[`examples/standalone`](examples/standalone) instead.

```bash
# 1. one-time on the host — a dir the web user can write to (the web root usually can't
#    create new files). Must match FILE_DIR in meteo.php:
mkdir -p /st/petro/tmp/meteo && chmod 777 /st/petro/tmp/meteo

# 2. one-time local — your secrets (gitignored):
cp server/config.example.php server/config.php      # then edit EDIT_KEY + VAPID keys

# 3. deploy (no build):
./server/deploy.sh                                  # or: ./server/deploy.sh <ENDPOINT_URL>
```

`deploy.sh` reads `EDIT_KEY` from `config.php` and POSTs each file to the self-edit endpoint:
`meteo.php` overwrites itself (`?edit=1`, `php -l` + `.bak`); the backend (`backend/*.php` →
FILE_DIR/src/Meteo), UI, and `config.php` go into `FILE_DIR` (`?edit=1&file=NAME[&src]`) and are read at runtime
(`?ui=1` serves the dashboard, secrets via `require`, classes via the bootstrap's autoloader).
Edit a file → re-run `deploy.sh`. The service worker pre-caches the dashboard so the app works
offline. Verify: `?config=1`, `?ui=1`, `?push_selftest=1` (`roundtrip:OK`).

**Hosting note:** `server/meteo.php` defines a class named `TestKurwa` (the path the stelnet
framework routes to) whose constructor builds `Meteo\Server` and runs it. On a normal host you
don't need this shim — use `examples/standalone` and point the firmware's `SERVER_URL` at it.
If a fatal ever takes the bootstrap down, run `php FILE_DIR/src/Meteo/smoke.php` to find the bad
class, or `cp …/TestKurwa.php.bak …/TestKurwa.php` over shell.

## Endpoints (quick reference)

`POST` binary payload → logged. `GET ?ui=1` dashboard · `?config=1` runtime config ·
`?since=/range=` history JSON · `?sw=1` service worker · `?manifest=1` PWA manifest ·
`?push_*` web-push (VAPID). Admin actions (`?edit`, `?wipe_log`, `?gen_demo`, …) require
`&key=EDIT_KEY`.
