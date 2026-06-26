<?php
namespace Meteo;

/* Key-gated admin endpoints: self-edit (push new PHP / files), restore, wipe log, demo data,
 * calibration save. The shared secret is editKey; "\0" sentinel when config is missing so an
 * empty client key never matches. */
final class Admin
{
    private Store $store;
    private string $selfPath, $fileDir, $editKey;

    public function __construct(Store $store, array $cfg)
    {
        $this->store    = $store;
        $this->selfPath = $cfg['selfPath'];
        $this->fileDir  = $cfg['fileDir'];
        $this->editKey  = ($cfg['EDIT_KEY'] ?? '') ?: "\0";
    }

    private function badKey(): bool { return (($_GET['key'] ?? '') !== $this->editKey); }

    /* POST ?edit=1&key=SECRET, body=new PHP code -- self-update with backup + syntax check. */
    public function handleEdit(): void
    {
        header('Content-Type: text/plain');
        if ($this->badKey()) { http_response_code(401); echo "bad key\n"; return; }
        $body = file_get_contents('php://input');
        $len  = strlen($body);
        if ($len < 50 || $len > 700000) { http_response_code(400); echo "bad size: $len\n"; return; }
        if (substr(ltrim($body), 0, 5) !== '<?php') { http_response_code(400); echo "must start with <?php\n"; return; }
        $tmp = tempnam(sys_get_temp_dir(), 'meteo_chk_');
        file_put_contents($tmp, $body);
        $check = shell_exec('php -l ' . escapeshellarg($tmp) . ' 2>&1');
        unlink($tmp);
        if (strpos($check, 'No syntax errors') === false) { http_response_code(400); echo "syntax error:\n$check\n"; return; }
        $bak = $this->selfPath . '.bak';
        if (!@copy($this->selfPath, $bak)) { http_response_code(500); echo "backup failed\n"; return; }
        if (@file_put_contents($this->selfPath, $body) === false) { http_response_code(500); echo "write failed\n"; return; }
        if (function_exists('opcache_invalidate')) @opcache_invalidate($this->selfPath, true);
        echo "ok: wrote $len bytes, backup at $bak\n";
    }

    /* POST ?edit=1&file=NAME&key=SECRET -- write a whitelisted file into FILE_DIR (the UI +
     * config + library sources the server reads at runtime). PHP files get a php -l check. */
    public function handleEditFile(): void
    {
        header('Content-Type: text/plain');
        if ($this->badKey()) { http_response_code(401); echo "bad key\n"; return; }
        $name = basename((string)($_GET['file'] ?? ''));
        $allow = ['dashboard.html', 'serial.html', 'config.php'];
        $isSrc = (bool)preg_match('/^[A-Za-z][A-Za-z0-9]*\.php$/', $name) && isset($_GET['src']);
        if (!in_array($name, $allow, true) && !$isSrc) { http_response_code(400); echo "file not allowed: $name\n"; return; }
        $body = file_get_contents('php://input');
        if (strlen($body) < 5) { http_response_code(400); echo "empty body\n"; return; }
        if (substr($name, -4) === '.php') {
            $tmp = tempnam(sys_get_temp_dir(), 'meteo_chk_');
            file_put_contents($tmp, $body);
            $chk = shell_exec('php -l ' . escapeshellarg($tmp) . ' 2>&1');
            unlink($tmp);
            if (strpos($chk, 'No syntax errors') === false) { http_response_code(400); echo "syntax error:\n$chk\n"; return; }
        }
        if (!is_dir($this->fileDir)) { http_response_code(500); echo "FILE_DIR missing: " . $this->fileDir . "\n"; return; }
        $dir = $this->fileDir . ($isSrc ? '/src/Meteo' : '');
        if ($isSrc && !is_dir($dir)) @mkdir($dir, 0777, true);
        $path = $dir . '/' . $name;
        if (is_file($path)) @copy($path, $path . '.bak');
        if (@file_put_contents($path, $body) === false) { http_response_code(500); echo "write failed: $path\n"; return; }
        echo "ok: wrote " . strlen($body) . " bytes to $path\n";
    }

    /* GET ?restore=1&key=SECRET -- restore the bootstrap from its .bak. */
    public function handleRestore(): void
    {
        header('Content-Type: text/plain');
        if ($this->badKey()) { http_response_code(401); echo "bad key\n"; return; }
        $bak = $this->selfPath . '.bak';
        if (!file_exists($bak)) { http_response_code(404); echo "no backup\n"; return; }
        if (!@copy($bak, $this->selfPath)) { http_response_code(500); echo "restore failed\n"; return; }
        echo "restored from $bak\n";
    }

