# MeteoStation

Solar-powered wind weather station: an **ATmega328P-AU @ 1 MHz** samples wind speed
(anemometer) and direction (8-point vane), then POSTs the batch over an **A7672E GSM
module** (HTTP, binary payload) to a small PHP backend. A self-contained web dashboard
(PWA, works offline) shows live + historical data, charts, battery/solar, and web-push
alerts.

## Repo layout

```
firmware/        AVR firmware (C). main.c = non-blocking state machine; gsm.c, sensor.c,
                 power.c, dbgUart.c (soft-UART debug). config.h = all build flags.
firmware/probes/ standalone hardware bring-up sketches (gitignored)
server/          meteo.php          backend (POST receiver, history, config, push; serves UI)
                 dashboard.html     operator UI (served from disk at ?ui=1)
                 serial.html        Web-Serial calibration page (?ui_serial=1)
                 deploy.sh          push meteo.php + UI + config to the host (no build step)
                 config.example.php copy to config.php (gitignored) and fill secrets
                 test_ci.py         Playwright UI/endpoint tests (gitignored)
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

The backend is a single PHP class (`Meteo`). There is **no build step**: `meteo.php` deploys
as-is, and the dashboard/serial UI + secrets are served from a host directory (`FILE_DIR`) at
runtime.

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
`meteo.php` overwrites itself (`?edit=1`, with a `php -l` check + `.bak`), while
`dashboard.html` / `serial.html` / `config.php` are written into `FILE_DIR`
(`?edit=1&file=NAME`) and read at runtime (`?ui=1` serves the dashboard, secrets via
`require`). Edit a file → re-run `deploy.sh`. The service worker pre-caches the dashboard so
the app works offline. Verify: `?config=1`, `?ui=1`, `?push_selftest=1` (`roundtrip:OK`).

**Hosting note:** the `Meteo` class carries a 1-line `class_alias(...)` host shim at the
bottom so a framework that routes a URL to a specific class name still works. For a plain
PHP host, drop the alias and invoke `new Meteo();` directly. `SERVER_URL` in the firmware
must point at whatever URL serves this file.

## Endpoints (quick reference)

`POST` binary payload → logged. `GET ?ui=1` dashboard · `?config=1` runtime config ·
`?since=/range=` history JSON · `?sw=1` service worker · `?manifest=1` PWA manifest ·
`?push_*` web-push (VAPID). Admin actions (`?edit`, `?wipe_log`, `?gen_demo`, …) require
`&key=EDIT_KEY`.
