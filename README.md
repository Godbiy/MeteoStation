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
                 serve in an explicit order (Ui::ORDER): html/*.html (shell), css/*.css, js/*.js,
                 plus sw.js, manifest.json. Served via ?ui=1 / ?asset=NAME / ?sw=1 / ?manifest=1
firmware/        AVR firmware (C). main.c = non-blocking state machine; gsm.c, sensor.c,
                 power.c, dbgUart.c (soft-UART debug). config.h = all build flags.
firmware/probes/ standalone hardware bring-up sketches (gitignored)
examples/        standalone/ — the supported server: ready-to-run on any normal PHP host
                 (index.php + .htaccess), serves the UI straight from frontend/, no build
docs/            API.md (full HTTP endpoint reference), datasheets (A7672E),
                 PCB/schematic JSON + viewers, AVR cheatsheet
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

## Server — run it

The backend is the `Meteo\*` library in [`backend`](backend) plus the UI fragments in
[`frontend`](frontend). There is **no build step**. The supported, self-contained server is
[`examples/standalone`](examples/standalone) — drop it on any normal PHP host (Apache + mod_rewrite,
or nginx rewriting to `index.php`):

```bash
cp examples/standalone/config.example.php examples/standalone/config.php   # EDIT_KEY + VAPID (gitignored)
```

Then point a vhost docroot at `examples/standalone/` (or copy it onto the host) and set the
firmware's `SERVER_URL` to that directory. `index.php` wires paths + secrets, points `fileDir` at
the repo's `frontend/`, and runs `(new Meteo\Server($cfg))->handle()`. The server assembles the
dashboard from the fragments on each request and the service worker pre-caches it for offline use —
nothing to copy or compile. Verify: `?config=1`, `?ui=1`, `?push_selftest=1` (`roundtrip:OK`).

See [`examples/standalone/README.md`](examples/standalone/README.md) for details and
[`docs/API.md`](docs/API.md) for the full endpoint reference.

> **Deploying to a locked-down shared host?** A host that can't take new files over FTP/SSH can be
> served by the same library through the self-overwrite `?edit` endpoint (see `Admin`/`docs/API.md`).
> The adapter for the specific host this project runs on lives in a private, gitignored `server/`
> directory — it's infra-specific (a fixed live URL, a writable `FILE_DIR`, a framework entry class)
> and is intentionally not part of the public project.

## Notifications (server-side push)

All alerts are delivered by **server-side Web Push** (VAPID) — they work with the dashboard
**closed**; there are no foreground/tab-open notifications. Battery / wind / solar-charge /
back-online fire on each station POST. "Station offline" + the live-pin "widget" are driven by a
time-based watchdog (`WebPush::tick()`) that runs independently of POSTs via three layers:

- **lazy-tick** — piggy-backs on the dashboard's own polling (no cron needed while a tab is open);
- **`?tick=1`** — hit by an external scheduler every minute (recommended): **cron-job.org** /
  UptimeRobot / a GitHub Actions `schedule:` workflow → `…/?tick=1`. The host needs no
  crontab — the heartbeat lives anywhere that can `curl` a URL;
- **`?daemon=1`** — a self-relaying host-side worker (singleton `{ts,nonce}` lock) as a no-cron
  fallback; Settings → Notify has an **Enable** button + a `?daemon_status` liveness line.

"Online vs late vs switching vs offline" is decided by a single backend state machine
(`Store::linkState`), so the offline alert is cycle-relative and never false-fires during a
config/cycle change. Per-device thresholds/types live in the dashboard (Settings → Сповіщення)
and are stored per push subscription.

## Endpoints

The route is chosen by HTTP method + a query flag (`?ui=1`, `?config=1`, …) — no path routing,
no `.php`. In short: `POST` (binary) → logged · `?ui=1` dashboard · `?config=1` config + connection
state · `?since=`/`?range=` history · `?sw=1`/`?manifest=1` PWA · `?push_*` web push · `?tick=1`
watchdog · admin (`?edit`, `?wipe_log`, `?gen_demo`, `?save_calib`) require `&key=EDIT_KEY`.

**Full reference with every parameter, response shape, and auth: [`docs/API.md`](docs/API.md).**
