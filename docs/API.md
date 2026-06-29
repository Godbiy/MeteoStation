# MeteoStation HTTP API

Every request hits a single PHP entry point (`examples/standalone/index.php` on a normal host)
which builds `Meteo\Server` and calls `handle()`. The route is chosen by **HTTP method** + a
**query flag** (`?ui=1`, `?config=1`, …). There is no path routing and no `.php` in the URL.

- **Base URL** — the directory the firmware POSTs to, e.g. `https://your-host/meteo/`. All examples
  below are relative to it.
- **Method** — the station ingest is the only meaningful `POST` without a flag; everything the
  dashboard reads is `GET`. A few mutations are `POST` + flag (calibration, push subscribe).
- **CORS** — every response sends `Access-Control-Allow-Origin: *`; `OPTIONS` preflight is answered
  empty. `GET` responses are gzipped when the client sends `Accept-Encoding: gzip`.
- **Auth** — only admin routes are gated, by a shared secret: append `&key=EDIT_KEY` (the value in
  `config.php`). A wrong/absent key returns `401 bad key`. Nothing else is authenticated.
- **Caching** — JSON/UI routes send `Cache-Control: no-store` (assembled fresh each time); the PWA
  icons are the only cacheable responses.

Routing lives in [`backend/Server.php`](../backend/Server.php); handlers in `Api`, `Ui`, `WebPush`,
`Admin`.

---

## 1. Station ingest

### `POST /` (binary body, no flag)
The firmware's only call. The first byte (version) selects the decoder:

| Version byte | Meaning | Stored |
|---|---|---|
| `0x03` / `0x04` | regular batch (N samples) | appended to the history log |
| `0x10` / `0x11` | live single-sample snapshot | written to the live slot **and** appended as a 1-sample log entry |

Payload layout is documented in [`CLAUDE.md`](../CLAUDE.md#binary-payload-format) (CRC-8 Dallas/Maxim
trailer; bad CRC/length → `400 bad payload (len=…)`).

**Response** is plain text the firmware parses to pick up runtime config:
- batch: `ok avg=<M> n=<N> l=<0|1>` — averaging factor, sample count, live-mode flag
- live: `ok l=<0|1>`

---

## 2. Read / config API (`GET`, JSON)

### `?config=1`
Runtime config **plus** the connection state machine — the dashboard's primary poll. Merges
`Store::linkState()` (`state`/`pending`/`applied`/`cycle_eff_sec`/`next_expected_sec`/…) with:

`avg`, `samples`, `samples_max`, `live`, `cycle_seconds` (observed), `cycle_human`,
`intended_cycle_seconds`/`_human`, `last_timestamp`, `boot_timestamp`, `config_persisted`, and the
ground-truth facts from the last **regular** POST: `last_samples`, `last_cycle`, `last_batt_mv`,
`last_solar_mv`, `last_csq`, `last_raw_bytes`, `last_version`.

### `?since=<unixSec>` · `?range=<N[h|d|m|s]>` · *(no flag)*
History as a JSON array. One selector wins, in this order:

| Selector | Returns |
|---|---|
| `?since=TS` | entries with `timestamp > TS`. Add `&limit=N` (1–2000) to page the earliest N — the backfill cursor. |
| `?range=24h` | entries within the window. Suffix `h` hours (default), `d` days, `m` minutes, `s` seconds. |
| *(none)* | the last `limit` entries (`&limit`, default 20, max 500). |

Each entry is **enriched** server-side: `speed_mean`/`speed_max`/`speed_min`, `vane_freq[8]`,
`vane_mode` (0–7), `vane_mode_label` (`N`…`NW`). Modifiers:

- `&compact=1` — drop the raw `vane[]`/`speed[]` arrays (keep with `&keep_raw=1`).
- `&fmt=c` — short JSON keys (`timestamp`→`t`, `speed_mean`→`sm`, …) for smaller payloads.
- `&format=raw` — newline-delimited JSON (`text/plain`), one entry per line.
- `&stats=1` — skip entries, return a summary only: `count`, `last_*`, `log_path`, `log_exists`,
  `log_size_bytes`.

### `?live_now=1`
Latest live snapshot + `age_sec`. `{"ok":false,"reason":"no live data yet"}` if none.

### `?calib=1`
Current 8-point vane calibration table (JSON).

### `?set_avg=<M>` · `?set_samples=<N>` · `?set_live=<0|1>`
Update runtime config (values clamped server-side). Returns `{ok,<field>,note}`. The firmware applies
it on its **next POST** — these do not reach the station directly.

---

## 3. PWA / UI assets (`GET`)

