# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Firmware for a weather station on **ATmega328P-AU** running at **1 MHz** (8 MHz RC / CKDIV8 fuse). Collects wind speed + direction samples, sends via **A7672E GSM module** over HTTP POST as binary payload.

Fuses (low-power, BOD disabled):
- Low: `0x62`, High: `0xD9`, Ext: `0xFF`

## Repo layout

```
backend/    PHP library, 1 class/file: Server, Api, Store, Payload, WebPush, Ui, Admin
            (namespace Meteo; the server wires it from a $cfg of paths + secrets).
frontend/   UI in named fragments the server CONCATENATES (no build) in an explicit order
            (Ui::ORDER): html/*.html -> shell (?ui=1); css/*.css -> ?asset=dashboard.css;
            js/*.js -> ?asset=dashboard.js. Plus sw.js + manifest.json. Calib is a tab.
firmware/   AVR sources (main.c, gsm.c, sensor.c, power.c, dbgUart.c) + config.h.
            firmware/probes/ = bring-up sketches (gitignored)
examples/   standalone/ = the supported server for a normal PHP host (index.php + .htaccess);
            serves the UI straight from frontend/, no build/copy step.
server/     PRIVATE host adapter for one locked-down shared host (whole dir gitignored): a thin
            bootstrap + deploy.sh + config.php. Infra-specific, on disk only, never committed.
docs/       API.md (full endpoint reference), A7672E datasheets, PCB JSON + viewers, avr_cheatsheet.md
build/      firmware outputs (gitignored)
```

## Build & Flash

Toolchain: `avr-gcc` + `avrdude` (USBasp). Tool paths here: `C:/avr-gcc/bin/`, `C:/avrdude/`.

```bash
# Compile (tick.c was merged into power.c; dbgUart.c is the soft-UART module)
avr-gcc -mmcu=atmega328p -Os -std=gnu11 -Wall -Wextra \
  -o build/meteo.elf firmware/main.c firmware/dbgUart.c firmware/gsm.c firmware/sensor.c firmware/power.c

avr-objcopy -O ihex -R .eeprom build/meteo.elf build/meteo.hex
avrdude -p m328p -c usbasp -B 100 -U flash:w:build/meteo.hex:i

# Fuses (one-time): 8 MHz RC / CKDIV8 -> 1 MHz, BOD off
avrdude -p m328p -c usbasp -B 100 -U lfuse:w:0x62:m -U hfuse:w:0xD9:m -U efuse:w:0xFF:m
```

Debug UART: soft-TX on **PC1 @ 4800 baud** → USB-UART adapter (here **COM13**). Read the port
to watch the state machine / AT trace live.

## Server / Dashboard (PHP + HTML)

The backend is the **`Meteo\*` library** in `backend/` (one class per file): `Server` (pure
router), `Api` (station POST + history/config API), `Store` (all file IO), `Payload` (binary
decode + CRC), `WebPush` (VAPID), `Ui` (dashboard/serial/PWA), `Admin` (key-gated edit/restore/wipe).

- The server is wired from a `$cfg` array (file paths + secrets) and dispatched with
  `(new \Meteo\Server($cfg))->handle()`. The dashboard is assembled from the `frontend/` fragments
  on each request (operator UI: live, history, status, settings, and a native vane-calibration tab —
  Web-Serial COM **or** GSM-live source, 8-point grid, push/pull to the server).
- `examples/standalone/` — the supported wiring for a normal host: `index.php` sets `$cfg` (paths in
  `data/`, `fileDir` → `frontend/`) and runs. `config.example.php` → `config.php` (gitignored):
  `EDIT_KEY` + VAPID keys. Full route list in `docs/API.md`.
- `server/` — a PRIVATE adapter for one locked-down shared host (whole dir gitignored, on disk
  only). That host can't take new files over FTP/SSH, so a thin bootstrap serves the library from a
  writable runtime dir and `deploy.sh` pushes every file in via the self-overwrite `?edit` endpoint.
  Infra-specific; **not part of the public project** — don't reintroduce its URL/paths into git.
- `test_ci.py` — Playwright UI/endpoint suite (gitignored).

### Deploy

Public path — [`examples/standalone`](examples/standalone), no build/copy step:

