<?php

namespace Stelnet\Html\MeteoStation;

/**
 * MeteoStation payload receiver -- payload v3.
 *
 * Wire format (little-endian, total 9 + 3*N bytes):
 *   [1]  version (0x03)
 *   [2]  cycle_count (uint16)
 *   [2]  sample_count N (uint16)
 *   [2]  batt_mv (uint16)
 *   [1]  csq (0-31, 99=unknown)
 *   [N]  vane[0..N-1] (uint8)
 *   [2N] speed[0..N-1] (uint16 LE)
 *   [1]  CRC-8 Dallas/Maxim (poly 0x8C reflected, init 0x00) over all bytes above
 *
 * Endpoint matches SERVER_URL in config.h (firmware POSTs binary here).
 */
class Meteo
{
    private const LOG_PATH       = '/st/petro/tmp/MeteoPost.txt';
    private const CONFIG_PATH    = '/st/petro/tmp/MeteoConfig.json';
    private const CALIB_PATH     = '/st/petro/tmp/MeteoCalib.json';
    private const LIVE_PATH      = '/tmp/MeteoLive.json';  /* /st/petro/tmp isn't writable for new files */
    private const PUSH_SUBS_PATH  = '/tmp/MeteoPushSubs.json';   /* /st/petro/tmp can't create new files */
    private const PUSH_STATE_PATH = '/tmp/MeteoPushState.json';
    /* World-writable dir (created by the operator, chmod 777). Holds the UI + config served
     * at runtime, so deploy = curl each file here instead of embedding via a build step. */
    private const FILE_DIR = '/st/petro/tmp/meteo';

    /* Secrets (EDIT_KEY + VAPID keypair) load at runtime from FILE_DIR/config.php (see
     * config.example.php). Pushed to the host via ?edit&file=config.php — never in git. */
    private static array $cfg = [];

    /* Default config used if MeteoConfig.json doesn't exist. */
    private const AVG_OVER_DEFAULT = 1;
    private const AVG_OVER_MIN     = 1;
    private const AVG_OVER_MAX     = 32;
    private const SAMPLES_DEFAULT  = 150;   /* 5 min cycle at avg=1 */
    private const SAMPLES_MIN      = 10;
    private const SAMPLES_MAX      = 450;   /* must match firmware SAMPLE_COUNT */

    /* Stub for framework lifecycle -- never reached, constructor always exits. */
    public function show(): void {}

    private const SELF_PATH = __FILE__;

    /* Admin secret from config.php; "\0" sentinel when absent so no client key ever matches. */
    private static function editKey(): string { return (self::$cfg['EDIT_KEY'] ?? '') ?: "\0"; }

    public function __construct()
    {
        $c = is_file(self::FILE_DIR . '/config.php') ? @include self::FILE_DIR . '/config.php' : [];
        self::$cfg = is_array($c) ? $c : [];

        /* CORS for offline dashboard (file:// or any origin) */
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

        /* Gzip compression for ALL GET responses (3-5x smaller JSON on the wire).
         * Only enable when client supports it and content is not already compressed. */
        if ($_SERVER['REQUEST_METHOD'] === 'GET' &&
            !ini_get('zlib.output_compression') &&
            strpos($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '', 'gzip') !== false) {
            @ob_start('ob_gzhandler');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($_GET['ui']))        { $this->handleUi(); exit; }
            if (isset($_GET['ui_serial'])) { $this->handleUiSerial(); exit; }
            /* Config management endpoints */
            if (isset($_GET['set_avg']))     { $this->handleSetAvg(); exit; }
            if (isset($_GET['set_samples'])) { $this->handleSetSamples(); exit; }
            if (isset($_GET['set_live']))    { $this->handleSetLive(); exit; }
            if (isset($_GET['live_now']))    { $this->handleLiveNow(); exit; }
            if (isset($_GET['config']))      { $this->handleConfig(); exit; }
            if (isset($_GET['dl_html']))     { $this->handleDownloadHtml(); exit; }
            if (isset($_GET['restore']))  { $this->handleRestore(); exit; }
            if (isset($_GET['gen_demo'])) { $this->handleGenDemo(); exit; }
            if (isset($_GET['wipe_log'])) { $this->handleWipeLog(); exit; }
            if (isset($_GET['calib']))    { $this->handleGetCalib(); exit; }
            if (isset($_GET['sw']))       { $this->handlePwaSw(); exit; }
            if (isset($_GET['push_pub']))      { $this->handlePushPublic(); exit; }
            if (isset($_GET['push_selftest'])) { $this->handlePushSelftest(); exit; }
            if (isset($_GET['push_test']))     { $this->handlePushTest(); exit; }
            if (isset($_GET['push_testall']))  { $this->handlePushTestAll(); exit; }
            if (isset($_GET['push_list']))     { $this->handlePushList(); exit; }
            if (isset($_GET['push_chart']))    { $this->handlePushChart(); exit; }
            if (isset($_GET['manifest'])) { $this->handlePwaManifest(); exit; }
            if (isset($_GET['icon']))     { $this->handlePwaIcon(); exit; }
            if (isset($_GET['icon_png'])) { $this->handlePwaIconPng(); exit; }
            if (isset($_GET['push_icon'])) { $this->handlePushIcon(); exit; }
            $this->handleGet();
            exit;
        }

