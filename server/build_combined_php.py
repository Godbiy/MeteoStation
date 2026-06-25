"""
Embed dashboard.html + serial.html into TestKurwa.php so server can serve UIs:
   ?ui=1         -> live HTTP-poll dashboard
   ?ui_serial=1  -> Web Serial debug page (reads COM port directly)
Output: TestKurwa_combined.php  (push via edit endpoint).
"""
import re, sys, json
from datetime import datetime, timezone

php_path    = 'server/meteo.php'
html_path   = 'server/dashboard.html'
serial_path = 'server/serial.html'
cfg_path    = 'server/config.json'
out_path    = 'server/meteo_combined.php'

php    = open(php_path,    encoding='utf8').read()
html   = open(html_path,   encoding='utf8').read()
serial = open(serial_path, encoding='utf8').read()

# Load secrets from the gitignored config.json (inlined at the very end, after the UI is
# embedded, so __EDIT_KEY__ inside the dashboard/serial HTML gets replaced too).
try:
    cfg = json.load(open(cfg_path, encoding='utf8'))
except FileNotFoundError:
    print(f"missing {cfg_path} -- copy server/config.example.json to it and fill in your secrets"); sys.exit(1)

# Stamp a build version into the UI so a phone can tell new-vs-stale at a glance.
build_ver = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
html   = html.replace('__BUILD_VER__', build_ver)
serial = serial.replace('__BUILD_VER__', build_ver)
# Bump the service-worker cache name each build so an old SW on a device updates.
php = php.replace("'__SW_CACHE__'", f"'meteo-shell-{build_ver}'")

marker_d = 'DASHBOARD_END_xQz9_MARKER'
marker_s = 'SERIAL_UI_END_xQz9_MARKER'
if marker_d in html or marker_s in serial:
    print("marker collision, abort"); sys.exit(1)

# Inject both routes in __construct dispatcher (after wipe_log line)
php = re.sub(
    r"(if \(isset\(\$_GET\['wipe_log'\]\)\) \{ \$this->handleWipeLog\(\); exit; \})",
    r"\1\n            if (isset($_GET['ui']))         { $this->handleUi(); exit; }"
    r"\n            if (isset($_GET['ui_serial']))  { $this->handleUiSerial(); exit; }",
    php, count=1,
)
if "handleUi" not in php or "handleUiSerial" not in php:
    print("failed to inject routes"); sys.exit(1)

handler = f"""
    /* GET ?ui=1 -- standalone HTTP-poll dashboard (live mode + post interval). */
    private function handleUi(): void
    {{
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        echo <<<'{marker_d}'
{html}
{marker_d};
        exit;
    }}

    /* GET ?ui_serial=1 -- Web Serial debug page. Reads COM port directly from
     * Chrome/Edge, no GSM needed. Best for live vane calibration. */
    private function handleUiSerial(): void
    {{
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        echo <<<'{marker_s}'
{serial}
{marker_s};
        exit;
    }}
"""

last_brace = php.rfind('}')
php = php[:last_brace] + handler + '\n' + php[last_brace:]

# Inline secrets LAST so placeholders inside the embedded dashboard/serial HTML are caught.
for tok in ('EDIT_KEY', 'VAPID_PUBLIC', 'VAPID_PRIVATE', 'VAPID_SUBJECT'):
    php = php.replace(f'__{tok}__', cfg.get(tok, ''))
if '__EDIT_KEY__' in php or '__VAPID_PRIVATE__' in php:
    print("a secret placeholder was left unreplaced -- aborting"); sys.exit(1)

open(out_path, 'w', encoding='utf8', newline='\n').write(php)
print(f"Wrote {out_path}, {len(php)} bytes")
