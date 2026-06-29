# Standalone server (the self-contained server path)

A ready-to-run MeteoStation server for any normal PHP host (Apache + mod_rewrite, or nginx with a
rewrite to `index.php`). It runs the exact same `Meteo\*` library in [`../../backend`](../../backend)
and serves the UI straight from [`../../frontend`](../../frontend) — **no build and no copy step**.

This is the server path the repo supports for everyone. (The production deploy to a specific
locked-down shared host lives in a private, gitignored `server/` adapter and is not part of the
public project.)

## Run it

```bash
cp config.example.php config.php     # fill EDIT_KEY + VAPID keys (gitignored)
```

Then either drop the `standalone/` directory on your host, or point a vhost docroot at it. Make
sure PHP can write to `data/` (created automatically), and point the firmware's `SERVER_URL` at the
directory, e.g. `https://your-host/meteo/`.

That's it — there is nothing to copy or compile. `index.php` points the server's `fileDir` at the
repo's `frontend/` tree; `Ui` resolves each named fragment from `frontend/html|css|js/` (and
`sw.js` + `manifest.json` from `frontend/`) and concatenates them on every request. To vendor the
UI instead (e.g. ship without the source tree), copy the fragments flat into any directory and set
`fileDir` to it.

## What you get

`index.php` wires paths + secrets and calls `(new Meteo\Server($cfg))->handle()`. The full route
reference is [`docs/API.md`](../../docs/API.md); the essentials:

- `?ui=1` — dashboard (vane calibration is a tab inside it)
- `POST` (binary) — station payload, logged to `data/log.ndjson`
- `?config=1`, `?since=`, `?range=` — config + connection state + history JSON
- `?sw=1`, `?manifest=1`, `?icon=1` — PWA (installable, offline)
- `?push_*` — web push (VAPID); `?push_selftest=1` should return `"roundtrip":"OK"`
- admin (`?edit`, `?wipe_log`, `?gen_demo`, `?save_calib`) require `&key=EDIT_KEY`

`.htaccess` routes everything to `index.php`, denies `config.php` + `data/`, and gzips responses.
Runtime data and `config.php` are gitignored.