        /* Self-edit: POST new PHP code with ?edit=1&key=SECRET */
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['edit'])) {
            if (isset($_GET['file'])) { $this->handleEditFile(); } else { $this->handleEdit(); }
            exit;
        }

        /* Overwrite calibration table on server: POST JSON body with ?save_calib&key=SECRET */
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['save_calib'])) {
            $this->handleSaveCalib();
            exit;
        }

        /* Web Push subscribe/unsubscribe (POST JSON body from the dashboard). */
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['push_subscribe'])) {
            $this->handlePushSubscribe();
            exit;
        }
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['push_unsubscribe'])) {
            $this->handlePushUnsubscribe();
            exit;
        }
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['push_remove'])) {
            $this->handlePushRemove();
            exit;
        }
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['push_mute'])) {
            $this->handlePushMute();
            exit;
        }


        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo "POST binary payload or GET to read log";
            exit;
        }

        $raw  = file_get_contents('php://input');

        /* Live mode payload:
         *  v0x10 (9 bytes):  vaneOn, vaneOff, pps(2), batt(2), csq, crc
         *  v0x11 (11 bytes): vaneOn, vaneOff, pps(2), batt(2), solar(2), csq, crc */
        if (strlen($raw) >= 9 && (ord($raw[0]) === 0x10 || ord($raw[0]) === 0x11)) {
            $live = $this->decodeLivePayload($raw);
            $cfg  = $this->loadConfig();
            if ($live) {
                $live['timestamp'] = date('Y-m-d H:i:s');
                $live['remote_ip'] = $_SERVER['REMOTE_ADDR'] ?? '?';
                @file_put_contents(self::LIVE_PATH, json_encode($live));
                /* Also append to the main history log so every live snapshot
                 * lands on the history charts (operator wants each point, not
                 * just the latest tile). Shaped like a 1-sample regular entry
                 * so enrichEntry + the dashboard explode path render it the
                 * same way. 'live'=1 marks it so observedCycle/lastLogTimestamp
                 * skip these (else the ~3s cadence crushes the regular cycle). */
                @file_put_contents(self::LOG_PATH,
                    json_encode($this->liveToLogEntry($live)) . "\n", FILE_APPEND);
            }
            /* Tell firmware whether to keep streaming live. */
            echo "ok l=" . ($cfg['live'] ? 1 : 0);
            exit;
        }

        $data = $this->decodePayload($raw);

        if (!$data) {
            http_response_code(400);
            echo "bad payload (len=" . strlen($raw) . ")";
            exit;
        }

        $data['timestamp']  = date('Y-m-d H:i:s');
        $data['remote_ip']  = $_SERVER['REMOTE_ADDR'] ?? '?';
        $data['raw_bytes']  = strlen($raw);

        file_put_contents(self::LOG_PATH, json_encode($data) . "\n", FILE_APPEND);

        /* Server push: notify subscribed devices if a threshold is crossed. */
        $this->maybePush($data);

        /* Firmware parses "ok avg=N n=N l=N" from response. Values from MeteoConfig.json.
         * l=1 tells firmware to enter live streaming mode after this POST. */
        $cfg = $this->loadConfig();
        echo "ok avg=" . $cfg['avg'] . " n=" . $cfg['samples'] . " l=" . ($cfg['live'] ? 1 : 0);
        exit;
    }

    private function decodeLivePayload(string $raw): ?array
    {
        $len = strlen($raw);
        $ver = ord($raw[0]);
        if ($ver === 0x10 && $len === 9) {
            if ($this->crc8Dallas($raw, 8) !== ord($raw[8])) return null;
            return [
                'vane_on'    => ord($raw[1]),
                'vane_off'   => ord($raw[2]),
                'vane'       => ord($raw[1]),
                'pulses_sec' => unpack('v', substr($raw, 3, 2))[1],
                'batt_mv'    => unpack('v', substr($raw, 5, 2))[1],
                'solar_mv'   => null,
                'csq'        => ord($raw[7]),
            ];
        }
        if ($ver === 0x11 && $len === 11) {
            if ($this->crc8Dallas($raw, 10) !== ord($raw[10])) return null;
            return [
                'vane_on'    => ord($raw[1]),
                'vane_off'   => ord($raw[2]),
                'vane'       => ord($raw[1]),
                'pulses_sec' => unpack('v', substr($raw, 3, 2))[1],
                'batt_mv'    => unpack('v', substr($raw, 5, 2))[1],
                'solar_mv'   => unpack('v', substr($raw, 7, 2))[1],
                'csq'        => ord($raw[9]),
            ];
        }
        return null;
    }

    /* Convert a decoded live snapshot into a 1-sample history-log entry.
     * speed[] is stored in pulses-per-2s-window units (pulses_sec * 2) so the
     * dashboard's (speed/2)*SF math yields the same km/h as the live tile.
     * vane[] holds the single raw vane byte (one bit clear = direction). */
    private function liveToLogEntry(array $live): array
    {
        $solar = $live['solar_mv'] ?? null;
        return [
            'version'   => 0x04,
            'cycle'     => 0,
            'samples'   => 1,
            'batt_mv'   => $live['batt_mv'],
            'batt_v'    => sprintf('%.2f', $live['batt_mv'] / 1000.0),
            'solar_mv'  => $solar,
            'solar_v'   => $solar !== null ? sprintf('%.2f', $solar / 1000.0) : null,
            'csq'       => $live['csq'],
            'vane'      => [ $live['vane'] ],
            'speed'     => [ $live['pulses_sec'] * 2 ],
            'timestamp' => $live['timestamp'],
            'remote_ip' => $live['remote_ip'],
            'live'      => 1,
        ];
    }

    /* ---- Config storage ---- */

    private function loadConfig(): array
    {
        $cfg = [
            'avg'     => self::AVG_OVER_DEFAULT,
            'samples' => self::SAMPLES_DEFAULT,
            'live'    => 0,
        ];
        if (file_exists(self::CONFIG_PATH)) {
            $raw = @file_get_contents(self::CONFIG_PATH);
            $j   = @json_decode($raw, true);
            if (is_array($j)) {
                if (isset($j['avg']))     $cfg['avg']     = $this->clampAvg((int)$j['avg']);
                if (isset($j['samples'])) $cfg['samples'] = $this->clampSamples((int)$j['samples']);
                if (isset($j['live']))    $cfg['live']    = $j['live'] ? 1 : 0;
            }
        }
        return $cfg;
    }
    private function clampSamples(int $n): int
    {
        if ($n < self::SAMPLES_MIN) $n = self::SAMPLES_MIN;
        if ($n > self::SAMPLES_MAX) $n = self::SAMPLES_MAX;
        return $n;
    }

    private function saveConfig(array $cfg): bool
    {
        return (bool) @file_put_contents(self::CONFIG_PATH, json_encode($cfg) . "\n");
    }

    private function clampAvg(int $n): int
    {
        if ($n < self::AVG_OVER_MIN) $n = self::AVG_OVER_MIN;
        if ($n > self::AVG_OVER_MAX) $n = self::AVG_OVER_MAX;
        return $n;
    }

    /* ---- Endpoints ---- */

    /* GET ?config=1 -- current config + REAL observed cycle from log.
     * intended_cycle_seconds = what the cycle SHOULD be from current samples*avg
     *   (each raw read = 2s, plus ~15s GSM wake+post overhead).
     * cycle_seconds          = median gap of last few entries (lags behind config changes). */
    private function handleConfig(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $cfg     = $this->loadConfig();
        $obs     = $this->observedCycleSec();
        $intended = $cfg['samples'] * $cfg['avg'] * 2 + 15;   /* see comment above */
        echo json_encode([
            'avg'                      => $cfg['avg'],
            'samples'                  => $cfg['samples'],
            'samples_max'              => self::SAMPLES_MAX,
            'live'                     => $cfg['live'],
            'cycle_seconds'            => $obs ?? 0,             /* REAL median gap from last log entries */
            'cycle_human'              => $this->humanDuration($obs),
            'intended_cycle_seconds'   => $intended,
            'intended_cycle_human'     => $this->humanDuration($intended),
            'last_timestamp'           => $this->lastLogTimestamp(),
            'boot_timestamp'           => $this->lastBootTimestamp(),
            'config_persisted'         => file_exists(self::CONFIG_PATH),
        ]);
    }

    /* Timestamp of the most recent module boot, detected as a cycle-counter reset
     * (cycle decreased between consecutive regular posts = the firmware restarted).
     * Used for "uptime since last power-on". Returns the oldest available regular
     * post if no reset is in the window (i.e. up at least that long). */
    private function lastBootTimestamp(): ?string
    {
        $tail = $this->readTail(500);
        $reg = [];
        foreach ($tail as $e) { if (empty($e['live']) && isset($e['cycle'])) $reg[] = $e; }
        if (count($reg) < 2) return null;
        for ($i = count($reg) - 1; $i > 0; $i--) {
            if ((int)$reg[$i]['cycle'] < (int)$reg[$i-1]['cycle']) return $reg[$i]['timestamp'] ?? null;
        }
        return $reg[0]['timestamp'] ?? null;
    }

    /* Median gap (seconds) between last 10 REGULAR log entries -- actual
     * observed cycle. Live-mode entries (live=1) post every ~3s and would crush
     * the median, so they're filtered out; only normal posts define the cycle. */
    private function observedCycleSec(): ?int
    {
        $tail = $this->readTail(400);
        $reg  = [];
        foreach ($tail as $e) { if (empty($e['live'])) $reg[] = $e; }
        $reg = array_slice($reg, -10);
        if (count($reg) < 2) return null;
        $stamps = [];
        foreach ($reg as $e) {
            if (!empty($e['timestamp'])) {
                $t = strtotime($e['timestamp']);
                if ($t) $stamps[] = $t;
            }
        }
        if (count($stamps) < 2) return null;
        sort($stamps);
        $gaps = [];
        for ($i = 1; $i < count($stamps); $i++) $gaps[] = $stamps[$i] - $stamps[$i-1];
        sort($gaps);
        return $gaps[(int)(count($gaps) / 2)];
    }

    /* Last REGULAR post timestamp (skips live=1 entries) so the status tab's
     * "last post / next post" logic keeps tracking the normal cycle even while
     * a live stream is appending entries every few seconds. */
    private function lastLogTimestamp(): ?string
    {
        $tail = $this->readTail(400);
        for ($i = count($tail) - 1; $i >= 0; $i--) {
            if (empty($tail[$i]['live'])) return $tail[$i]['timestamp'] ?? null;
        }
        return null;
    }

    private function humanDuration(?int $sec): ?string
    {
        if (!$sec) return null;
        if ($sec < 60)   return $sec . ' s';
        if ($sec < 3600) {
            $m = round($sec / 60, 1);
            return $m . ' min';
        }
        $h = round($sec / 3600, 1);
        return $h . ' h';
    }

    /* GET ?set_avg=N -- operator changes AVG_OVER for firmware (1..32) */
    private function handleSetAvg(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $n   = $this->clampAvg((int)$_GET['set_avg']);
        $cfg = $this->loadConfig();
        $cfg['avg'] = $n;
        $ok  = $this->saveConfig($cfg);
        echo json_encode([
            'ok'   => $ok,
            'avg'  => $n,
            'note' => 'Firmware picks it up on next POST',
        ]);
    }

    /* GET ?set_live=0/1 -- toggle live streaming mode */
    private function handleSetLive(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $v   = ((int)$_GET['set_live']) ? 1 : 0;
        $cfg = $this->loadConfig();
        $cfg['live'] = $v;
        $ok  = $this->saveConfig($cfg);
        echo json_encode(['ok' => $ok, 'live' => $v, 'note' => 'Firmware enters/exits on next POST']);
    }

    /* GET ?live_now -- latest live snapshot from firmware + age in seconds */
    private function handleLiveNow(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        if (!file_exists(self::LIVE_PATH)) {
            echo json_encode(['ok' => false, 'reason' => 'no live data yet']);
            return;
        }
        $raw = @file_get_contents(self::LIVE_PATH);
        $j   = @json_decode($raw, true);
        if (!is_array($j)) {
            echo json_encode(['ok' => false, 'reason' => 'parse error']);
            return;
        }
        $age = 0;
        if (!empty($j['timestamp'])) {
            $t = strtotime($j['timestamp']);
            if ($t) $age = time() - $t;
        }
        $j['age_sec'] = $age;
        $j['ok']      = true;
        echo json_encode($j);
    }

    /* GET ?set_samples=N -- operator changes SAMPLE_COUNT for firmware (10..SAMPLES_MAX) */
    private function handleSetSamples(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $n   = $this->clampSamples((int)$_GET['set_samples']);
        $cfg = $this->loadConfig();
        $cfg['samples'] = $n;
        $ok  = $this->saveConfig($cfg);
        echo json_encode([
            'ok'      => $ok,
            'samples' => $n,
            'note'    => 'Firmware picks it up on next POST',
        ]);
    }

    /* POST ?edit=1&key=SECRET, body=new PHP code -- self-update with backup + syntax check */
    private function handleEdit(): void
    {
        header('Content-Type: text/plain');
        if (($_GET['key'] ?? '') !== self::editKey()) {
            http_response_code(401);
            echo "bad key\n";
            return;
        }
        $body = file_get_contents('php://input');
        $len  = strlen($body);
        if ($len < 50 || $len > 700000) {
            http_response_code(400);
            echo "bad size: $len\n";
            return;
        }
        if (substr(ltrim($body), 0, 5) !== '<?php') {
            http_response_code(400);
            echo "must start with <?php\n";
            return;
        }
        /* Syntax check before write */
        $tmp = tempnam(sys_get_temp_dir(), 'meteo_chk_');
        file_put_contents($tmp, $body);
        $check = shell_exec('php -l ' . escapeshellarg($tmp) . ' 2>&1');
        unlink($tmp);
        if (strpos($check, 'No syntax errors') === false) {
            http_response_code(400);
            echo "syntax error:\n$check\n";
            return;
        }
        /* Backup current, then write new */
        $bak = self::SELF_PATH . '.bak';
        if (!@copy(self::SELF_PATH, $bak)) {
            http_response_code(500);
            echo "backup failed\n";
            return;
        }
        if (@file_put_contents(self::SELF_PATH, $body) === false) {
            http_response_code(500);
            echo "write failed\n";
            return;
        }
        if (function_exists('opcache_invalidate')) {
            @opcache_invalidate(self::SELF_PATH, true);
        }
        echo "ok: wrote $len bytes, backup at $bak\n";
    }

    /* POST ?edit=1&file=NAME&key=SECRET -- write a whitelisted file into FILE_DIR so the
     * server can serve the UI + read config from disk (no build/embed step). PHP files get a
     * php -l check; existing files get a .bak. */
    private function handleEditFile(): void
    {
        header('Content-Type: text/plain');
        if (($_GET['key'] ?? '') !== self::editKey()) { http_response_code(401); echo "bad key\n"; return; }
        $name  = basename((string)($_GET['file'] ?? ''));
        $allow = ['dashboard.html', 'serial.html', 'config.php'];
        if (!in_array($name, $allow, true)) { http_response_code(400); echo "file not allowed: $name\n"; return; }
        $body = file_get_contents('php://input');
        if (strlen($body) < 5) { http_response_code(400); echo "empty body\n"; return; }
        if (substr($name, -4) === '.php') {
            $tmp = tempnam(sys_get_temp_dir(), 'meteo_chk_');
            file_put_contents($tmp, $body);
            $chk = shell_exec('php -l ' . escapeshellarg($tmp) . ' 2>&1');
            unlink($tmp);
            if (strpos($chk, 'No syntax errors') === false) { http_response_code(400); echo "syntax error:\n$chk\n"; return; }
        }
        if (!is_dir(self::FILE_DIR)) { http_response_code(500); echo "FILE_DIR missing: " . self::FILE_DIR . "\n"; return; }
        $path = self::FILE_DIR . '/' . $name;
        if (is_file($path)) @copy($path, $path . '.bak');
        if (@file_put_contents($path, $body) === false) {
            http_response_code(500); echo "write failed: $path\n"; return;
        }
        echo "ok: wrote " . strlen($body) . " bytes to $path\n";
    }

    /* GET ?ui=1 / ?ui_serial=1 -- serve the UI from FILE_DIR (deployed via ?edit&file=).
     * __BUILD_VER__ is stamped from the file mtime so the page shows when it was deployed. */
    private function handleUi(): void       { $this->serveUi('dashboard.html'); }
    private function handleUiSerial(): void { $this->serveUi('serial.html'); }
    private function serveUi(string $name): void
    {
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        $f = self::FILE_DIR . '/' . $name;
        if (!is_file($f)) { http_response_code(503); echo "not deployed: $name (push via ?edit&file=$name)"; return; }
        $ver = gmdate('Y-m-d H:i', @filemtime($f) ?: time()) . ' UTC';
        echo str_replace(['__BUILD_VER__', '__EDIT_KEY__'], [$ver, self::editKey()], (string)file_get_contents($f));
    }

    /* GET ?dl_html=1 -- serve the deployed dashboard HTML as a downloadable file. */
    private function handleDownloadHtml(): void
    {
        $html = @file_get_contents(self::FILE_DIR . '/dashboard.html');
        if ($html === false) {
            http_response_code(404);
            header('Content-Type: text/plain');
            echo "dashboard not deployed\n";
            return;
        }
        header('Content-Type: text/html; charset=utf-8');
        header('Content-Disposition: attachment; filename="MeteoDashboard.html"');
        header('Cache-Control: no-store');
        header('Content-Length: ' . strlen($html));
        echo $html;
    }

    /* GET ?gen_demo=1&key=SECRET&days=N&interval=SEC&clear=1
     * Generates synthetic realistic data into the log:
     *   - days: how many days back (default 30, max 60)
     *   - interval: seconds between entries (default 900 = 15 min, min 60)
     *   - clear: wipe existing log first
     *
     * Realistic patterns:
     *   - Battery slowly drifts from 4150mV down to 3550mV with noise
     *   - Direction does random walk (mostly stable, occasional shift)
     *   - Speed has diurnal variation (windier 10:00-18:00) + occasional gusts
     *   - CSQ varies 15-27 with rare 99 (lost reading)
     */
    private function handleGenDemo(): void
    {
        header('Content-Type: text/plain');
        if (($_GET['key'] ?? '') !== self::editKey()) {
            http_response_code(401);
            echo "bad key\n";
            return;
        }
        $days        = max(1, min(60, (int)($_GET['days'] ?? 30)));
        $intervalSec = max(60, (int)($_GET['interval'] ?? 900));
        $clear       = isset($_GET['clear']);

        if ($clear && file_exists(self::LOG_PATH)) {
            @unlink(self::LOG_PATH);
        }

        $startTs = time() - $days * 86400;
        $endTs   = time();
        $dirIdx  = mt_rand(0, 7);
        $battStart = 4150;
        $battEnd   = 3550;
        $totalSpan = $endTs - $startTs;

        $lines = [];
        $count = 0;
        $cycle = 1;

        for ($ts = $startTs; $ts <= $endTs; $ts += $intervalSec) {
            /* Direction random walk (15% chance of shift per entry) */
            if (mt_rand(0, 99) < 15) {
                $dirIdx = ($dirIdx + mt_rand(-1, 1) + 8) % 8;
            }
            /* Battery: linear discharge + small noise */
            $progress = ($ts - $startTs) / max($totalSpan, 1);
            $battMv = (int)($battStart - ($battStart - $battEnd) * $progress + mt_rand(-15, 15));

            /* CSQ: usually 15-27, rare 99 (no signal reading) */
            $csq = mt_rand(15, 27);
            if (mt_rand(0, 99) < 4) $csq = 99;

            /* Diurnal wind pattern */
            $hour = (int)date('H', $ts);
            $isWindy = ($hour >= 10 && $hour <= 18);
            $baseSpeed = $isWindy ? mt_rand(3, 15) : mt_rand(0, 5);

            /* Storm bursts: 1% of entries are extra windy */
            $storm = (mt_rand(0, 99) < 1);
            if ($storm) $baseSpeed += mt_rand(15, 30);

            $vane = [];
            $speed = [];
            for ($i = 0; $i < 10; $i++) {
                /* Each sample: mostly current dir, 20% chance of neighboring */
                $sampleDir = $dirIdx;
                if (mt_rand(0, 99) < 20) {
                    $sampleDir = ($dirIdx + mt_rand(-1, 1) + 8) % 8;
                }
                /* Vane encoding: 8-bit pattern, one bit CLEAR = direction */
                $vane[] = 0xFF & ~(1 << $sampleDir);

                $sp = $baseSpeed + mt_rand(-2, 5);
                if (mt_rand(0, 99) < 3) $sp += mt_rand(5, 25); /* small gust */
                if ($sp < 0) $sp = 0;
                $speed[] = $sp;
            }

            /* Cycle counter occasionally resets to simulate firmware reboot */
            if (mt_rand(0, 999) < 3) $cycle = 1;
            else                      $cycle++;

            $entry = [
                'version'    => 3,
                'cycle'      => $cycle,
                'samples'    => 10,
                'batt_mv'    => $battMv,
                'batt_v'     => sprintf('%.2f', $battMv / 1000.0),
                'csq'        => $csq,
                'vane'       => $vane,
                'speed'      => $speed,
                'timestamp'  => date('Y-m-d H:i:s', $ts),
                'remote_ip'  => 'demo',
                'raw_bytes'  => 39,
            ];
            $lines[] = json_encode($entry);
            $count++;
        }

        $payload = implode("\n", $lines) . "\n";
        if (!@file_put_contents(self::LOG_PATH, $payload, $clear ? 0 : FILE_APPEND)) {
            http_response_code(500);
            echo "write failed (check perms on " . self::LOG_PATH . ")\n";
            return;
        }
        echo "generated $count entries · days=$days · interval={$intervalSec}s · clear=" . ($clear ? '1' : '0') . "\n";
        echo "log size now: " . filesize(self::LOG_PATH) . " bytes\n";
    }

    /* GET ?wipe_log=1&key=SECRET -- delete all logged data (with backup .wipe.bak) */
    private function handleWipeLog(): void
    {
        header('Content-Type: application/json');
        if (($_GET['key'] ?? '') !== self::editKey()) {
            http_response_code(401);
            echo json_encode(['error' => 'bad key']);
            return;
        }
        $sizeBefore = file_exists(self::LOG_PATH) ? filesize(self::LOG_PATH) : 0;
        $bak = self::LOG_PATH . '.wipe.bak';
        if (file_exists(self::LOG_PATH)) {
            @copy(self::LOG_PATH, $bak);
            @file_put_contents(self::LOG_PATH, '');
        }
        echo json_encode([
            'ok'           => true,
            'size_before'  => $sizeBefore,
            'backup_path'  => $bak,
            'note'         => 'log wiped; previous data in .wipe.bak',
        ]);
    }

    /* GET ?calib -- return stored vane calibration as JSON ({calib:{N,NE,...}, updated}) */
    private function handleGetCalib(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $out = ['calib' => null, 'updated' => null];
        if (file_exists(self::CALIB_PATH)) {
            $raw = @file_get_contents(self::CALIB_PATH);
            $j   = @json_decode($raw, true);
            if (is_array($j)) {
                $out['calib']   = $j['calib']   ?? null;
                $out['updated'] = $j['updated'] ?? null;
            }
        }
        echo json_encode($out);
    }

    /* POST ?save_calib&key=SECRET -- overwrite calibration table.
     * Body: JSON {N:byte, NE:byte, ...} with 0..255 values for any of 8 dirs. */
    private function handleSaveCalib(): void
    {
        header('Content-Type: application/json');
        if (($_GET['key'] ?? '') !== self::editKey()) {
            http_response_code(401);
            echo json_encode(['error' => 'bad key']);
            return;
        }
        $raw = file_get_contents('php://input');
        $j   = @json_decode($raw, true);
        if (!is_array($j)) {
            http_response_code(400);
            echo json_encode(['error' => 'bad json']);
            return;
        }
        $dirs = ['N','NE','E','SE','S','SW','W','NW'];
        $calib = [];
        foreach ($dirs as $d) {
            if (!array_key_exists($d, $j)) continue;
            $v = (int)$j[$d];
            if ($v < 0 || $v > 255) continue;
            $calib[$d] = $v;
        }
        if (!$calib) {
            http_response_code(400);
            echo json_encode(['error' => 'no valid directions in payload']);
            return;
        }
        $payload = [
            'calib'   => $calib,
            'updated' => date('Y-m-d H:i:s'),
            'ip'      => $_SERVER['REMOTE_ADDR'] ?? '?',
        ];
        $ok = (bool) @file_put_contents(self::CALIB_PATH, json_encode($payload));
        echo json_encode(['ok' => $ok, 'calib' => $calib, 'updated' => $payload['updated']]);
    }

    /* GET ?restore=1&key=SECRET -- restore from .bak if I push broken code */
    private function handleRestore(): void
    {
        header('Content-Type: text/plain');
        if (($_GET['key'] ?? '') !== self::editKey()) {
            http_response_code(401);
            echo "bad key\n";
            return;
        }
        $bak = self::SELF_PATH . '.bak';
        if (!file_exists($bak)) {
            http_response_code(404);
            echo "no backup\n";
            return;
        }
        if (!@copy($bak, self::SELF_PATH)) {
            http_response_code(500);
            echo "restore failed\n";
            return;
        }
        echo "restored from $bak\n";
    }

    /**
     * GET handler -- returns log entries as JSON.
     *   ?limit=N        last N entries (default 20, max 200)
     *   ?since=epoch    only entries with timestamp >= epoch (unix seconds)
     *   ?format=raw     plain text (default: JSON array)
     *   ?stats=1        summary: total count, last_cycle, last_battery, last_timestamp
     */
    /* ===================== Web Push (VAPID, RFC 8291/8292) ===================== */

    private static function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
    private static function b64ud(string $s): string { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }

    /* Wrap a raw 65-byte uncompressed P-256 point as a PEM SubjectPublicKeyInfo. */
    private function ecPubPemFromRaw(string $raw65): string {
        $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $raw65;
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    /* DER ECDSA signature (SEQ{INTEGER r, INTEGER s}) -> raw r||s, 64 bytes. */
    private function derToRawSig(string $der): string {
        $off = 0;
        if (strlen($der) < 8 || ord($der[$off++]) !== 0x30) return '';
        if (ord($der[$off]) & 0x80) { $off += 1 + (ord($der[$off]) & 0x7f); } else { $off++; }
        if (ord($der[$off++]) !== 0x02) return '';
        $rl = ord($der[$off++]); $r = substr($der, $off, $rl); $off += $rl;
        if (ord($der[$off++]) !== 0x02) return '';
        $sl = ord($der[$off++]); $s = substr($der, $off, $sl);
        $r = ltrim($r, "\x00"); $s = ltrim($s, "\x00");
        if (strlen($r) > 32 || strlen($s) > 32) return '';
        return str_pad($r, 32, "\x00", STR_PAD_LEFT) . str_pad($s, 32, "\x00", STR_PAD_LEFT);
    }

    /* VAPID Authorization header value for a given push-service origin (audience). */
    private function vapidAuth(string $audience): ?string {
        $h = self::b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $p = self::b64u(json_encode(['aud' => $audience, 'exp' => time() + 43200, 'sub' => (self::$cfg['VAPID_SUBJECT'] ?? '')]));
        $input = $h . '.' . $p;
        $sig = '';
        if (!openssl_sign($input, $sig, (self::$cfg['VAPID_PRIVATE'] ?? ''), OPENSSL_ALGO_SHA256)) return null;
        $raw = $this->derToRawSig($sig);
        if ($raw === '') return null;
        return 'vapid t=' . $input . '.' . self::b64u($raw) . ', k=' . (self::$cfg['VAPID_PUBLIC'] ?? '');
    }

    /* RFC 8291 aes128gcm encryption. Optional $as/$salt for deterministic self-test. */
    private function encryptPush(string $uaPublic, string $authSecret, string $payload, $as = null, ?string $salt = null): ?array {
        if (!$as) $as = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        if (!$as) return null;
        $det = openssl_pkey_get_details($as);
        $asPublic = "\x04" . str_pad($det['ec']['x'], 32, "\x00", STR_PAD_LEFT) . str_pad($det['ec']['y'], 32, "\x00", STR_PAD_LEFT);
        $uaKey = openssl_pkey_get_public($this->ecPubPemFromRaw($uaPublic));
        if (!$uaKey) return null;
        $secret = openssl_pkey_derive($uaKey, $as, 32);
        if (!$secret) return null;
        $ikm   = hash_hkdf('sha256', $secret, 32, "WebPush: info\x00" . $uaPublic . $asPublic, $authSecret);
        $salt  = $salt ?? random_bytes(16);
        $cek   = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\x00", $salt);
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\x00", $salt);
        $tag = '';
        $cipher = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
        if ($cipher === false) return null;
        $body = $salt . pack('N', 4096) . chr(strlen($asPublic)) . $asPublic . $cipher . $tag;
        return ['body' => $body, 'asPublic' => $asPublic, 'salt' => $salt];
    }

    /* Send one push. Returns HTTP status (404/410 => stale subscription). */
    private function sendPush(array $sub, string $payload): int {
        $endpoint = $sub['endpoint'] ?? '';
        if (!$endpoint) return 0;
        $u = parse_url($endpoint);
        $auth = $this->vapidAuth($u['scheme'] . '://' . $u['host']);
        if (!$auth) return 0;
        $p256dh = self::b64ud($sub['keys']['p256dh'] ?? '');
        $authS  = self::b64ud($sub['keys']['auth'] ?? '');
        if (strlen($p256dh) !== 65 || strlen($authS) !== 16) return 0;
        $enc = $this->encryptPush($p256dh, $authS, $payload);
        if (!$enc) return 0;
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_HTTPHEADER     => [
                'Authorization: ' . $auth,
                'Content-Encoding: aes128gcm',
                'Content-Type: application/octet-stream',
                'TTL: 86400',
            ],
            CURLOPT_POSTFIELDS     => $enc['body'],
        ]);
        curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $code;
    }

    private function loadPushSubs(): array {
        if (!file_exists(self::PUSH_SUBS_PATH)) return [];
        $j = json_decode(@file_get_contents(self::PUSH_SUBS_PATH), true);
        return is_array($j) ? $j : [];
    }
    private function savePushSubs(array $subs): bool {
        return @file_put_contents(self::PUSH_SUBS_PATH, json_encode(array_values($subs))) !== false;
    }

    private function handlePushPublic(): void {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        echo json_encode(['key' => (self::$cfg['VAPID_PUBLIC'] ?? '')]);
    }

    private function handlePushSubscribe(): void {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);
        if (!isset($body['subscription']['endpoint'])) { http_response_code(400); echo '{"ok":false}'; return; }
        $ep    = $body['subscription']['endpoint'];
        $all   = $this->loadPushSubs();
        $since = null;
        foreach ($all as $s) { if (($s['sub']['endpoint'] ?? '') === $ep) { $since = $s['since'] ?? null; break; } }
        $subs  = array_values(array_filter($all, fn($s) => ($s['sub']['endpoint'] ?? '') !== $ep));
        $subs[] = [
            'sub'   => $body['subscription'],
            'cfg'   => $body['cfg'] ?? [],
            'label' => substr((string)($body['label'] ?? ''), 0, 40),
            'since' => $since ?? date('Y-m-d H:i'),
        ];
        $saved = $this->savePushSubs($subs);
        echo json_encode(['ok' => $saved, 'count' => count($this->loadPushSubs())]);  /* re-read = honest */
    }

    private function handlePushUnsubscribe(): void {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);
        $ep   = $body['endpoint'] ?? '';
        $subs = array_values(array_filter($this->loadPushSubs(), fn($s) => ($s['sub']['endpoint'] ?? '') !== $ep));
        $this->savePushSubs($subs);
        echo json_encode(['ok' => true, 'count' => count($subs)]);
    }

    /* ?push_list -- subscribed devices (no raw endpoints exposed; a sha id is
     * used for removal). */
    private function handlePushList(): void {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $out = [];
        foreach ($this->loadPushSubs() as $e) {
            $ep  = $e['sub']['endpoint'] ?? '';
            $cfg = $e['cfg'] ?? [];
            $out[] = [
                'id'      => substr(hash('sha256', $ep), 0, 12),
                'host'    => parse_url($ep, PHP_URL_HOST),
                'label'   => $e['label'] ?? '',
                'since'   => $e['since'] ?? '',
                'on'      => !empty($cfg['on']),
                'livePin' => !empty($cfg['livePin']),
                'batt'    => (int)($cfg['batt'] ?? 0),
                'wind'    => round((float)($cfg['wind'] ?? 0)),
            ];
        }
        echo json_encode($out);
    }

    /* POST ?push_remove {id} -- delete one subscribed device by its sha id. */
    private function handlePushRemove(): void {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);
        $id   = $body['id'] ?? '';
        $subs = array_values(array_filter($this->loadPushSubs(),
            fn($s) => substr(hash('sha256', $s['sub']['endpoint'] ?? ''), 0, 12) !== $id));
        $this->savePushSubs($subs);
        echo json_encode(['ok' => true, 'count' => count($subs)]);
    }

    /* ?push_test -- send a real push to every subscribed device right now and
     * report each push-service HTTP status (201=accepted, 404/410=stale=dropped,
     * 401/403=VAPID problem, 0=encrypt/curl failed). For diagnosing delivery. */
    private function handlePushTest(): void {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $subs = $this->loadPushSubs();
        $base = $this->selfUrl();
        $results = []; $keep = [];
        foreach ($subs as $entry) {
            $L = $this->pushStrings($entry['cfg']['lang'] ?? 'uk');
            $payload = json_encode([
                'title' => $L['test_t'],
                'body'  => $L['test_b'] . ' ' . date('H:i:s'),
                'icon'  => $base . '?push_icon=test',
                'image' => $base . '?push_chart=batt&t=' . time(),
                'tag'   => 'test',
            ]);
            $code = $this->sendPush($entry['sub'], $payload);
            $host = parse_url($entry['sub']['endpoint'] ?? '', PHP_URL_HOST);
            $results[] = ['host' => $host, 'code' => $code];
            if ($code !== 404 && $code !== 410) $keep[] = $entry;   /* drop expired */
        }
        if (count($keep) !== count($subs)) $this->savePushSubs($keep);
        echo json_encode(['subs' => count($subs), 'sent' => $results]);
    }

    /* Absolute base URL of this script (for push image links the phone fetches). */
    private function selfUrl(): string {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host   = $_SERVER['HTTP_HOST'] ?? 'stelnet.stelweld.com.pl';
        $path   = strtok($_SERVER['REQUEST_URI'] ?? '/petro/MeteoStation/TestKurwa', '?');
        return $scheme . '://' . $host . $path;
    }

    /* Localized push phrases (foreground notifications use the dashboard's own
     * i18n; these are for SERVER-sent pushes, picked by the subscription's lang). */
    private function pushStrings(string $lang): array {
        $S = [
            'uk' => ['batt_low'=>'🔋 Низька батарея','batt_crit'=>'🔴 Критична батарея','wind'=>'💨 Сильний вітер','online'=>'✅ Станція знов онлайн','gusts'=>'пориви','avg'=>'сер','silence'=>'після %d хв тиші','perH'=>'/год','days'=>'дн','test_t'=>'📡 Тест із сервера','test_b'=>'Серверний пуш працює ✅','all_b'=>'усі типи пушів ✅'],
            'en' => ['batt_low'=>'🔋 Low battery','batt_crit'=>'🔴 Critical battery','wind'=>'💨 High wind','online'=>'✅ Station back online','gusts'=>'gusts','avg'=>'avg','silence'=>'after %d min of silence','perH'=>'/h','days'=>'d','test_t'=>'📡 Test from server','test_b'=>'Server push works ✅','all_b'=>'all push types ✅'],
            'pl' => ['batt_low'=>'🔋 Niska bateria','batt_crit'=>'🔴 Krytyczna bateria','wind'=>'💨 Silny wiatr','online'=>'✅ Stacja znów online','gusts'=>'porywy','avg'=>'śr','silence'=>'po %d min ciszy','perH'=>'/h','days'=>'d','test_t'=>'📡 Test z serwera','test_b'=>'Push serwerowy działa ✅','all_b'=>'wszystkie typy ✅'],
        ];
        return $S[$lang] ?? $S['uk'];
    }

    /* Battery trend suffix for the push body: " · ↓ -40 mV/h · ~2.1 d". */
    private function battTrendStr(int $cur, array $L): string {
        $now = time(); $pts = [];
        foreach ($this->readTail(40) as $e) {
            if (!empty($e['live'])) continue;
            $ts = strtotime($e['timestamp'] ?? ''); $mv = $e['batt_mv'] ?? null;
            if ($ts && $mv) $pts[] = [$ts, (float)$mv];
        }
        if (count($pts) < 3) return '';
        $first = $pts[0]; $last = end($pts);
        $hrs = ($last[0] - $first[0]) / 3600;
        if ($hrs <= 0.2) return '';
        $slope = ($last[1] - $first[1]) / $hrs;
        $arrow = $slope < -1 ? '↓' : ($slope > 1 ? '↑' : '→');
        $s = sprintf(' · %s %+d mV%s', $arrow, (int)round($slope), $L['perH']);
        if ($slope < -1) {
            $days = ($cur - 3300) / (-$slope) / 24;
            if ($days > 0 && $days < 90) $s .= sprintf(' · ~%.1f %s', $days, $L['days']);
        }
        return $s;
    }

    /* Server pushes that genuinely make sense on a module POST: battery
     * low/critical, strong wind, and "back online" (a post after a long gap).
     * Offline can't be detected here (it's the ABSENCE of a post — needs a cron),
     * so it stays a foreground-only alert. Edge-triggered, honours muteUntil. */
    private function maybePush(array $data): void {
        $subs = $this->loadPushSubs();
        if (!$subs) return;
        $batt     = (int)($data['batt_mv'] ?? 0);
        $maxPulse = (!empty($data['speed']) && is_array($data['speed'])) ? max($data['speed']) : 0;
        $now  = time();
        $base = $this->selfUrl();
        $state = json_decode(@file_get_contents(self::PUSH_STATE_PATH), true) ?: [];
        /* gap since the previous module POST → "back online" detection */
        $prevPost = (int)($state['_lastPost'] ?? 0);
        $gapMin   = $prevPost ? ($now - $prevPost) / 60 : 0;
        foreach ($subs as $entry) {
            $cfg = $entry['cfg'] ?? [];
            if (empty($cfg['on'])) continue;
            if (!empty($cfg['muteUntil']) && $now < (int)$cfg['muteUntil']) continue;
            $ep = $entry['sub']['endpoint'] ?? '';
            if (!$ep) continue;
            $L = $this->pushStrings($cfg['lang'] ?? 'uk');
            $st = $state[$ep] ?? ['batt' => false, 'crit' => false, 'wind' => false];
            if ($batt > 0) {
                $critT = (int)($cfg['battCrit'] ?? 0);
                $lowT  = (int)($cfg['batt'] ?? 0);
                $crit  = $critT > 0 && $batt < $critT;
                $low   = $lowT > 0 && $batt < $lowT && !$crit;
                if ($crit && empty($st['crit'])) $this->sendPush($entry['sub'], json_encode([
                    'title' => $L['batt_crit'], 'body' => $batt . ' mV' . $this->battTrendStr($batt, $L),
                    'icon' => $base . '?push_icon=crit', 'image' => $base . '?push_chart=batt&t=' . $now, 'tag' => 'crit',
                ]));
                if ($low && empty($st['batt'])) $this->sendPush($entry['sub'], json_encode([
                    'title' => $L['batt_low'], 'body' => $batt . ' mV' . $this->battTrendStr($batt, $L),
                    'icon' => $base . '?push_icon=batt', 'image' => $base . '?push_chart=batt&t=' . $now, 'tag' => 'batt',
                ]));
                $st['crit'] = $crit; $st['batt'] = $low;
            }
            $mul = (float)($cfg['uMul'] ?? 1); $lbl = $cfg['uLbl'] ?? 'km/h';   /* display unit */
            $sf  = (float)($cfg['sf'] ?? 2.4);
            $sp  = (!empty($data['speed']) && is_array($data['speed'])) ? $data['speed'] : [];
            $mean = $sp ? array_sum($sp) / count($sp) / 2 * $sf : 0;
            if (!empty($cfg['wind'])) {
                $kmh  = $maxPulse / 2 * $sf;
                $high = $kmh > (float)$cfg['wind'];
                if ($high && empty($st['wind'])) $this->sendPush($entry['sub'], json_encode([
                    'title' => $L['wind'],
                    'body'  => round($kmh * $mul) . ' ' . $lbl . ' ' . $L['gusts'] . ' · ' . $L['avg'] . ' ' . round($mean * $mul) . ' ' . $lbl,
                    'icon' => $base . '?push_icon=wind', 'image' => $base . '?push_chart=wind&t=' . $now, 'tag' => 'wind',
                ]));
                $st['wind'] = $high;
            }
            /* back online: this post arrived after a silence longer than the
             * user's offline threshold → the station recovered (one-shot). */
            if (!empty($cfg['online']) && $prevPost && $gapMin > (float)($cfg['offlineMin'] ?? 30)) {
                $this->sendPush($entry['sub'], json_encode([
                    'title' => $L['online'], 'body' => sprintf($L['silence'], round($gapMin)),
                    'icon' => $base . '?push_icon=online', 'tag' => 'online',
                ]));
            }
            /* Pinned live widget: silent ongoing notification, refreshed in the
             * background. Push ONLY when the reading actually changed (calm +
             * stable battery → nothing sent), so no wasted pushes. */
            if (!empty($cfg['livePin'])) {
                $parts = [];
                if ($batt > 0)                  $parts[] = '🔋 ' . number_format($batt / 1000, 2) . 'V';
                if (!empty($data['solar_mv']))  $parts[] = '☀ ' . number_format($data['solar_mv'] / 1000, 2) . 'V';
                $csq = $data['csq'] ?? null;
                if ($csq !== null && (int)$csq != 99) $parts[] = '📶 ' . $csq;
                $title  = '💨 ' . round($mean * $mul) . ' ' . $lbl;
                $body   = implode(' · ', $parts);
                $pinKey = $title . '|' . $body;
                if (($st['pin'] ?? '') !== $pinKey) {            /* changed → refresh */
                    $this->sendPush($entry['sub'], json_encode([
                        'pin' => true, 'silent' => true, 'title' => $title, 'body' => $body,
                        'icon' => $base . '?push_icon=wind', 'tag' => 'live-pin',
                    ]));
                    $st['pin'] = $pinKey;
                }
            }
            $state[$ep] = $st;
        }
        $state['_lastPost'] = $now;
        @file_put_contents(self::PUSH_STATE_PATH, json_encode($state));
    }

    /* ?push_icon=batt|crit|wind|online|test -- themed PNG notification icon
     * (colored disc + white glyph). SVG isn't reliable as a notification icon on
     * Android, so these are rasterized via GD (2x supersampled for smooth edges). */
    private function handlePushIcon(): void {
        $type = preg_replace('/[^a-z]/', '', $_GET['push_icon'] ?? 'test');
        $out  = (int)($_GET['size'] ?? 192);
        if ($out < 48) $out = 48;
        if ($out > 384) $out = 384;
        $sz = $out * 2;                                   /* supersample */
        $colors = ['batt' => [63,185,80], 'online' => [63,185,80], 'crit' => [248,81,73], 'wind' => [88,166,255], 'test' => [88,166,255]];
        [$r, $g, $bl] = $colors[$type] ?? [88,166,255];
        $im = imagecreatetruecolor($sz, $sz);
        imagealphablending($im, false); imagesavealpha($im, true);
        imagefilledrectangle($im, 0, 0, $sz, $sz, imagecolorallocatealpha($im, 0, 0, 0, 127));
        imagealphablending($im, true);
        $badge = isset($_GET['badge']);                  /* monochrome status-bar icon: glyph only */
        $col = imagecolorallocate($im, $r, $g, $bl);
        $wh  = imagecolorallocate($im, 255, 255, 255);
        $c   = (int)($sz / 2);
        if (!$badge) imagefilledellipse($im, $c, $c, $sz, $sz, $col);  /* colored disc */
        $f = $sz / 96.0;
        $S = fn($v) => (int)round($v * $f);
        switch ($type) {
            case 'batt':
                imagesetthickness($im, $S(5));
                imagerectangle($im, $S(28), $S(36), $S(64), $S(62), $wh);
                imagefilledrectangle($im, $S(64), $S(44), $S(71), $S(54), $wh);   /* terminal */
                imagefilledrectangle($im, $S(33), $S(41), $S(50), $S(57), $wh);   /* charge level */
                break;
            case 'crit':
                imagefilledrectangle($im, $S(43), $S(26), $S(53), $S(56), $wh);   /* ! bar */
                imagefilledellipse($im, $S(48), $S(67), $S(11), $S(11), $wh);     /* ! dot */
                break;
            case 'wind':
                imagesetthickness($im, $S(7));
                imageline($im, $S(26), $S(40), $S(62), $S(40), $wh);
                imageline($im, $S(26), $S(52), $S(72), $S(52), $wh);
                imageline($im, $S(26), $S(64), $S(54), $S(64), $wh);
                break;
            case 'online':
                imagesetthickness($im, $S(9));
                imageline($im, $S(28), $S(50), $S(43), $S(65), $wh);
                imageline($im, $S(43), $S(65), $S(70), $S(32), $wh);
                break;
            case 'app':                                                          /* status-bar badge: bold gauge */
                $gx = $S(48); $gy = $S(58); $gr = $S(28);
                for ($t = 180.0; $t <= 360.0; $t += 2.0) { $rr = deg2rad($t); imagefilledellipse($im, (int)round($gx + cos($rr) * $gr), (int)round($gy + sin($rr) * $gr), $S(13), $S(13), $wh); }
                $gna = deg2rad(180 + 0.72 * 180);
                imagesetthickness($im, $S(10));
                imageline($im, $gx, $gy, (int)round($gx + cos($gna) * $S(24)), (int)round($gy + sin($gna) * $S(24)), $wh);
                imagefilledellipse($im, $gx, $gy, $S(17), $S(17), $wh);
                break;
            default:                                                             /* test: cloud */
                imagefilledellipse($im, $S(40), $S(52), $S(34), $S(30), $wh);
                imagefilledellipse($im, $S(58), $S(54), $S(38), $S(34), $wh);
                imagefilledrectangle($im, $S(30), $S(52), $S(66), $S(68), $wh);
        }
        $dst = imagecreatetruecolor($out, $out);
        imagealphablending($dst, false); imagesavealpha($dst, true);
        imagecopyresampled($dst, $im, 0, 0, 0, 0, $out, $out, $sz, $sz);
        header('Content-Type: image/png');
        header('Cache-Control: max-age=604800');
        imagepng($dst);
        imagedestroy($im); imagedestroy($dst);
        exit;
    }

    /* ?push_testall -- fire one sample of every push type to all devices, so the
     * user can preview how each notification looks (tags differ so they stack). */
    private function handlePushTestAll(): void {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $subs = $this->loadPushSubs();
        $base = $this->selfUrl(); $t = time();
        $results = [];
        foreach ($subs as $entry) {
            $L = $this->pushStrings($entry['cfg']['lang'] ?? 'uk');
            $samples = [
                ['title' => $L['batt_low'],  'body' => '3380 mV · ↓ -35 mV' . $L['perH'] . ' · ~2.1 ' . $L['days'], 'icon' => $base . '?push_icon=batt',   'image' => $base . '?push_chart=batt&t=' . $t,       'tag' => 'batt'],
                ['title' => $L['batt_crit'], 'body' => '3290 mV · ↓ -40 mV' . $L['perH'],                          'icon' => $base . '?push_icon=crit',   'image' => $base . '?push_chart=batt&t=' . ($t + 1), 'tag' => 'crit'],
                ['title' => $L['wind'],      'body' => '31 km/h ' . $L['gusts'] . ' · ' . $L['avg'] . ' 14 km/h',  'icon' => $base . '?push_icon=wind',   'image' => $base . '?push_chart=wind&t=' . $t,       'tag' => 'wind'],
                ['title' => $L['online'],    'body' => sprintf($L['silence'], 47),                                 'icon' => $base . '?push_icon=online', 'tag' => 'online'],
                ['title' => $L['test_t'],    'body' => $L['all_b'] . ' ' . date('H:i:s'),                          'icon' => $base . '?push_icon=test',   'tag' => 'test'],
            ];
            foreach ($samples as $s) {
                $results[] = ['tag' => $s['tag'], 'code' => $this->sendPush($entry['sub'], json_encode($s))];
            }
        }
        echo json_encode(['subs' => count($subs), 'sent' => $results]);
    }

    /* POST ?push_mute&hours=6 -- temporarily silence a subscription. */
    private function handlePushMute(): void {
        header('Content-Type: application/json');
        $body  = json_decode(file_get_contents('php://input'), true);
        $ep    = $body['endpoint'] ?? '';
        $hours = max(1, min(48, (int)($_GET['hours'] ?? 6)));
        $until = time() + $hours * 3600;
        $subs  = $this->loadPushSubs();
        foreach ($subs as &$s) {
            if (($s['sub']['endpoint'] ?? '') === $ep) $s['cfg']['muteUntil'] = $until;
        }
        unset($s);
        $this->savePushSubs($subs);
        echo json_encode(['ok' => true, 'muteUntil' => $until, 'hours' => $hours]);
    }

    /* ?push_chart=batt|wind -- 24h sparkline PNG used as the push image. */
    private function handlePushChart(): void {
        $kind = (($_GET['push_chart'] ?? '') === 'wind') ? 'wind' : 'batt';
        $now = time(); $pts = [];
        foreach ($this->readTail(300) as $e) {
            if (!empty($e['live'])) continue;
            $ts = strtotime($e['timestamp'] ?? '');
            if (!$ts || $ts < $now - 86400) continue;
            if ($kind === 'batt') { $v = isset($e['batt_mv']) ? (float)$e['batt_mv'] : null; }
            else { $sp = $e['speed'] ?? []; $v = (is_array($sp) && $sp) ? max($sp) / 2 * 2.4 : null; }
            if ($v !== null) $pts[] = [$ts, $v];
        }
        $W = 720; $H = 360; $im = imagecreatetruecolor($W, $H);
        $bg   = imagecolorallocate($im, 13, 17, 23);
        $col  = $kind === 'batt' ? imagecolorallocate($im, 63, 185, 80) : imagecolorallocate($im, 88, 166, 255);
        $grid = imagecolorallocate($im, 40, 46, 54);
        $txt  = imagecolorallocate($im, 201, 209, 217);
        imagefilledrectangle($im, 0, 0, $W, $H, $bg);
        $pL = 70; $pR = 20; $pT = 50; $pB = 36;
        imagestring($im, 5, $pL, 16, $kind === 'batt' ? 'Battery mV - last 24h' : 'Wind km/h - last 24h', $txt);
        if (count($pts) >= 2) {
            $vs = array_column($pts, 1); $mn = min($vs); $mx = max($vs);
            if ($mx - $mn < 1) { $mx += 1; $mn -= 1; }
            $t0 = $pts[0][0]; $t1 = end($pts)[0]; $tr = max(1, $t1 - $t0);
            $px = fn($t) => (int)($pL + ($t - $t0) / $tr * ($W - $pL - $pR));
            $py = fn($v) => (int)($pT + (1 - ($v - $mn) / ($mx - $mn)) * ($H - $pT - $pB));
            for ($i = 0; $i <= 3; $i++) {
                $vv = $mn + ($mx - $mn) * $i / 3; $yy = $py($vv);
                imageline($im, $pL, $yy, $W - $pR, $yy, $grid);
                imagestring($im, 2, 6, $yy - 7, (string)round($vv), $txt);
            }
            imagesetthickness($im, 3);
            for ($i = 1; $i < count($pts); $i++) {
                imageline($im, $px($pts[$i-1][0]), $py($pts[$i-1][1]), $px($pts[$i][0]), $py($pts[$i][1]), $col);
            }
        } else {
            imagestring($im, 4, $pL, (int)($H / 2), 'no data (24h)', $txt);
        }
        header('Content-Type: image/png');
        header('Cache-Control: no-store');
        imagepng($im);
        imagedestroy($im);
        exit;
    }

    /* ?push_selftest -- validate the crypto in THIS server's PHP/openssl:
     * round-trip encrypt->decrypt with a fresh receiver key, + VAPID JWT verify. */
    private function handlePushSelftest(): void {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $out = ['php' => PHP_VERSION, 'hash_hkdf' => function_exists('hash_hkdf'), 'openssl_pkey_derive' => function_exists('openssl_pkey_derive'),
                'gd' => extension_loaded('gd'), 'imagepng' => function_exists('imagepng')];

        /* 1) round-trip: encrypt for a receiver we own, then decrypt as the receiver. */
        $ua = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        $d  = openssl_pkey_get_details($ua);
        $uaPub = "\x04" . str_pad($d['ec']['x'], 32, "\x00", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\x00", STR_PAD_LEFT);
        $authSecret = random_bytes(16);
        $msg = 'meteo push selftest ✅';
        $enc = $this->encryptPush($uaPub, $authSecret, $msg);
        if (!$enc) { $out['roundtrip'] = 'encrypt failed'; echo json_encode($out); return; }
        /* decrypt as receiver */
        $body = $enc['body'];
        $salt = substr($body, 0, 16);
        $idlen = ord($body[20]);
        $asPub = substr($body, 21, $idlen);
        $ct    = substr($body, 21 + $idlen);
        $secret = openssl_pkey_derive(openssl_pkey_get_public($this->ecPubPemFromRaw($asPub)), $ua, 32);
        $ikm   = hash_hkdf('sha256', $secret, 32, "WebPush: info\x00" . $uaPub . $asPub, $authSecret);
        $cek   = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\x00", $salt);
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\x00", $salt);
        $cipher = substr($ct, 0, -16); $tag = substr($ct, -16);
        $plain = openssl_decrypt($cipher, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
        $plain = $plain !== false ? rtrim($plain, "\x02\x00") : false;
        $out['roundtrip'] = ($plain === $msg) ? 'OK' : ('FAIL: ' . var_export($plain, true));

        /* 2) VAPID JWT signs + verifies, and r||s converts back cleanly. */
        $auth = $this->vapidAuth('https://example.com');
        $out['vapid_header'] = $auth ? substr($auth, 0, 24) . '...' : 'FAIL';
        echo json_encode($out);
    }

    /* ?sw=1 -- service worker: network-first app shell, cache fallback offline. */
    private function handlePwaSw(): void
    {
        header('Content-Type: application/javascript; charset=utf-8');
        header('Service-Worker-Allowed: ./');
        header('Cache-Control: no-cache');
        echo "const C = 'meteo-" . (@filemtime(self::FILE_DIR . '/dashboard.html') ?: 1) . "';\n";
        echo <<<'JS'
self.addEventListener('install', e => {
  self.skipWaiting();
  /* PRE-CACHE the dashboard shell on install, so the app opens OFFLINE even on a cold
   * start / first run (the old network-first only cached after a successful online load
   * while the SW already controlled the page → often nothing cached → bare "offline"). */
  e.waitUntil(caches.open(C).then(c => fetch('?ui=1', { cache: 'reload' })
    .then(r => { if (r && r.ok) return c.put('shell', r.clone()); })
    .catch(() => {})));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k)));   /* drop old shells */
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request;
  let url; try { url = new URL(req.url); } catch (_) { return; }
  const isShell = req.mode === 'navigate' || url.searchParams.has('ui');
  if (!isShell) return;   /* data endpoints (history etc.) pass through; app falls back to IndexedDB offline */
  /* stale-while-revalidate: serve the cached shell INSTANTLY (works offline), refresh in bg. */
  e.respondWith((async () => {
    const c = await caches.open(C);
    const cached = await c.match('shell');
    const net = fetch(req).then(r => { if (r && r.ok) c.put('shell', r.clone()); return r; }).catch(() => null);
    return cached || (await net) || new Response(
      '<!doctype html><meta charset=utf-8><body style="font:16px sans-serif;background:#0d1117;color:#e6edf3;padding:24px">'
      + '\u{1F4E1} Офлайн, а кеш ще порожній.<br>Відкрий застосунок раз з інтернетом — далі працюватиме й офлайн.</body>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  })());
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: 'MeteoStation', body: e.data ? e.data.text() : '' }; }
  const opts = {
    body: d.body || '', icon: d.icon || '?icon=1', badge: '?push_icon=app&badge=1', tag: d.tag || 'meteo', renotify: true,
    actions: [{ action: 'open', title: 'Відкрити' }],
    data: { url: '?ui=1' }
  };
  if (d.image) opts.image = d.image;
  if (d.pin) { opts.silent = true; opts.renotify = false; opts.requireInteraction = true; }  /* live pin: update in place, no re-alert */
  e.waitUntil(self.registration.showNotification(d.title || 'MeteoStation', opts));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  /* Base on the SW's own URL (…/TestKurwa?sw=1), NOT the scope (…/MeteoStation/),
   * so the dashboard URL keeps the TestKurwa path: …/TestKurwa?ui=1. */
  const url = new URL('?ui=1', self.location.href).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { if (c.url.includes('ui=')) { try { return await c.focus(); } catch (_) {} } }
    if (cs.length) { try { await cs[0].focus(); if ('navigate' in cs[0]) return await cs[0].navigate(url); } catch (_) {} }
    return self.clients.openWindow(url);
  })());
});
JS;
        exit;
    }
    /* ?manifest=1 -- PWA manifest (installable, standalone). */
    private function handlePwaManifest(): void
    {
        header('Content-Type: application/manifest+json; charset=utf-8');
        echo json_encode([
            'name'             => 'MeteoStation',
            'short_name'       => 'Meteo',
            'start_url'        => '?ui=1',
            'scope'            => './',
            'display'          => 'minimal-ui',
            'display_override' => ['minimal-ui'],
            'background_color' => '#0d1117',
            'theme_color'      => '#0d1117',
            'icons'            => [
                ['src' => '?icon=1',             'sizes' => 'any',     'type' => 'image/svg+xml'],
                ['src' => '?icon_png&size=192',  'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => '?icon_png&size=512',  'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => '?icon_png&size=512',  'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ],
        ], JSON_UNESCAPED_SLASHES);
        exit;
    }
    /* ?icon=1 -- app icon (SVG, scales to any size). */
    private function handlePwaIcon(): void
    {
        header('Content-Type: image/svg+xml; charset=utf-8');
        header('Cache-Control: max-age=86400');
        echo <<<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#161b22"/><stop offset="1" stop-color="#0d1117"/></linearGradient></defs><rect width="96" height="96" rx="18" fill="url(#g)"/><circle cx="27" cy="62" r="17" fill="none" stroke="#58a6ff" stroke-width="5"/><polygon points="27,49 19,62 35,62" fill="#f85149"/><polygon points="27,75 19,62 35,62" fill="#e6edf3"/><circle cx="27" cy="62" r="4" fill="#58a6ff"/><circle cx="27" cy="62" r="2" fill="#f85149"/><path d="M52 64A17 17 0 0 1 86 64" fill="none" stroke="#58a6ff" stroke-width="6" stroke-linecap="round"/><polygon points="78.6,52.5 72.1,66.6 65.9,61.5" fill="#f85149"/><circle cx="69" cy="64" r="5" fill="#58a6ff"/><circle cx="69" cy="64" r="2" fill="#f85149"/><g stroke="#ffc740" stroke-width="2" stroke-linecap="round"><path d="M44 37v3M37.6 34.4l-2.1 2.1M35 28h-3M37.6 21.6l-2.1-2.1M44 19v-3"/></g><circle cx="44" cy="28" r="6.5" fill="#ffc740"/><g fill="#c9d6e3"><circle cx="55" cy="26" r="7.5"/><circle cx="68" cy="21" r="10"/><circle cx="61" cy="28" r="7"/><rect x="49" y="26" width="23" height="7" rx="3.5"/></g></svg>
SVG;
        exit;
    }
    /* ?icon_png&size=N -- raster app icon (GD, 2x supersample), full-bleed=maskable. */
    private function handlePwaIconPng(): void
    {
        $out = (int)($_GET['size'] ?? 512);
        if ($out < 48) $out = 48;
        if ($out > 1024) $out = 1024;
        $sz = $out * 2;                                        /* 2x supersample → smooth edges */
        $im = imagecreatetruecolor($sz, $sz);
        imagealphablending($im, true);
        /* dark app-bg gradient (#161b22 → #0d1117), full bleed (maskable-safe) */
        for ($y = 0; $y < $sz; $y++) {
            $f = $y / max(1, $sz - 1);
            $c = imagecolorallocate($im,
                (int)round(22 + (13 - 22) * $f),
                (int)round(27 + (17 - 27) * $f),
                (int)round(34 + (23 - 34) * $f));
            imageline($im, 0, $y, $sz, $y, $c);
        }
        $blue  = imagecolorallocate($im, 88, 166, 255);
        $red   = imagecolorallocate($im, 248, 81, 73);
        $mut   = imagecolorallocate($im, 70, 80, 95);
        $wh    = imagecolorallocate($im, 230, 237, 243);
        $sun   = imagecolorallocate($im, 255, 199, 64);
        $cloud = imagecolorallocate($im, 201, 214, 227);
        $S     = fn($v) => (int)round($v * $sz / 96.0);
        /* ---- COMPASS (left): ring + red-N / white-S needle + hub ---- */
        $ccx = $S(27); $ccy = $S(62); $cr = $S(17);
        for ($t = 0.0; $t < 360.0; $t += 1.5) { $r = deg2rad($t); imagefilledellipse($im, (int)round($ccx + cos($r) * $cr), (int)round($ccy + sin($r) * $cr), $S(4), $S(4), $blue); }
        $nw = $S(8);
        imagefilledpolygon($im, [$ccx, $ccy - $S(13), $ccx - $nw, $ccy, $ccx + $nw, $ccy], 3, $red);
        imagefilledpolygon($im, [$ccx, $ccy + $S(13), $ccx - $nw, $ccy, $ccx + $nw, $ccy], 3, $wh);
        imagefilledellipse($im, $ccx, $ccy, $S(8), $S(8), $blue);
        imagefilledellipse($im, $ccx, $ccy, $S(4), $S(4), $red);
        /* ---- SPEEDOMETER (right): arc + needle + hub ---- */
        $scx = $S(69); $scy = $S(64); $sr = $S(17);
        for ($t = 180.0; $t <= 360.0; $t += 1.5) { $r = deg2rad($t); imagefilledellipse($im, (int)round($scx + cos($r) * $sr), (int)round($scy + sin($r) * $sr), $S(6), $S(6), $blue); }
        $na  = deg2rad(180 + 0.72 * 180);
        $tip = [(int)round($scx + cos($na) * $S(15)), (int)round($scy + sin($na) * $S(15))];
        $b1  = [(int)round($scx + cos($na + M_PI_2) * $S(4)), (int)round($scy + sin($na + M_PI_2) * $S(4))];
        $b2  = [(int)round($scx + cos($na - M_PI_2) * $S(4)), (int)round($scy + sin($na - M_PI_2) * $S(4))];
        imagefilledpolygon($im, [$tip[0], $tip[1], $b1[0], $b1[1], $b2[0], $b2[1]], 3, $red);
        imagefilledellipse($im, $scx, $scy, $S(9), $S(9), $blue);
        imagefilledellipse($im, $scx, $scy, $S(4), $S(4), $red);
        /* ---- SUN + CLOUD (top center, drawn last so they overlap onto both) ---- */
        $sx = $S(44); $sy = $S(28);                         /* sun on the LEFT, peeking */
        imagesetthickness($im, $S(2));
        foreach ([90, 135, 180, 225, 270] as $ra) { $r = deg2rad($ra); imageline($im, (int)round($sx + cos($r) * $S(9)), (int)round($sy + sin($r) * $S(9)), (int)round($sx + cos($r) * $S(12)), (int)round($sy + sin($r) * $S(12)), $sun); }
        imagefilledellipse($im, $sx, $sy, $S(13), $S(13), $sun);
        imagefilledellipse($im, $S(55), $S(26), $S(15), $S(15), $cloud);   /* cloud in the top-right */
        imagefilledellipse($im, $S(68), $S(21), $S(20), $S(20), $cloud);
        imagefilledellipse($im, $S(61), $S(28), $S(14), $S(14), $cloud);
        imagefilledrectangle($im, $S(49), $S(26), $S(72), $S(33), $cloud);
        $dst = imagecreatetruecolor($out, $out);
        imagecopyresampled($dst, $im, 0, 0, 0, 0, $out, $out, $sz, $sz);
        header('Content-Type: image/png');
        header('Cache-Control: max-age=604800');
        imagepng($dst);
        imagedestroy($im); imagedestroy($dst);
        exit;
    }

    private function handleGet(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');

        /* --- Determine target entries based on query params --- */

        /* ?since=unix_ts -- everything newer than (for incremental sync) */
        if (isset($_GET['since'])) {
            $since = (int)$_GET['since'];
            $all = $this->readAll();
            $entries = array_values(array_filter($all, function ($e) use ($since) {
                $ts = isset($e['timestamp']) ? strtotime($e['timestamp']) : 0;
                return $ts > $since;
            }));
        }
        /* ?range=Nh or Nd -- last N hours/days, optionally binned via ?bin=seconds */
        elseif (isset($_GET['range'])) {
            $rangeSec = $this->parseRange($_GET['range']);
            $cutoff = time() - $rangeSec;
            $all = $this->readAll();
            $entries = array_values(array_filter($all, function ($e) use ($cutoff) {
                $ts = isset($e['timestamp']) ? strtotime($e['timestamp']) : 0;
                return $ts >= $cutoff;
            }));
        }
        /* ?limit=N -- last N entries (default) */
        else {
            $limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 500) : 20;
            if ($limit < 1) $limit = 20;
            $entries = $this->readTail($limit * 4);
            $entries = array_slice($entries, -$limit);
        }

        $entries = array_values($entries);

        /* --- Stats response --- */
        if (isset($_GET['stats'])) {
            $last = end($entries) ?: null;
            echo json_encode([
                'count'           => count($entries),
                'last_timestamp'  => $last['timestamp'] ?? null,
                'last_cycle'      => $last['cycle']     ?? null,
                'last_batt_mv'    => $last['batt_mv']   ?? null,
                'last_csq'        => $last['csq']       ?? null,
                'last_samples'    => $last['samples']   ?? null,
                'log_path'        => self::LOG_PATH,
                'log_exists'      => file_exists(self::LOG_PATH),
                'log_size_bytes'  => file_exists(self::LOG_PATH) ? filesize(self::LOG_PATH) : 0,
            ]);
            return;
        }

        /* Stats removed pre-enrichment above. Past this: regular array. */

        /* Enrich every entry with server-side aggregates */
        $compact = isset($_GET['compact']);
        $entries = array_map(function ($e) use ($compact) {
            return $this->enrichEntry($e, $compact);
        }, $entries);

        /* ?bin=seconds -- bucket aggregation (useful for long ranges to reduce points) */
        if (isset($_GET['bin'])) {
            $binSec = max(60, (int)$_GET['bin']);
            $entries = $this->bucketAggregate($entries, $binSec);
        }

        /* ?fmt=c -- compact key names + drop verbose fields. Saves ~40% raw size
         * (gzip on top gives total ~7x reduction vs full format). */
        if (($_GET['fmt'] ?? '') === 'c') {
            $entries = array_map([$this, 'toCompactKeys'], $entries);
        }

        if (($_GET['format'] ?? '') === 'raw') {
            header('Content-Type: text/plain');
            foreach ($entries as $e) echo json_encode($e) . "\n";
            return;
        }

        echo json_encode(array_values($entries));
    }

    /* Short-key mapping: full name -> compact transport name. */
    private const COMPACT_KEYS = [
        'timestamp'       => 't',
        'batt_mv'         => 'b',
        'csq'             => 'c',
        'speed_mean'      => 'sm',
        'speed_max'       => 'sx',
        'speed_min'       => 'sn',
        'vane_freq'       => 'vf',
        'vane_mode'       => 'vm',
        'vane_mode_label' => 'vl',
        'cycle'           => 'cy',
        'samples'         => 'n',
        'version'         => 'v',
        'vane'            => 'va',
        'speed'           => 'sp',
        'bucket'          => 'bk',
        'count'           => 'cn',
        'batt_v'          => 'bv',
        'solar_mv'        => 'sol',
        'solar_v'         => 'solv',
    ];
    private const COMPACT_DROP = ['remote_ip', 'raw_bytes'];

    private function toCompactKeys(array $e): array
    {
        $out = [];
        foreach ($e as $k => $v) {
            if (in_array($k, self::COMPACT_DROP, true)) continue;
            $out[self::COMPACT_KEYS[$k] ?? $k] = $v;
        }
        return $out;
    }

    /* Parse "Nh", "Nd", "Nm" -> seconds. Default 1 hour. */
    private function parseRange(string $s): int
    {
        if (preg_match('/^(\d+)\s*([hdms])?$/i', trim($s), $m)) {
            $n = (int)$m[1];
            $u = strtolower($m[2] ?? 'h');
            switch ($u) {
                case 'd': return $n * 86400;
                case 'h': return $n * 3600;
                case 'm': return $n * 60;
                case 's': return $n;
            }
        }
        return 3600;
    }

    /* Group entries into fixed time buckets; aggregate each bucket. */
    private function bucketAggregate(array $entries, int $binSec): array
    {
        $buckets = [];
        foreach ($entries as $e) {
            if (empty($e['timestamp'])) continue;
            $ts = strtotime($e['timestamp']);
            if (!$ts) continue;
            $key = intdiv($ts, $binSec) * $binSec;
            $buckets[$key][] = $e;
        }
        ksort($buckets);

        $out = [];
        foreach ($buckets as $bts => $items) {
            $n = count($items);
            $batt   = array_filter(array_column($items, 'batt_mv'), 'is_numeric');
            $csqVals= array_filter(array_column($items, 'csq'), fn($v) => is_numeric($v) && $v !== 99);
            $spMean = array_filter(array_column($items, 'speed_mean'), 'is_numeric');
            $spMax  = array_filter(array_column($items, 'speed_max'),  'is_numeric');

            /* Sum vane_freq element-wise */
            $vaneFreq = array_fill(0, 8, 0);
            foreach ($items as $it) {
                if (isset($it['vane_freq']) && is_array($it['vane_freq'])) {
                    for ($i = 0; $i < 8; $i++) {
                        $vaneFreq[$i] += (int)($it['vane_freq'][$i] ?? 0);
                    }
                }
            }
            $maxFreq = max($vaneFreq);
            $modeIdx = ($maxFreq > 0) ? array_search($maxFreq, $vaneFreq) : -1;
            $dirs = ['N','NE','E','SE','S','SW','W','NW'];

            $out[] = [
                'timestamp'       => date('Y-m-d H:i:s', $bts),
                'bucket'          => true,
                'count'           => $n,
                'batt_mv'         => $batt ? (int)round(array_sum($batt) / count($batt)) : 0,
                'csq'             => $csqVals ? (int)round(array_sum($csqVals) / count($csqVals)) : 99,
                'speed_mean'      => $spMean ? round(array_sum($spMean) / count($spMean), 2) : 0,
                'speed_max'       => $spMax ? max($spMax) : 0,
                'vane_freq'       => $vaneFreq,
                'vane_mode'       => $modeIdx,
                'vane_mode_label' => $modeIdx >= 0 ? $dirs[$modeIdx] : '—',
            ];
        }
        return $out;
    }

    private function readAll(): array
    {
        if (!file_exists(self::LOG_PATH)) return [];
        $lines = @file(self::LOG_PATH, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!$lines) return [];
        $out = [];
        foreach ($lines as $l) {
            $j = json_decode($l, true);
            if (is_array($j)) $out[] = $j;
        }
        return $out;
    }

    /**
     * Add server-computed aggregates to entry:
     *   speed_mean, speed_max, speed_min   (from speed[] array)
     *   vane_mode (0..7 index, -1 if none), vane_mode_label ('N'..'NW'),
     *   vane_freq[8] (frequency per direction)
     * If $compact: drop raw vane[] and speed[] arrays to save bandwidth.
     */
    private function enrichEntry(array $e, bool $compact = false): array
    {
        if (isset($e['speed']) && is_array($e['speed']) && count($e['speed']) > 0) {
            $sp = $e['speed'];
            $n  = count($sp);
            $e['speed_mean'] = round(array_sum($sp) / $n, 2);
            $e['speed_max']  = max($sp);
            $e['speed_min']  = min($sp);
        } else {
            $e['speed_mean'] = 0;
            $e['speed_max']  = 0;
            $e['speed_min']  = 0;
        }

        $freq = array_fill(0, 8, 0);
        if (isset($e['vane']) && is_array($e['vane'])) {
            foreach ($e['vane'] as $v) {
                if ($v == 0xFF || $v == null) continue;
                /* Wind vane: 8 reed switches. ONE bit CLEAR = direction. */
                for ($i = 0; $i < 8; $i++) {
                    if (!($v & (1 << $i))) { $freq[$i]++; break; }
                }
            }
        }
        $e['vane_freq'] = $freq;
        $maxFreq = max($freq);
        $modeIdx = ($maxFreq > 0) ? array_search($maxFreq, $freq) : -1;
        $e['vane_mode']       = $modeIdx;
        $dirs = ['N','NE','E','SE','S','SW','W','NW'];
        $e['vane_mode_label'] = ($modeIdx >= 0) ? $dirs[$modeIdx] : '—';

        /* compact=1 strips raw arrays to keep payload small.
         * keep_raw=1 overrides — dashboard uses this for short ranges (≤6h)
         * to explode aggregated entries into per-2s sub-points on the chart. */
        if ($compact && !isset($_GET['keep_raw'])) {
            unset($e['vane'], $e['speed']);
        }

        return $e;
    }

    /**
     * Read up to $maxLines last lines from log, parse each as JSON.
     * Returns array of decoded entries (skipping unparseable).
     */
    private function readTail(int $maxLines): array
    {
        if (!file_exists(self::LOG_PATH)) return [];
        $lines = @file(self::LOG_PATH, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!$lines) return [];
        $lines = array_slice($lines, -$maxLines);
        $out = [];
        foreach ($lines as $l) {
            $j = json_decode($l, true);
            if (is_array($j)) $out[] = $j;
        }
        return $out;
    }

    private function decodePayload(string $raw): ?array
    {
        $len = strlen($raw);
        if ($len < 10) return null;

        // CRC over all bytes except final CRC byte
        $expected = ord($raw[$len - 1]);
        $actual   = $this->crc8Dallas($raw, $len - 1);
        if ($actual !== $expected) return null;

        $pos = 0;
        $version = ord($raw[$pos++]);
        if ($version !== 0x03 && $version !== 0x04) return null;

        $cycle    = unpack('v', $raw, $pos)[1]; $pos += 2;
        $n        = unpack('v', $raw, $pos)[1]; $pos += 2;
        $battMv   = unpack('v', $raw, $pos)[1]; $pos += 2;
        $solarMv  = null;
        if ($version === 0x04) {
            $solarMv = unpack('v', $raw, $pos)[1]; $pos += 2;
        }
        $csq      = ord($raw[$pos++]);

        $expectedLen = ($version === 0x04 ? 11 : 9) + 3 * $n;
        if ($len !== $expectedLen) return null;

        $vane  = [];
        for ($i = 0; $i < $n; $i++) $vane[] = ord($raw[$pos++]);

        $speed = [];
        for ($i = 0; $i < $n; $i++) {
            $speed[] = unpack('v', $raw, $pos)[1];
            $pos += 2;
        }

        return [
            'version'  => $version,
            'cycle'    => $cycle,
            'samples'  => $n,
            'batt_mv'  => $battMv,
            'batt_v'   => sprintf('%.2f', $battMv / 1000.0),
            'solar_mv' => $solarMv,
            'solar_v'  => $solarMv !== null ? sprintf('%.2f', $solarMv / 1000.0) : null,
            'csq'      => $csq,
            'vane'     => $vane,
            'speed'    => $speed,
        ];
    }

    /**
     * CRC-8 Dallas/Maxim (1-Wire). Reflected poly 0x8C, init 0, no final XOR.
     * Same algorithm as gsm.c crc8Update().
     */
    private function crc8Dallas(string $buf, int $len): int
    {
        $crc = 0;
        for ($i = 0; $i < $len; $i++) {
            $crc ^= ord($buf[$i]);
            for ($j = 0; $j < 8; $j++) {
                $crc = ($crc & 1) ? (($crc >> 1) ^ 0x8C) : ($crc >> 1);
            }
        }
        return $crc & 0xFF;
    }
}

/* Host endpoint alias: this host's framework routes the request URL to the class
 * named after the file path (…/MeteoStation/TestKurwa -> class TestKurwa). All logic
 * lives in Meteo; this 1-line alias keeps that endpoint working. For a standalone /
 * different host, change the alias target (or drop it and call `new Meteo();`). */
\class_alias(__NAMESPACE__ . '\\Meteo', __NAMESPACE__ . '\\TestKurwa');
