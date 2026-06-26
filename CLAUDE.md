# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Firmware for a weather station on **ATmega328P-AU** running at **1 MHz** (8 MHz RC / CKDIV8 fuse). Collects wind speed + direction samples, sends via **A7672E GSM module** over HTTP POST as binary payload.

Fuses (low-power, BOD disabled):
- Low: `0x62`, High: `0xD9`, Ext: `0xFF`

## Repo layout

```
src/Meteo/  PHP library, 1 class/file: Server, Store, Payload, WebPush, Ui, Admin (namespace Meteo).
firmware/   AVR sources (main.c, gsm.c, sensor.c, power.c, dbgUart.c) + config.h.
            firmware/probes/ = bring-up sketches (gitignored)
server/     stelnet adapter: meteo.php (thin bootstrap), deploy.sh, dashboard.html, serial.html,
            config.example.php   (config.php, test_ci.py gitignored)
examples/   standalone/ = ready-to-run server for a normal PHP host (index.php + .htaccess)
docs/       A7672E datasheets, PCB schematic JSON + viewers, avr_cheatsheet.md
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

The backend is the **`Meteo\*` library** in `src/Meteo/` (one class per file): `Server` (router +
station POST + history/config API), `Store` (all file IO), `Payload` (binary decode + CRC),
`WebPush` (VAPID), `Ui` (dashboard/serial/PWA), `Admin` (key-gated edit/restore/wipe/gen_demo).

- `server/meteo.php` — **thin bootstrap** for the stelnet host: defines class `TestKurwa` (the path the framework routes to), autoloads `Meteo\*` from `FILE_DIR/src/Meteo`, and runs `(new \Meteo\Server($cfg))->handle()`. The web root can't take new files, so the library + UI + config all live in `FILE_DIR` (`/st/petro/tmp/meteo`, chmod 777).
- `dashboard.html` / `serial.html` — operator UI / Web-Serial calibration UI.
- `deploy.sh` — **no build step**: pushes `src/Meteo/*.php` (`?edit&file=X.php&src`), UI, and `config.php` into `FILE_DIR`, then the bootstrap to itself (`?edit`). Re-run after any edit.
- `config.example.php` → copy to `config.php` (gitignored): `EDIT_KEY` + VAPID keys, `require`d at runtime from `FILE_DIR`. Never in git.
- `examples/standalone/` — the same library wired for a normal host (no FILE_DIR trick).
- `test_ci.py` — Playwright UI/endpoint suite (gitignored).
- Lockout recovery: `php FILE_DIR/src/Meteo/smoke.php` validates the library loads; `?restore=1&key=` or a shell `cp …/TestKurwa.php.bak` restores the bootstrap.

### Deploy

Live endpoint `https://stelnet.stelweld.com.pl/petro/MeteoStation/TestKurwa` — **no `.php`** (adding it triggers a login redirect; the bare framework path bypasses session auth).

One-time host setup (a dir the web user can write — the web root can't create new files):
`mkdir -p /st/petro/tmp/meteo && chmod 777 /st/petro/tmp/meteo` (must match `FILE_DIR`).

```bash
cp server/config.example.php server/config.php   # fill EDIT_KEY + VAPID (gitignored)
./server/deploy.sh                               # pushes meteo.php + UI + config (no build)
```

`?edit=1` does a `php -l` check + keeps a `.bak`. Verify after: `?config=1` (JSON), `?ui=1`
(dashboard), `?push_selftest=1` (`"roundtrip":"OK"` = VAPID ok). On breakage: `?restore=1&key=…`.

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
