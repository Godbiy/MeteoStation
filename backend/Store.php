<?php
namespace Meteo;

/* All persistence: history log, runtime config, calibration, live snapshot, push
 * subscriptions/state. Paths come from $cfg so the standalone example can relocate them. */
final class Store
{
    public const AVG_OVER_DEFAULT = 1;
    public const AVG_OVER_MIN     = 1;
    public const AVG_OVER_MAX     = 32;
    public const SAMPLES_DEFAULT  = 150;   /* 5 min cycle at avg=1 */
    public const SAMPLES_MIN      = 10;
    public const SAMPLES_MAX      = 450;   /* must match firmware SAMPLE_COUNT */

    private string $log, $config, $calib, $live, $pushSubs, $pushState, $fileDir;

    public function __construct(array $cfg)
    {
        $this->log       = $cfg['log'];
        $this->config    = $cfg['config'];
        $this->calib     = $cfg['calib'];
        $this->live      = $cfg['live'];
        $this->pushSubs  = $cfg['pushSubs'];
        $this->pushState = $cfg['pushState'];
        $this->fileDir   = $cfg['fileDir'];
    }

    public function logPath(): string    { return $this->log; }
    public function configPath(): string { return $this->config; }
    public function calibPath(): string  { return $this->calib; }
    public function livePath(): string   { return $this->live; }
    public function fileDir(): string    { return $this->fileDir; }

    /* ---- Runtime config (avg / samples / live) ---- */

    public function loadConfig(): array
    {
        $cfg = ['avg' => self::AVG_OVER_DEFAULT, 'samples' => self::SAMPLES_DEFAULT, 'live' => 0, 'changed_at' => 0];
        if (file_exists($this->config)) {
            $j = @json_decode(@file_get_contents($this->config), true);
            if (is_array($j)) {
                if (isset($j['avg']))        $cfg['avg']        = $this->clampAvg((int)$j['avg']);
                if (isset($j['samples']))    $cfg['samples']    = $this->clampSamples((int)$j['samples']);
                if (isset($j['live']))       $cfg['live']       = $j['live'] ? 1 : 0;
                if (isset($j['changed_at'])) $cfg['changed_at'] = (int)$j['changed_at'];
            }
        }
        return $cfg;
    }
    /* Persist avg/samples/live and stamp `changed_at` only when a value actually changes —
     * that timestamp is the anchor linkState() uses to know a config change is in-flight
     * (pending) until the module confirms it on its next POST. */
    public function saveConfig(array $cfg): bool
    {
        $prev    = $this->loadConfig();
        $changed = ((int)$prev['avg'] !== (int)$cfg['avg'])
                || ((int)$prev['samples'] !== (int)$cfg['samples'])
                || ((int)$prev['live'] !== (int)($cfg['live'] ?? 0));
        $out = [
            'avg'        => $cfg['avg'],
            'samples'    => $cfg['samples'],
            'live'       => $cfg['live'] ?? 0,
            'changed_at' => $changed ? time() : (int)($prev['changed_at'] ?? 0),
        ];
        return (bool) @file_put_contents($this->config, json_encode($out) . "\n");
    }
    public function clampSamples(int $n): int
    {
        return max(self::SAMPLES_MIN, min(self::SAMPLES_MAX, $n));
    }
    public function clampAvg(int $n): int
    {
        return max(self::AVG_OVER_MIN, min(self::AVG_OVER_MAX, $n));
    }

    /* ---- History log ---- */

    public function appendLog(array $entry): bool
    {
        return @file_put_contents($this->log, json_encode($entry) . "\n", FILE_APPEND) !== false;
    }
    public function readAll(): array
    {
        return $this->readLines(PHP_INT_MAX);
    }
    public function readTail(int $maxLines): array
    {
        return $this->readLines($maxLines);
    }
    private function readLines(int $maxLines): array
    {
        if (!file_exists($this->log)) return [];
        $lines = @file($this->log, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!$lines) return [];
        if ($maxLines !== PHP_INT_MAX) $lines = array_slice($lines, -$maxLines);
        $out = [];
        foreach ($lines as $l) { $j = json_decode($l, true); if (is_array($j)) $out[] = $j; }
        return $out;
    }

