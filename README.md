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
server/          meteo.php          generic backend (POST receiver, history, config, push)
                 dashboard.html     operator UI (served by the backend at ?ui=1)
                 serial.html        Web-Serial calibration page (?ui_serial=1)
                 build_combined_php.py  embeds the HTML into one deploy artifact
                 config.example.json    copy to config.json (gitignored) and fill secrets
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

## Server — build & deploy

The backend is a single PHP class (`Meteo`). Secrets are **not** in the repo — they live in
`server/config.json` (gitignored) and are inlined into the deploy artifact at build time.

```bash
# 1. one-time: create your config
cp server/config.example.json server/config.json   # then edit: EDIT_KEY, VAPID keys

# 2. build the single deploy file (embeds dashboard + serial UI + inlines config.json)
python server/build_combined_php.py                 # -> server/meteo_combined.php

# 3. deploy (self-edit endpoint: php -l syntax check + keeps a .bak)
curl -X POST -H "Content-Type: application/x-php" \
  --data-binary @server/meteo_combined.php \
  "https://YOUR_HOST/path/to/endpoint?edit=1&key=YOUR_EDIT_KEY"
```

`meteo_combined.php` is the **deploy artifact** (gitignored). The dashboard is served by the
same file at `?ui=1`; the service worker pre-caches it so the app works offline.

**Hosting note:** the `Meteo` class carries a 1-line `class_alias(...)` host shim at the
bottom so a framework that routes a URL to a specific class name still works. For a plain
PHP host, drop the alias and invoke `new Meteo();` directly. `SERVER_URL` in the firmware
must point at whatever URL serves this file.

## Endpoints (quick reference)

`POST` binary payload → logged. `GET ?ui=1` dashboard · `?config=1` runtime config ·
`?since=/range=` history JSON · `?sw=1` service worker · `?manifest=1` PWA manifest ·
`?push_*` web-push (VAPID). Admin actions (`?edit`, `?wipe_log`, `?gen_demo`, …) require
`&key=EDIT_KEY`.
