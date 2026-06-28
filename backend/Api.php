<?php
namespace Meteo;

/* The data plane: the station's binary POST (ingest) and the read/config HTTP API the
 * dashboard polls (history, runtime config, calibration, live snapshot). Persistence is
 * delegated to Store; alerts on a fresh POST go through WebPush. */
final class Api
{
    private Store $store;
    private WebPush $push;

    public function __construct(Store $store, WebPush $push)
    {
        $this->store = $store;
        $this->push  = $push;
    }

    /* The station's binary POST: live single-sample (v0x10/0x11) or a regular batch (v0x03/04). */
    public function handleStationPost(): void
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

    /* ---- Runtime config endpoints ---- */

    public function handleConfig(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $cfg      = $this->store->loadConfig();
        $obs      = $this->store->observedCycleSec();
        $intended = $cfg['samples'] * $cfg['avg'] * 2 + 15;   /* each raw read = 2s + ~15s GSM overhead */
        /* Ground-truth facts from the module's last REGULAR POST — the Status tab uses
         * these to SHOW what actually happened (samples received, cycle#, batt/csq) and
         * to confirm a pending config change against real data instead of guessing. */
        $last = $this->store->lastRegularEntry() ?? [];
        echo json_encode(array_merge([
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
            'last_samples'           => $last['samples']   ?? null,
            'last_cycle'             => $last['cycle']     ?? null,
            'last_batt_mv'           => $last['batt_mv']   ?? null,
            'last_solar_mv'          => $last['solar_mv']  ?? null,
            'last_csq'               => $last['csq']       ?? null,
            'last_raw_bytes'         => $last['raw_bytes'] ?? null,
            'last_version'           => $last['version']   ?? null,
        ], $this->store->linkState()));   /* state/pending/applied/cycle_eff_sec/next_expected_sec/… */
    }

    public function handleSetAvg(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $n = $this->store->clampAvg((int)$_GET['set_avg']);
        $cfg = $this->store->loadConfig(); $cfg['avg'] = $n;
        echo json_encode(['ok' => $this->store->saveConfig($cfg), 'avg' => $n, 'note' => 'Firmware picks it up on next POST']);
    }

    public function handleSetSamples(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $n = $this->store->clampSamples((int)$_GET['set_samples']);
        $cfg = $this->store->loadConfig(); $cfg['samples'] = $n;
        echo json_encode(['ok' => $this->store->saveConfig($cfg), 'samples' => $n, 'note' => 'Firmware picks it up on next POST']);
    }

    public function handleSetLive(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $v = ((int)$_GET['set_live']) ? 1 : 0;
        $cfg = $this->store->loadConfig(); $cfg['live'] = $v;
        echo json_encode(['ok' => $this->store->saveConfig($cfg), 'live' => $v, 'note' => 'Firmware enters/exits on next POST']);
    }

    public function handleLiveNow(): void
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

    public function handleGetCalib(): void
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

    public function handleGet(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');

        if (isset($_GET['since'])) {
            $since = (int)$_GET['since'];
            $entries = array_values(array_filter($this->store->readAll(),
                fn($e) => (isset($e['timestamp']) ? strtotime($e['timestamp']) : 0) > $since));
            if (isset($_GET['limit'])) {            /* page the backfill: earliest N after `since` */
                $lim = max(1, min(2000, (int)$_GET['limit']));
                $entries = array_slice($entries, 0, $lim);
            }
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
}