    /* ---- Live snapshot ---- */

    public function writeLive(array $live): void { @file_put_contents($this->live, json_encode($live)); }
    public function readLive(): ?array
    {
        if (!file_exists($this->live)) return null;
        $j = @json_decode(@file_get_contents($this->live), true);
        return is_array($j) ? $j : null;
    }

    /* Convert a decoded live snapshot into a 1-sample history-log entry, so every live
     * snapshot also lands on the history charts. 'live'=1 marks it so the cycle-stat
     * helpers skip these (the ~3s cadence would crush the real cycle). */
    public function liveToLogEntry(array $live): array
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

    /* ---- Calibration ---- */

    public function loadCalib(): array
    {
        $out = ['calib' => null, 'updated' => null];
        if (file_exists($this->calib)) {
            $j = @json_decode(@file_get_contents($this->calib), true);
            if (is_array($j)) { $out['calib'] = $j['calib'] ?? null; $out['updated'] = $j['updated'] ?? null; }
        }
        return $out;
    }
    public function saveCalib(array $payload): bool
    {
        return (bool) @file_put_contents($this->calib, json_encode($payload));
    }

    /* ---- Web-push subscriptions + edge-trigger state ---- */

    public function loadPushSubs(): array
    {
        if (!file_exists($this->pushSubs)) return [];
        $j = json_decode(@file_get_contents($this->pushSubs), true);
        return is_array($j) ? $j : [];
    }
    public function savePushSubs(array $subs): bool
    {
        return @file_put_contents($this->pushSubs, json_encode(array_values($subs))) !== false;
    }
    public function loadPushState(): array
    {
        return json_decode(@file_get_contents($this->pushState), true) ?: [];
    }
    public function savePushState(array $state): void
    {
        @file_put_contents($this->pushState, json_encode($state));
    }

    /* ---- Cycle / uptime analytics (derived from the log) ---- */

    /* Most recent module boot = a cycle-counter reset between consecutive regular posts. */
    public function lastBootTimestamp(): ?string
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

    /* Median gap (s) between last 10 REGULAR entries = real observed cycle (live=1 skipped). */
    public function observedCycleSec(): ?int
    {
        $tail = $this->readTail(400);
        $reg = [];
        foreach ($tail as $e) { if (empty($e['live'])) $reg[] = $e; }
        $reg = array_slice($reg, -10);
        if (count($reg) < 2) return null;
        $stamps = [];
        foreach ($reg as $e) {
            if (!empty($e['timestamp'])) { $t = strtotime($e['timestamp']); if ($t) $stamps[] = $t; }
        }
        if (count($stamps) < 2) return null;
        sort($stamps);
        $gaps = [];
        for ($i = 1; $i < count($stamps); $i++) $gaps[] = $stamps[$i] - $stamps[$i-1];
        sort($gaps);
        return $gaps[(int)(count($gaps) / 2)];
    }

    /* Last REGULAR post timestamp (skips live=1 entries). */
    public function lastLogTimestamp(): ?string
    {
        $tail = $this->readTail(400);
        for ($i = count($tail) - 1; $i >= 0; $i--) {
            if (empty($tail[$i]['live'])) return $tail[$i]['timestamp'] ?? null;
        }
        return null;
    }

    /* Full last REGULAR log entry (skips live=1). Lets the Status tab show what the
     * module ACTUALLY reported last (samples received, cycle#, batt/solar/csq) instead
     * of inferring it — and confirm a pending config change against real data. */
    public function lastRegularEntry(): ?array
    {
        $tail = $this->readTail(400);
        for ($i = count($tail) - 1; $i >= 0; $i--) {
            if (empty($tail[$i]['live'])) return $tail[$i];
        }
        return null;
    }

    public function humanDuration(?int $sec): ?string
    {
        if (!$sec) return null;
        if ($sec < 60)   return $sec . ' s';
        if ($sec < 3600) return round($sec / 60, 1) . ' min';
        return round($sec / 3600, 1) . ' h';
    }

