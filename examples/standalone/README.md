# Standalone server example

A ready-to-run MeteoStation server for any normal PHP host (Apache + mod_rewrite, or nginx
with a rewrite to `index.php`). It uses the `Meteo\*` library in [`../../src`](../../src) — the
same code the production stelnet adapter runs.

## Run it

```bash
cp config.example.php config.php        # fill EDIT_KEY + VAPID keys (gitignored)
cp ../../src/ui/dashboard.html public/  # the operator UI
cp ../../src/ui/serial.html    public/  # calibration UI (also embedded as the dashboard's Serial tab)
```

Drop the whole `standalone/` directory on your host (or set the vhost docroot to it), make sure
PHP can write to `data/`, then point the firmware's `SERVER_URL` at the directory, e.g.
`https://your-host/meteo/`.

## What you get

`index.php` wires paths + secrets and calls `(new Meteo\Server($cfg))->handle()`. Endpoints:

- `?ui=1` dashboard · `?ui_serial=1` calibration UI
- `POST` (binary) — station payload, logged to `data/log.ndjson`
- `?config=1`, `?since=`, `?range=`, `?stats=1` — config + history JSON
- `?sw=1`, `?manifest=1`, `?icon=1` — PWA (installable, offline)
- `?push_*` — web push (VAPID); `?push_selftest=1` should return `"roundtrip":"OK"`
- admin (`?edit`, `?wipe_log`, `?gen_demo`, `?save_calib`) require `&key=EDIT_KEY`

`.htaccess` routes everything to `index.php`, denies `config.php` + `data/` + `src/`, and gzips
responses. Runtime data and `config.php` are gitignored.
