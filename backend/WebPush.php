<?php
namespace Meteo;

/* Web Push (VAPID, RFC 8291/8292): crypto, subscriptions, send, edge-triggered alerts,
 * and the PNG icon/chart images the notifications reference. */
final class WebPush
{
    private Store $store;
    private array $cfg;   /* VAPID_PUBLIC / VAPID_PRIVATE / VAPID_SUBJECT */

    public function __construct(Store $store, array $cfg)
    {
        $this->store = $store;
        $this->cfg   = $cfg;
    }

    private static function b64u(string $s): string  { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
    private static function b64ud(string $s): string { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }

    /* Wrap a raw 65-byte uncompressed P-256 point as a PEM SubjectPublicKeyInfo. */
    private function ecPubPemFromRaw(string $raw65): string
    {
        $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $raw65;
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    /* DER ECDSA signature (SEQ{INTEGER r, INTEGER s}) -> raw r||s, 64 bytes. */
    private function derToRawSig(string $der): string
    {
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
    private function vapidAuth(string $audience): ?string
    {
        $h = self::b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $p = self::b64u(json_encode(['aud' => $audience, 'exp' => time() + 43200, 'sub' => ($this->cfg['VAPID_SUBJECT'] ?? '')]));
        $input = $h . '.' . $p;
        $sig = '';
        if (!openssl_sign($input, $sig, ($this->cfg['VAPID_PRIVATE'] ?? ''), OPENSSL_ALGO_SHA256)) return null;
        $raw = $this->derToRawSig($sig);
        if ($raw === '') return null;
        return 'vapid t=' . $input . '.' . self::b64u($raw) . ', k=' . ($this->cfg['VAPID_PUBLIC'] ?? '');
    }

    /* RFC 8291 aes128gcm encryption. Optional $as/$salt for deterministic self-test. */
    private function encryptPush(string $uaPublic, string $authSecret, string $payload, $as = null, ?string $salt = null): ?array
    {
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
    private function sendPush(array $sub, string $payload): int
    {
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

    public function handlePushPublic(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        echo json_encode(['key' => ($this->cfg['VAPID_PUBLIC'] ?? '')]);
    }

    public function handlePushSubscribe(): void
    {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);
        if (!isset($body['subscription']['endpoint'])) { http_response_code(400); echo '{"ok":false}'; return; }
        $ep    = $body['subscription']['endpoint'];
        $all   = $this->store->loadPushSubs();
        $since = null;
        foreach ($all as $s) { if (($s['sub']['endpoint'] ?? '') === $ep) { $since = $s['since'] ?? null; break; } }
        $subs  = array_values(array_filter($all, fn($s) => ($s['sub']['endpoint'] ?? '') !== $ep));
        $subs[] = [
            'sub'   => $body['subscription'],
            'cfg'   => $body['cfg'] ?? [],
            'label' => substr((string)($body['label'] ?? ''), 0, 40),
            'since' => $since ?? date('Y-m-d H:i'),
        ];
        $saved = $this->store->savePushSubs($subs);
        echo json_encode(['ok' => $saved, 'count' => count($this->store->loadPushSubs())]);
    }

    public function handlePushUnsubscribe(): void
    {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);
        $ep   = $body['endpoint'] ?? '';
        $subs = array_values(array_filter($this->store->loadPushSubs(), fn($s) => ($s['sub']['endpoint'] ?? '') !== $ep));
        $this->store->savePushSubs($subs);
        echo json_encode(['ok' => true, 'count' => count($subs)]);
    }

    /* No raw endpoints exposed; a sha id is used for removal. */
    public function handlePushList(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $out = [];
        foreach ($this->store->loadPushSubs() as $e) {
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

    public function handlePushRemove(): void
    {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);
        $id   = $body['id'] ?? '';
        $subs = array_values(array_filter($this->store->loadPushSubs(),
            fn($s) => substr(hash('sha256', $s['sub']['endpoint'] ?? ''), 0, 12) !== $id));
        $this->store->savePushSubs($subs);
        echo json_encode(['ok' => true, 'count' => count($subs)]);
    }

    /* Send a real push to every device now + report each push-service HTTP status. */
    public function handlePushTest(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $subs = $this->store->loadPushSubs();
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
            if ($code !== 404 && $code !== 410) $keep[] = $entry;
        }
        if (count($keep) !== count($subs)) $this->store->savePushSubs($keep);
        echo json_encode(['subs' => count($subs), 'sent' => $results]);
    }

    /* Absolute base URL of this endpoint (for push image links the phone fetches). */
    private function selfUrl(): string
    {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $path   = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
        return $scheme . '://' . $host . $path;
    }

    /* Localized phrases for SERVER-sent pushes (foreground uses the dashboard's own i18n). */
    private function pushStrings(string $lang): array
    {
        $S = [
            'uk' => ['batt_low'=>'🔋 Низька батарея','batt_crit'=>'🔴 Критична батарея','wind'=>'💨 Сильний вітер','online'=>'✅ Станція знов онлайн','gusts'=>'пориви','avg'=>'сер','silence'=>'після %d хв тиші','perH'=>'/год','days'=>'дн','test_t'=>'📡 Тест із сервера','test_b'=>'Серверний пуш працює ✅','all_b'=>'усі типи пушів ✅'],
            'en' => ['batt_low'=>'🔋 Low battery','batt_crit'=>'🔴 Critical battery','wind'=>'💨 High wind','online'=>'✅ Station back online','gusts'=>'gusts','avg'=>'avg','silence'=>'after %d min of silence','perH'=>'/h','days'=>'d','test_t'=>'📡 Test from server','test_b'=>'Server push works ✅','all_b'=>'all push types ✅'],
            'pl' => ['batt_low'=>'🔋 Niska bateria','batt_crit'=>'🔴 Krytyczna bateria','wind'=>'💨 Silny wiatr','online'=>'✅ Stacja znów online','gusts'=>'porywy','avg'=>'śr','silence'=>'po %d min ciszy','perH'=>'/h','days'=>'d','test_t'=>'📡 Test z serwera','test_b'=>'Push serwerowy działa ✅','all_b'=>'wszystkie typy ✅'],
        ];
        return $S[$lang] ?? $S['uk'];
    }

    /* Battery trend suffix for the push body: " · ↓ -40 mV/h · ~2.1 d". */
    private function battTrendStr(int $cur, array $L): string
    {
        $pts = [];
        foreach ($this->store->readTail(40) as $e) {
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

    /* Edge-triggered alerts on a module POST: battery low/critical, strong wind, back-online,
     * and the optional silent live-pin. Honours per-device thresholds + muteUntil. */
    public function maybePush(array $data): void
    {
        $subs = $this->store->loadPushSubs();
        if (!$subs) return;
        $batt     = (int)($data['batt_mv'] ?? 0);
        $maxPulse = (!empty($data['speed']) && is_array($data['speed'])) ? max($data['speed']) : 0;
        $now  = time();
        $base = $this->selfUrl();
        $state = $this->store->loadPushState();
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
            $mul = (float)($cfg['uMul'] ?? 1); $lbl = $cfg['uLbl'] ?? 'km/h';
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
            if (!empty($cfg['online']) && $prevPost && $gapMin > (float)($cfg['offlineMin'] ?? 30)) {
                $this->sendPush($entry['sub'], json_encode([
                    'title' => $L['online'], 'body' => sprintf($L['silence'], round($gapMin)),
                    'icon' => $base . '?push_icon=online', 'tag' => 'online',
                ]));
            }
            if (!empty($cfg['livePin'])) {
                $parts = [];
                if ($batt > 0)                  $parts[] = '🔋 ' . number_format($batt / 1000, 2) . 'V';
                if (!empty($data['solar_mv']))  $parts[] = '☀ ' . number_format($data['solar_mv'] / 1000, 2) . 'V';
                $csq = $data['csq'] ?? null;
                if ($csq !== null && (int)$csq != 99) $parts[] = '📶 ' . $csq;
                $title  = '💨 ' . round($mean * $mul) . ' ' . $lbl;
                $body   = implode(' · ', $parts);
                $pinKey = $title . '|' . $body;
                if (($st['pin'] ?? '') !== $pinKey) {
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
        $this->store->savePushState($state);
    }

    public function handlePushTestAll(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $subs = $this->store->loadPushSubs();
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

    public function handlePushMute(): void
    {
        header('Content-Type: application/json');
        $body  = json_decode(file_get_contents('php://input'), true);
        $ep    = $body['endpoint'] ?? '';
        $hours = max(1, min(48, (int)($_GET['hours'] ?? 6)));
        $until = time() + $hours * 3600;
        $subs  = $this->store->loadPushSubs();
        foreach ($subs as &$s) {
            if (($s['sub']['endpoint'] ?? '') === $ep) $s['cfg']['muteUntil'] = $until;
        }
        unset($s);
        $this->store->savePushSubs($subs);
        echo json_encode(['ok' => true, 'muteUntil' => $until, 'hours' => $hours]);
    }

    /* ?push_chart=batt|wind -- 24h sparkline PNG used as the push image. */
    public function handlePushChart(): void
    {
        $kind = (($_GET['push_chart'] ?? '') === 'wind') ? 'wind' : 'batt';
        $now = time(); $pts = [];
        foreach ($this->store->readTail(300) as $e) {
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

    /* ?push_icon=batt|crit|wind|online|test|app -- themed PNG notification icon (GD, 2x). */
    public function handlePushIcon(): void
    {
        $type = preg_replace('/[^a-z]/', '', $_GET['push_icon'] ?? 'test');
        $out  = (int)($_GET['size'] ?? 192);
        if ($out < 48) $out = 48;
        if ($out > 384) $out = 384;
        $sz = $out * 2;
        $colors = ['batt' => [63,185,80], 'online' => [63,185,80], 'crit' => [248,81,73], 'wind' => [88,166,255], 'test' => [88,166,255]];
        [$r, $g, $bl] = $colors[$type] ?? [88,166,255];
        $im = imagecreatetruecolor($sz, $sz);
        imagealphablending($im, false); imagesavealpha($im, true);
        imagefilledrectangle($im, 0, 0, $sz, $sz, imagecolorallocatealpha($im, 0, 0, 0, 127));
        imagealphablending($im, true);
        $badge = isset($_GET['badge']);
        $col = imagecolorallocate($im, $r, $g, $bl);
        $wh  = imagecolorallocate($im, 255, 255, 255);
        $c   = (int)($sz / 2);
        if (!$badge) imagefilledellipse($im, $c, $c, $sz, $sz, $col);
        $f = $sz / 96.0;
        $S = fn($v) => (int)round($v * $f);
        switch ($type) {
            case 'batt':
                imagesetthickness($im, $S(5));
                imagerectangle($im, $S(28), $S(36), $S(64), $S(62), $wh);
                imagefilledrectangle($im, $S(64), $S(44), $S(71), $S(54), $wh);
                imagefilledrectangle($im, $S(33), $S(41), $S(50), $S(57), $wh);
                break;
            case 'crit':
                imagefilledrectangle($im, $S(43), $S(26), $S(53), $S(56), $wh);
                imagefilledellipse($im, $S(48), $S(67), $S(11), $S(11), $wh);
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
            case 'app':
                $gx = $S(48); $gy = $S(58); $gr = $S(28);
                for ($t = 180.0; $t <= 360.0; $t += 2.0) { $rr = deg2rad($t); imagefilledellipse($im, (int)round($gx + cos($rr) * $gr), (int)round($gy + sin($rr) * $gr), $S(13), $S(13), $wh); }
                $gna = deg2rad(180 + 0.72 * 180);
                imagesetthickness($im, $S(10));
                imageline($im, $gx, $gy, (int)round($gx + cos($gna) * $S(24)), (int)round($gy + sin($gna) * $S(24)), $wh);
                imagefilledellipse($im, $gx, $gy, $S(17), $S(17), $wh);
                break;
            default:
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

    /* ?push_selftest -- round-trip encrypt/decrypt + VAPID JWT sign, to validate the
     * host's PHP/openssl crypto without sending anything. */
    public function handlePushSelftest(): void
    {
        header('Content-Type: application/json');
        header('Cache-Control: no-store');
        $out = ['php' => PHP_VERSION, 'hash_hkdf' => function_exists('hash_hkdf'), 'openssl_pkey_derive' => function_exists('openssl_pkey_derive'),
                'gd' => extension_loaded('gd'), 'imagepng' => function_exists('imagepng')];

        $ua = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        $d  = openssl_pkey_get_details($ua);
        $uaPub = "\x04" . str_pad($d['ec']['x'], 32, "\x00", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\x00", STR_PAD_LEFT);
        $authSecret = random_bytes(16);
        $msg = 'meteo push selftest ✅';
        $enc = $this->encryptPush($uaPub, $authSecret, $msg);
        if (!$enc) { $out['roundtrip'] = 'encrypt failed'; echo json_encode($out); return; }
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

        $auth = $this->vapidAuth('https://example.com');
        $out['vapid_header'] = $auth ? substr($auth, 0, 24) . '...' : 'FAIL';
        echo json_encode($out);
    }
}