```bash
cp examples/standalone/config.example.php examples/standalone/config.php   # EDIT_KEY + VAPID
# then point a vhost docroot at examples/standalone/ and set the firmware SERVER_URL to it
```

`?edit=1` (admin) does a `php -l` check + keeps a `.bak`. Verify after deploy: `?config=1` (JSON),
`?ui=1` (dashboard), `?push_selftest=1` (`"roundtrip":"OK"` = VAPID ok). On a self-edit breakage:
`?restore=1&key=…`. The private locked-down-host adapter has its own gitignored `server/deploy.sh`
(read it on disk when working that host).

### Push watchdog (offline / live-pin)

Server pushes fire on each station POST (`WebPush::maybePush`: battery/wind/back-online). The
**time-based** alerts — "station went silent / offline" and the auto-refreshing live-pin "widget" —
need a clock that runs *without* a POST (a dead station sends none). That clock is `WebPush::tick()`,
driven by three layers (all idempotent, same code):

1. **Lazy-tick** — `tickIfDue(60)` piggy-backs on the dashboard's own GET polling (wired in
   `Server::handle`). Advances while any dashboard is open, zero cron.
2. **External cron (recommended primary)** — `?tick=1` (`handleTick`). A host with no crontab still
   doesn't need the heartbeat to live on it: point any external scheduler at the URL. Free + reliable
   options:
   - **cron-job.org** — add job, URL `…/?tick=1`, every 1 min. (UptimeRobot / EasyCron work too.)
   - **GitHub Actions** — a `schedule:` workflow that `curl`s the URL (min 5-min granularity).
   - Any always-on device (phone Tasker / PC Task Scheduler / Pi).
3. **Self-running daemon (host-only fallback)** — `?daemon=1` (`handleDaemon`): a bounded ~50s worker
   that ticks every 10s then relays a baton to a fresh worker via `fastcgi_finish_request` + self-curl,
   before the FPM request timeout kills it. A `{ts,nonce}` lock (`MeteoDaemon.lock` in the runtime dir)
   makes it a singleton and stops the relay from forking. `boot.js` re-kicks it every 4 min (only if the user
   granted notifications); the Settings → Notify card has a manual **Enable** button + liveness status
   (`?daemon_status`). Verified working on the live host, but inherently flakier than an external cron.

Offline/live-pin are controlled by the existing per-device push cfg (`online` / `offlineMin` /
`livePin`) in the Alerts tab — no separate config.

## Architecture

### State Machine (main.c)

Non-blocking state machine — **no `_delay_ms()` in the main loop**. Pauses go through `smDelay` state which calls `sleepIdle()` until `tickElapsed()` returns true.

```
smBoot -> smGsmInit -> smGsmSleep -> smSleepSample
                   ^                      |
              smGsmRetry <- smGsmWake <---+
                   |
             smGsmHardReset -> smGsmInit
                   smSendData -> smGsmSleep (success)
                              -> smError   (retries exhausted)
```

Error escalation: retry (`retryCount < GSM_MAX_RETRIES`) → hard reset → `smError` (back to `smBoot`).

### Power Management (power.c / tick.c)

Two sleep modes:
- **`sleepIdle()`** — IDLE, CPU halted, UART + Timer1 running (~75 µA). Used during GSM waiting loops.
- **`sleepWdt()`** / **`sleepN(n)`** — power-down 2s per cycle, only WDT + PCINT active (~10 µA). Used during sample collection.

`tickStart()` / `tickStop()` must bracket every GSM-active phase. Timer1 is stopped before power-down.

### GSM Sleep/Wake (gsm.c)

`AT+CSCLK=1` enables DTR pin control of sleep:
- **Sleep** (`gsmSleep`): `AT+CFUN=4` (flight mode, keeps SIM for fast re-attach) + `AT+CSCLK=1`, then DTR **HIGH** → module sleeps.
- **Wake** (`gsmWake`): DTR **LOW** → `AT+CSCLK=0` → `AT+CFUN=1` → `AT+COPS=0`, then **poll `AT+CREG?` until registered (1/5) before returning**. A long sleep detaches the modem (`+CGEV: ME DETACH`); posting before re-registration used to crash long cycles — the CREG poll fixes it.