| Route | Serves |
|---|---|
| `?ui=1` | the dashboard HTML, assembled from the `frontend/html/*` fragments in `Ui::ORDER` |
| `?asset=dashboard.css` | CSS assembled from `frontend/css/*` |
| `?asset=dashboard.js` | JS assembled from `frontend/js/*` |
| `?asset=<name>.{js,css,json}` | any other whitelisted single asset (e.g. `manifest.json`) |
| `?sw=1` | service worker (cache name stamped from the newest fragment mtime) |
| `?manifest=1` | PWA manifest |
| `?icon=1` | app icon (SVG) |
| `?icon_png&size=N` | app icon (PNG, GD-rendered, 48–1024, maskable) |
| `?dl_html=1` | the assembled dashboard as a downloadable `.html` file |

`__BUILD_VER__` and `__EDIT_KEY__` tokens are filled in at serve time.

---

## 4. Web Push (VAPID)

Subscribe/manage (`POST` JSON body unless noted):

| Route | Body / params | Purpose |
|---|---|---|
| `?push_pub=1` (GET) | — | VAPID public key for `pushManager.subscribe` |
| `POST ?push_subscribe` | `{subscription, cfg, label}` | register/replace a device; `cfg` holds per-device thresholds (`on`,`batt`,`wind`,`livePin`,`online`,`offlineMin`,`lang`) |
| `POST ?push_unsubscribe` | `{endpoint}` | drop by raw endpoint |
| `POST ?push_remove` | `{id}` | drop by the 12-char sha id from `?push_list` |
| `POST ?push_mute` | mute/unmute a device | |
| `?push_list=1` (GET) | — | registered devices (sha id, host, label, flags) — **no raw endpoints exposed** |

Diagnostics & content:

| Route | Purpose |
|---|---|
| `?push_selftest=1` | VAPID crypto round-trip — expect `"roundtrip":"OK"` |
| `?push_test=1` | send a real test push to every device, report each push-service HTTP status |
| `?push_testall=1` | broadcast variant |
| `?push_chart=batt\|wind` | PNG chart embedded in push notifications |
| `?push_icon=<type>` | notification icon (PNG) |

Alerts (battery / wind / solar-charge / back-online) fire from `WebPush::maybePush()` on each
regular POST. Thresholds are per-device in the subscription `cfg`, edited from the dashboard's
Alerts tab — there is no server-side alert config.

---

## 5. Push watchdog (time-based alerts, no POST needed)

"Station went silent / offline" and the auto-refreshing live-pin widget need a clock that ticks
without a station POST. Same idempotent code (`WebPush::tick()`), three drivers:

| Route | Driver |
|---|---|
| *(implicit)* | **lazy-tick** — piggy-backs on the dashboard's own GET polling (`tickIfDue(60)` in `Server::handle`); advances while any tab is open, zero cron |
| `?tick=1` | **external cron (recommended)** — point cron-job.org / UptimeRobot / a GitHub Actions `schedule:` at this URL every minute |
| `?daemon=1` | **self-relaying host worker** — a ~50s bounded worker that relays a baton to a fresh one; singleton via a `{ts,nonce}` lock. Host-only fallback. |
| `?daemon_status` | daemon liveness JSON |

---

## 6. Admin (require `&key=EDIT_KEY`)

| Route | Method | Action |
|---|---|---|
| `?edit=1` | POST (PHP body) | overwrite the entry-point file itself — `php -l` checked, `.bak` kept |
| `?edit=1&file=NAME[&src]` | POST (file body) | write a whitelisted file into the runtime dir: UI fragments (`.html/.css/.js/.json`), `config.php`, or library classes (`&src` → `src/Meteo/`). PHP gets a `php -l` check + `.bak`. |
| `?restore=1` | GET | restore the entry-point file from its `.bak` |
| `?wipe_log=1` | GET | clear the history log (keeps `.wipe.bak`) |
| `?save_calib` | POST (JSON) | overwrite the vane calibration (8 keys `N`…`NW`, values 0–255) |
| `?gen_demo=1` | GET | generate synthetic history. `&days=N` (1–60, def 30), `&interval=SEC` (≥60, def 900), `&clear=1` to replace |

> `?edit`/`?edit&file` are the self-deploy mechanism for locked-down shared hosts that can't take
> new files over FTP/SSH. On a normal host you don't need them — deploy with your usual tooling and
> leave the key unset to disable the route entirely.

---

## Quick smoke test

```bash
BASE=https://your-host/meteo
curl "$BASE/?config=1"                 # JSON config + connection state
curl "$BASE/?range=24h" | head         # last 24h of history
curl "$BASE/?push_selftest=1"          # expect "roundtrip":"OK"
curl "$BASE/?ui=1" | head              # dashboard HTML
```
