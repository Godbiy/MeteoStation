<?php
namespace Meteo;

/* Front controller: routes every request to the right component, handles the station's
 * binary POST, and serves the history/config API. Build with a $cfg array (paths + secrets)
 * and call handle(). See examples/standalone/index.php and the stelnet bootstrap. */
final class Server
{
    private Store $store;
    private WebPush $push;
    private Ui $ui;
    private Admin $admin;

    public function __construct(array $cfg)
    {
        $this->store = new Store($cfg);
        $this->push  = new WebPush($this->store, $cfg);
        $this->ui    = new Ui($cfg);
        $this->admin = new Admin($this->store, $cfg);
    }

    public function handle(): void
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

        /* gzip GET responses when the client supports it (3-5x smaller JSON on the wire). */
        if ($_SERVER['REQUEST_METHOD'] === 'GET' &&
            !ini_get('zlib.output_compression') &&
            strpos($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '', 'gzip') !== false) {
            @ob_start('ob_gzhandler');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $g = $_GET;
            if (isset($g['ui']))           { $this->ui->handleUi(); exit; }
            if (isset($g['ui_serial']))    { $this->ui->handleUiSerial(); exit; }
            if (isset($g['set_avg']))      { $this->handleSetAvg(); exit; }
            if (isset($g['set_samples']))  { $this->handleSetSamples(); exit; }
            if (isset($g['set_live']))     { $this->handleSetLive(); exit; }
            if (isset($g['live_now']))     { $this->handleLiveNow(); exit; }
            if (isset($g['config']))       { $this->handleConfig(); exit; }
            if (isset($g['dl_html']))      { $this->ui->handleDownloadHtml(); exit; }
            if (isset($g['restore']))      { $this->admin->handleRestore(); exit; }
            if (isset($g['gen_demo']))     { $this->admin->handleGenDemo(); exit; }
            if (isset($g['wipe_log']))     { $this->admin->handleWipeLog(); exit; }
            if (isset($g['calib']))        { $this->handleGetCalib(); exit; }
            if (isset($g['sw']))           { $this->ui->handlePwaSw(); exit; }
            if (isset($g['push_pub']))     { $this->push->handlePushPublic(); exit; }
            if (isset($g['push_selftest'])){ $this->push->handlePushSelftest(); exit; }
            if (isset($g['push_test']))    { $this->push->handlePushTest(); exit; }
            if (isset($g['push_testall'])) { $this->push->handlePushTestAll(); exit; }
            if (isset($g['push_list']))    { $this->push->handlePushList(); exit; }
            if (isset($g['push_chart']))   { $this->push->handlePushChart(); exit; }
            if (isset($g['manifest']))     { $this->ui->handlePwaManifest(); exit; }
            if (isset($g['icon']))         { $this->ui->handlePwaIcon(); exit; }
            if (isset($g['icon_png']))     { $this->ui->handlePwaIconPng(); exit; }
            if (isset($g['push_icon']))    { $this->push->handlePushIcon(); exit; }
            $this->handleGet();
            exit;
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['edit'])) {
            if (isset($_GET['file'])) { $this->admin->handleEditFile(); } else { $this->admin->handleEdit(); }
            exit;
        }
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['save_calib']))      { $this->admin->handleSaveCalib(); exit; }
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['push_subscribe']))  { $this->push->handlePushSubscribe(); exit; }
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['push_unsubscribe'])){ $this->push->handlePushUnsubscribe(); exit; }
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['push_remove']))     { $this->push->handlePushRemove(); exit; }
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['push_mute']))       { $this->push->handlePushMute(); exit; }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo "POST binary payload or GET to read log";
            exit;
        }

        $this->handleStationPost();
    }

    /* The station's binary POST: live single-sample (v0x10/0x11) or a regular batch (v0x03/04). */
    private function handleStationPost(): void
    {
        $raw = file_get_contents('php://input');

        if (strlen($raw) >= 9 && (ord($raw[0]) === 0x10 || ord($raw[0]) === 0x11)) {
            $live = Payload::decodeLive($raw);
            $cfg  = $this->store->loadConfig();
            if ($live) {
                $live['timestamp'] = date('Y-m-d H:i:s');
                $live['remote_ip'] = $_SERVER['REMOTE_ADDR'] ?? '?';
                $this->store->writeLive($live);
                /* Also append a 1-sample entry so each live snapshot lands on the charts. */
                $this->store->appendLog($this->store->liveToLogEntry($live));
            }
            echo "ok l=" . ($cfg['live'] ? 1 : 0);
            exit;
        }

        $data = Payload::decode($raw);
        if (!$data) { http_response_code(400); echo "bad payload (len=" . strlen($raw) . ")"; exit; }

        $data['timestamp'] = date('Y-m-d H:i:s');
        $data['remote_ip'] = $_SERVER['REMOTE_ADDR'] ?? '?';
        $data['raw_bytes'] = strlen($raw);
        $this->store->appendLog($data);
        $this->push->maybePush($data);

        /* Firmware parses "ok avg=N n=N l=N" — values from the runtime config. */
        $cfg = $this->store->loadConfig();
        echo "ok avg=" . $cfg['avg'] . " n=" . $cfg['samples'] . " l=" . ($cfg['live'] ? 1 : 0);
        exit;
    }

    /* ---- Config endpoints ---- */

    private function handleConfig(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $cfg      = $this->store->loadConfig();
        $obs      = $this->store->observedCycleSec();
        $intended = $cfg['samples'] * $cfg['avg'] * 2 + 15;   /* each raw read = 2s + ~15s GSM overhead */
        echo json_encode([
            'avg'                    => $cfg['avg'],
            'samples'                => $cfg['samples'],
            'samples_max'            => Store::SAMPLES_MAX,
            'live'                   => $cfg['live'],
            'cycle_seconds'          => $obs ?? 0,
            'cycle_human'            => $this->store->humanDuration($obs),
            'intended_cycle_seconds' => $intended,
            'intended_cycle_human'   => $this->store->humanDuration($intended),
            'last_timestamp'         => $this->store->lastLogTimestamp(),
            'boot_timestamp'         => $this->store->lastBootTimestamp(),
            'config_persisted'       => file_exists($this->store->configPath()),
        ]);
    }

    private function handleSetAvg(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $n = $this->store->clampAvg((int)$_GET['set_avg']);
        $cfg = $this->store->loadConfig(); $cfg['avg'] = $n;
        echo json_encode(['ok' => $this->store->saveConfig($cfg), 'avg' => $n, 'note' => 'Firmware picks it up on next POST']);
    }

    private function handleSetSamples(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $n = $this->store->clampSamples((int)$_GET['set_samples']);
        $cfg = $this->store->loadConfig(); $cfg['samples'] = $n;
        echo json_encode(['ok' => $this->store->saveConfig($cfg), 'samples' => $n, 'note' => 'Firmware picks it up on next POST']);
    }

    private function handleSetLive(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $v = ((int)$_GET['set_live']) ? 1 : 0;
        $cfg = $this->store->loadConfig(); $cfg['live'] = $v;
        echo json_encode(['ok' => $this->store->saveConfig($cfg), 'live' => $v, 'note' => 'Firmware enters/exits on next POST']);
    }

    private function handleLiveNow(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $j = $this->store->readLive();
        if ($j === null) { echo json_encode(['ok' => false, 'reason' => 'no live data yet']); return; }
        $age = 0;
        if (!empty($j['timestamp'])) { $t = strtotime($j['timestamp']); if ($t) $age = time() - $t; }
        $j['age_sec'] = $age; $j['ok'] = true;
        echo json_encode($j);
    }

    private function handleGetCalib(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        echo json_encode($this->store->loadCalib());
    }

    /* ---- History API (?since / ?range / ?limit, ?bin, ?compact, ?fmt=c, ?stats) ---- */

    private const COMPACT_KEYS = [
        'timestamp' => 't', 'batt_mv' => 'b', 'csq' => 'c', 'speed_mean' => 'sm', 'speed_max' => 'sx',
        'speed_min' => 'sn', 'vane_freq' => 'vf', 'vane_mode' => 'vm', 'vane_mode_label' => 'vl',
        'cycle' => 'cy', 'samples' => 'n', 'version' => 'v', 'vane' => 'va', 'speed' => 'sp',
        'bucket' => 'bk', 'count' => 'cn', 'batt_v' => 'bv', 'solar_mv' => 'sol', 'solar_v' => 'solv',
    ];
    private const COMPACT_DROP = ['remote_ip', 'raw_bytes'];

    private function handleGet(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');

        if (isset($_GET['since'])) {
            $since = (int)$_GET['since'];
            $entries = array_values(array_filter($this->store->readAll(),
                fn($e) => (isset($e['timestamp']) ? strtotime($e['timestamp']) : 0) > $since));
        } elseif (isset($_GET['range'])) {
            $cutoff = time() - $this->parseRange($_GET['range']);
            $entries = array_values(array_filter($this->store->readAll(),
                fn($e) => (isset($e['timestamp']) ? strtotime($e['timestamp']) : 0) >= $cutoff));
        } else {
            $limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 500) : 20;
            if ($limit < 1) $limit = 20;
            $entries = array_slice($this->store->readTail($limit * 4), -$limit);
        }
        $entries = array_values($entries);

        if (isset($_GET['stats'])) {
            $last = end($entries) ?: null;
            $log  = $this->store->logPath();
            echo json_encode([
                'count'          => count($entries),
                'last_timestamp' => $last['timestamp'] ?? null,
                'last_cycle'     => $last['cycle'] ?? null,
                'last_batt_mv'   => $last['batt_mv'] ?? null,
                'last_csq'       => $last['csq'] ?? null,
                'last_samples'   => $last['samples'] ?? null,
                'log_path'       => $log,
                'log_exists'     => file_exists($log),
                'log_size_bytes' => file_exists($log) ? filesize($log) : 0,
            ]);
            return;
        }

        $compact = isset($_GET['compact']);
        $entries = array_map(fn($e) => $this->enrichEntry($e, $compact), $entries);

        if (isset($_GET['bin'])) {
            $entries = $this->bucketAggregate($entries, max(60, (int)$_GET['bin']));
        }
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

    private function toCompactKeys(array $e): array
    {
        $out = [];
        foreach ($e as $k => $v) {
            if (in_array($k, self::COMPACT_DROP, true)) continue;
            $out[self::COMPACT_KEYS[$k] ?? $k] = $v;
        }
        return $out;
    }

    /* Parse "Nh", "Nd", "Nm", "Ns" -> seconds. Default 1 hour. */
    private function parseRange(string $s): int
    {
        if (preg_match('/^(\d+)\s*([hdms])?$/i', trim($s), $m)) {
            $n = (int)$m[1];
            switch (strtolower($m[2] ?? 'h')) {
                case 'd': return $n * 86400;
                case 'h': return $n * 3600;
                case 'm': return $n * 60;
                case 's': return $n;
            }
        }
        return 3600;
    }

    /* Add server-side aggregates: speed_mean/max/min, vane_mode(+label), vane_freq[8]. */
    private function enrichEntry(array $e, bool $compact = false): array
    {
        if (isset($e['speed']) && is_array($e['speed']) && count($e['speed']) > 0) {
            $sp = $e['speed']; $n = count($sp);
            $e['speed_mean'] = round(array_sum($sp) / $n, 2);
            $e['speed_max']  = max($sp);
            $e['speed_min']  = min($sp);
        } else {
            $e['speed_mean'] = 0; $e['speed_max'] = 0; $e['speed_min'] = 0;
        }
        $freq = array_fill(0, 8, 0);
        if (isset($e['vane']) && is_array($e['vane'])) {
            foreach ($e['vane'] as $v) {
                if ($v == 0xFF || $v == null) continue;
                for ($i = 0; $i < 8; $i++) { if (!($v & (1 << $i))) { $freq[$i]++; break; } }
            }
        }
        $e['vane_freq'] = $freq;
        $maxFreq = max($freq);
        $modeIdx = ($maxFreq > 0) ? array_search($maxFreq, $freq) : -1;
        $e['vane_mode'] = $modeIdx;
        $dirs = ['N','NE','E','SE','S','SW','W','NW'];
        $e['vane_mode_label'] = ($modeIdx >= 0) ? $dirs[$modeIdx] : '—';
        if ($compact && !isset($_GET['keep_raw'])) { unset($e['vane'], $e['speed']); }
        return $e;
    }

    /* Group entries into fixed time buckets; aggregate each bucket. */
    private function bucketAggregate(array $entries, int $binSec): array
    {
        $buckets = [];
        foreach ($entries as $e) {
            if (empty($e['timestamp'])) continue;
            $ts = strtotime($e['timestamp']);
            if (!$ts) continue;
            $buckets[intdiv($ts, $binSec) * $binSec][] = $e;
        }
        ksort($buckets);
        $out = [];
        $dirs = ['N','NE','E','SE','S','SW','W','NW'];
        foreach ($buckets as $bts => $items) {
            $batt    = array_filter(array_column($items, 'batt_mv'), 'is_numeric');
            $csqVals = array_filter(array_column($items, 'csq'), fn($v) => is_numeric($v) && $v !== 99);
            $spMean  = array_filter(array_column($items, 'speed_mean'), 'is_numeric');
            $spMax   = array_filter(array_column($items, 'speed_max'), 'is_numeric');
            $vaneFreq = array_fill(0, 8, 0);
            foreach ($items as $it) {
                if (isset($it['vane_freq']) && is_array($it['vane_freq'])) {
                    for ($i = 0; $i < 8; $i++) $vaneFreq[$i] += (int)($it['vane_freq'][$i] ?? 0);
                }
            }
            $maxFreq = max($vaneFreq);
            $modeIdx = ($maxFreq > 0) ? array_search($maxFreq, $vaneFreq) : -1;
            $out[] = [
                'timestamp'       => date('Y-m-d H:i:s', $bts),
                'bucket'          => true,
                'count'           => count($items),
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
}