### GSM AT Command Pattern (gsm.c)

Every AT transaction follows the same sequence:
1. `rxFlush()` — clear buffer, disable RX ISR
2. `gsmPrintP(cmd)` — send from PROGMEM
3. `waitResp(timeout)` — IDLE sleep loop, `rxTick()` tracks silence
4. Response complete when `rxIdle >= GSM_RX_IDLE_MS` (50ms)
5. Check `respBuf` for `"OK"` or URC string

HTTP POST sequence: `HTTPTERM` → `HTTPINIT` → `HTTPPARA URL` → `HTTPPARA CONTENT` → `HTTPDATA` → stream binary payload → `HTTPACTION=1` → parse `+HTTPACTION:`.

### Sensors (sensor.c)

- **Vane direction**: 8 digital bits from PB0–PB7. MOSFET on PD3 powers it; 10ms stabilization delay then `PINB` snapshot.
- **Wind speed**: PCINT20 (PD4) ISR counts rising edges into `windPulses` during power-down sleep. `takeSample()` reads and resets atomically with `cli()`/`sei()`.

Sample buffers: `windVane[SAMPLE_COUNT]`, `windSpeed[SAMPLE_COUNT]`.

### Binary Payload Format

```
[1]  version = 0x04
[2]  cycleCount   (uint16_t LE)
[2]  sampleCount N(uint16_t LE)
[2]  batt_mv      (uint16_t LE)
[2]  solar_mv     (uint16_t LE)   # added in v0x04
[1]  csq
[N]  windVane[0..N-1]   (uint8_t)
[2N] windSpeed[0..N-1]  (uint16_t LE)
[1]  CRC-8 Dallas/Maxim over all bytes above
Total: 11 + 3*N bytes  (live POST = v0x11, a single-sample variant)
```

Payload is streamed byte-by-byte directly into UART — no intermediate buffer (RAM is 2 KB).

### Debug UART (dbg_uart.c)

Soft bit-bang TX on **PC1** @ **4800 baud**. Connect USB-UART adapter RX to PC1.

`DEBUG_LEVEL` in `config.h`:
- `0` — zero overhead (all macros → `((void)0)`)
- `1` — SM state transitions + errors
- `2` — full trace with AT responses

Always use `PSTR()` + `dbgPutsP()` to keep strings in Flash.

## Naming Conventions

- Macros / constants: `UPPER_CASE`
- Types (enum/typedef): `PascalCase` — `ErrCode`, `SmState`
- Enum values: `camelCase` — `errOk`, `smBoot`, `smGsmSleep`
- Functions: `camelCase` — `gsmSleep()`, `tickStart()`, `takeSample()`
- Variables: `camelCase` — `windVane`, `sampleIdx`, `cycleCount`
- ISR vectors: kept as-is (hardware-defined)

## Key config.h Flags

| Flag | Default | Effect |
|---|---|---|
| `DEBUG_LEVEL` | 2 | 0=silent, 1=states/errors, 2=full AT trace |
| `FAST_TEST_MODE` | 0 | 1=10 samples (~33s); 0=`SAMPLE_COUNT` 450 max, runtime `ACTIVE_SAMPLES` (default 30 = 1 min) |
| `DEBUG_SENSOR_ONLY` | 0 | 1=sensor loop only (no GSM) |
| `GSM_MAX_RETRIES` | 3 | retries before hard reset / smError |
| `SERVER_URL` | (https) | where the firmware POSTs the payload |

Cycle length is runtime-tunable from the server response (`samples=N`, `avg=M`): total ≈ `N·M·2s`.

## AVR Rules

- ISR functions: minimal work only — set a flag or increment a counter. No UART, no delays.
- Variables modified in ISR: must be `volatile`.
- Multi-byte volatile reads: wrap with `cli()`/`sei()`.
- Strings in Flash: `PSTR("...")` + `pgm_read_byte()` / `strstr_P()` / `dbgPutsP()`.
- Use `uint8_t` / `uint16_t` (not `int` / `long`) — guaranteed sizes on AVR.
- `F_CPU` is defined in `config.h` before any `#include <util/delay.h>`.