    /* GET ?wipe_log=1&key=SECRET -- clear the history log (keeps a .wipe.bak). */
    public function handleWipeLog(): void
    {
        header('Content-Type: application/json');
        if ($this->badKey()) { http_response_code(401); echo json_encode(['error' => 'bad key']); return; }
        $log = $this->store->logPath();
        $sizeBefore = file_exists($log) ? filesize($log) : 0;
        $bak = $log . '.wipe.bak';
        if (file_exists($log)) { @copy($log, $bak); @file_put_contents($log, ''); }
        echo json_encode(['ok' => true, 'size_before' => $sizeBefore, 'backup_path' => $bak, 'note' => 'log wiped; previous data in .wipe.bak']);
    }

    /* POST ?save_calib&key=SECRET -- overwrite the vane calibration table. */
    public function handleSaveCalib(): void
    {
        header('Content-Type: application/json');
        if ($this->badKey()) { http_response_code(401); echo json_encode(['error' => 'bad key']); return; }
        $j = @json_decode(file_get_contents('php://input'), true);
        if (!is_array($j)) { http_response_code(400); echo json_encode(['error' => 'bad json']); return; }
        $calib = [];
        foreach (['N','NE','E','SE','S','SW','W','NW'] as $d) {
            if (!array_key_exists($d, $j)) continue;
            $v = (int)$j[$d];
            if ($v < 0 || $v > 255) continue;
            $calib[$d] = $v;
        }
        if (!$calib) { http_response_code(400); echo json_encode(['error' => 'no valid directions in payload']); return; }
        $payload = ['calib' => $calib, 'updated' => date('Y-m-d H:i:s'), 'ip' => $_SERVER['REMOTE_ADDR'] ?? '?'];
        $ok = $this->store->saveCalib($payload);
        echo json_encode(['ok' => $ok, 'calib' => $calib, 'updated' => $payload['updated']]);
    }

    /* GET ?gen_demo=1&key=SECRET&days=N&interval=SEC&clear=1 -- synthetic realistic history. */
    public function handleGenDemo(): void
    {
        header('Content-Type: text/plain');
        if ($this->badKey()) { http_response_code(401); echo "bad key\n"; return; }
        $log         = $this->store->logPath();
        $days        = max(1, min(60, (int)($_GET['days'] ?? 30)));
        $intervalSec = max(60, (int)($_GET['interval'] ?? 900));
        $clear       = isset($_GET['clear']);
        if ($clear && file_exists($log)) @unlink($log);

        $startTs = time() - $days * 86400;
        $endTs   = time();
        $dirIdx  = mt_rand(0, 7);
        $battStart = 4150; $battEnd = 3550;
        $totalSpan = $endTs - $startTs;
        $lines = []; $count = 0; $cycle = 1;

        for ($ts = $startTs; $ts <= $endTs; $ts += $intervalSec) {
            if (mt_rand(0, 99) < 15) $dirIdx = ($dirIdx + mt_rand(-1, 1) + 8) % 8;
            $progress = ($ts - $startTs) / max($totalSpan, 1);
            $battMv = (int)($battStart - ($battStart - $battEnd) * $progress + mt_rand(-15, 15));
            $csq = mt_rand(15, 27);
            if (mt_rand(0, 99) < 4) $csq = 99;
            $hour = (int)date('H', $ts);
            $isWindy = ($hour >= 10 && $hour <= 18);
            $baseSpeed = $isWindy ? mt_rand(3, 15) : mt_rand(0, 5);
            if (mt_rand(0, 99) < 1) $baseSpeed += mt_rand(15, 30);   /* storm burst */
            $vane = []; $speed = [];
            for ($i = 0; $i < 10; $i++) {
                $sampleDir = $dirIdx;
                if (mt_rand(0, 99) < 20) $sampleDir = ($dirIdx + mt_rand(-1, 1) + 8) % 8;
                $vane[] = 0xFF & ~(1 << $sampleDir);
                $sp = $baseSpeed + mt_rand(-2, 5);
                if (mt_rand(0, 99) < 3) $sp += mt_rand(5, 25);
                if ($sp < 0) $sp = 0;
                $speed[] = $sp;
            }
            if (mt_rand(0, 999) < 3) $cycle = 1; else $cycle++;
            $lines[] = json_encode([
                'version' => 3, 'cycle' => $cycle, 'samples' => 10,
                'batt_mv' => $battMv, 'batt_v' => sprintf('%.2f', $battMv / 1000.0),
                'csq' => $csq, 'vane' => $vane, 'speed' => $speed,
                'timestamp' => date('Y-m-d H:i:s', $ts), 'remote_ip' => 'demo', 'raw_bytes' => 39,
            ]);
            $count++;
        }
        $payload = implode("\n", $lines) . "\n";
        if (!@file_put_contents($log, $payload, $clear ? 0 : FILE_APPEND)) {
            http_response_code(500); echo "write failed (check perms on $log)\n"; return;
        }
        echo "generated $count entries · days=$days · interval={$intervalSec}s · clear=" . ($clear ? '1' : '0') . "\n";
        echo "log size now: " . filesize($log) . " bytes\n";
    }
}