    /* ---- Connection / config state machine (single source of truth) ----
     *
     * Coarse link+config lifecycle consumed by BOTH the dashboard (banner/colour) and the
     * push watchdog (offline decision), so they never disagree. States:
     *   nodata       — no post yet
     *   online       — posting on schedule
     *   late         — overdue past the green window but inside the auto-reboot window (yellow)
     *   switching    — a config change the module hasn't CONFIRMED yet (calm, not offline)
     *   offline      — silent beyond the reboot window (red) → the push fires here
     *   live         — live mode, streaming
     *   live_pending — live mode requested, module hasn't entered the live loop yet
     *
     * "Applied" is ground-truth: a REGULAR post AFTER the change must report the new sample
     * count (avg-only / live toggles accept on the first fresh post — avg isn't in the payload).
     * While switching, late/offline math uses the LARGER of observed/intended cycle, so a
     * 15min→1min change can't false-alarm before the module has actually switched. Thresholds
     * mirror computeUptime(): green ≤ max(1.5C, C+30) · yellow ≤ +2C · red beyond. */
    public function linkState(): array
    {
        $cfg       = $this->loadConfig();
        $last      = $this->lastRegularEntry();
        $now       = time();
        $intended  = $cfg['samples'] * $cfg['avg'] * 2 + 15;
        $observed  = $this->observedCycleSec() ?: 0;
        $changedAt = (int)($cfg['changed_at'] ?? 0);
        $lastReg   = ($last && !empty($last['timestamp'])) ? strtotime($last['timestamp']) : 0;

        /* Freshest proof of life across BOTH a regular post AND the live snapshot, regardless
         * of the current mode flag. Crucial during a live↔normal switch: one source is briefly
         * stale (e.g. just entered live → no regular posts; just left live → live snapshot old),
         * and measuring against the stale one used to read as a dropped link → false offline. */
        $ref  = $lastReg;
        $live = $this->readLive();
        if ($live && !empty($live['timestamp'])) { $t = strtotime($live['timestamp']); if ($t && $t > $ref) $ref = $t; }
        $since = $ref ? $now - $ref : null;

        /* config-applied detection */
        $pending = false; $applied = true;
        if ($changedAt > 0) {
            $postAfter    = $ref > $changedAt;
            $samplesMatch = $last && ((int)($last['samples'] ?? -1) === (int)$cfg['samples']);
            $applied = $postAfter && $samplesMatch;
            $pending = !$applied;
        }

        /* effective cycle the module is really running */
        $base  = $observed ?: $intended;
        $cycle = $pending ? max($observed, $intended, $base) : $base;
        if ($cfg['live']) $cycle = 90;            /* live posts are frequent (3–60s over GSM) */
        if ($cycle < 20)  $cycle = $intended ?: 60;

        $greenMax  = max($cycle * 1.5, $cycle + 30);
        $yellowEnd = $greenMax + 2 * $cycle;
        $nextExp   = $ref ? max(0, ($ref + $cycle) - $now) : null;

        if ($since === null) {
            $state = 'nodata';
        } elseif ($since > $yellowEnd) {
            $state = 'offline';                   /* genuinely dead — even mid-switch */
        } elseif ($cfg['live']) {
            $state = ($since < $greenMax) ? 'live' : ($pending ? 'switching' : 'live_pending');
        } elseif ($pending) {
            $state = 'switching';                 /* calm amber, NOT a scary red */
        } elseif ($since > $greenMax) {
            $state = 'late';
        } else {
            $state = 'online';
        }

        return [
            'state'             => $state,
            'pending'           => $pending,
            'applied'           => $applied,
            'cycle_eff_sec'     => (int)round($cycle),
            'since_last_sec'    => $since,
            'next_expected_sec' => $nextExp !== null ? (int)round($nextExp) : null,
            'green_max_sec'     => (int)round($greenMax),
            'yellow_end_sec'    => (int)round($yellowEnd),
            'changed_at'        => $changedAt,
        ];
    }
}
