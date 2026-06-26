<?php
namespace Meteo;

/* Serves the operator UI + PWA assets. The HTML lives on disk in FILE_DIR (deployed via
 * Admin::handleEditFile); the service worker / manifest / icons are generated here. */
final class Ui
{
    private string $fileDir;
    private string $editKey;

    public function __construct(array $cfg)
    {
        $this->fileDir = $cfg['fileDir'];
        $this->editKey = ($cfg['EDIT_KEY'] ?? '') ?: "\0";
    }

    /* GET ?ui=1 -- serve the dashboard from FILE_DIR. __BUILD_VER__ is stamped from the file
     * mtime; __EDIT_KEY__ is filled so the dashboard's admin calls authenticate. */
    public function handleUi(): void { $this->serveUi('dashboard.html'); }
    private function serveUi(string $name): void
    {
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        $f = $this->fileDir . '/' . $name;
        if (!is_file($f)) { http_response_code(503); echo "not deployed: $name (push via ?edit&file=$name)"; return; }
        $ver = gmdate('Y-m-d H:i', @filemtime($f) ?: time()) . ' UTC';
        echo str_replace(['__BUILD_VER__', '__EDIT_KEY__'], [$ver, $this->editKey], (string)file_get_contents($f));
    }

    /* GET ?asset=NAME -- serve a split UI asset (dashboard.js / dashboard.css) from FILE_DIR,
     * with the same token fill-in as the shell. no-cache; the service worker precaches these
     * for offline. */
    public function handleAsset(): void
    {
        $name = basename((string)($_GET['asset'] ?? ''));
        if (!preg_match('/^[A-Za-z0-9_.-]+\.(js|css|json)$/', $name)) { http_response_code(400); echo "bad asset"; return; }
        $f = $this->fileDir . '/' . $name;
        if (!is_file($f)) { http_response_code(404); echo "not found: $name"; return; }
        $ext  = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $type = ['js' => 'text/javascript', 'css' => 'text/css', 'json' => 'application/json'][$ext] ?? 'text/plain';
        header('Content-Type: ' . $type . '; charset=utf-8');
        header('Cache-Control: no-cache');
        $ver = gmdate('Y-m-d H:i', @filemtime($f) ?: time()) . ' UTC';
        echo str_replace(['__BUILD_VER__', '__EDIT_KEY__'], [$ver, $this->editKey], (string)file_get_contents($f));
    }

    /* GET ?dl_html=1 -- serve the deployed dashboard HTML as a downloadable file. */
    public function handleDownloadHtml(): void
    {
        $html = @file_get_contents($this->fileDir . '/dashboard.html');
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

    /* ?sw=1 -- service worker: stale-while-revalidate app shell, cache fallback offline. */
    public function handlePwaSw(): void
    {
        header('Content-Type: application/javascript; charset=utf-8');
        header('Service-Worker-Allowed: ./');
        header('Cache-Control: no-cache');
        $ver = 'meteo-' . (@filemtime($this->fileDir . '/dashboard.html') ?: 1);
        echo str_replace('__SW_CACHE__', $ver, (string)@file_get_contents($this->fileDir . '/sw.js'));
        exit;
    }

    /* ?manifest=1 -- PWA manifest (installable, standalone). */
    public function handlePwaManifest(): void
    {
        header('Content-Type: application/manifest+json; charset=utf-8');
        echo (string)@file_get_contents($this->fileDir . '/manifest.json');
        exit;
    }

    /* ?icon=1 -- app icon (SVG, scales to any size). */
    public function handlePwaIcon(): void
    {
        header('Content-Type: image/svg+xml; charset=utf-8');
        header('Cache-Control: max-age=86400');
        echo <<<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#161b22"/><stop offset="1" stop-color="#0d1117"/></linearGradient></defs><rect width="96" height="96" rx="18" fill="url(#g)"/><circle cx="27" cy="62" r="17" fill="none" stroke="#58a6ff" stroke-width="5"/><polygon points="27,49 19,62 35,62" fill="#f85149"/><polygon points="27,75 19,62 35,62" fill="#e6edf3"/><circle cx="27" cy="62" r="4" fill="#58a6ff"/><circle cx="27" cy="62" r="2" fill="#f85149"/><path d="M52 64A17 17 0 0 1 86 64" fill="none" stroke="#58a6ff" stroke-width="6" stroke-linecap="round"/><polygon points="78.6,52.5 72.1,66.6 65.9,61.5" fill="#f85149"/><circle cx="69" cy="64" r="5" fill="#58a6ff"/><circle cx="69" cy="64" r="2" fill="#f85149"/><g stroke="#ffc740" stroke-width="2" stroke-linecap="round"><path d="M44 37v3M37.6 34.4l-2.1 2.1M35 28h-3M37.6 21.6l-2.1-2.1M44 19v-3"/></g><circle cx="44" cy="28" r="6.5" fill="#ffc740"/><g fill="#c9d6e3"><circle cx="55" cy="26" r="7.5"/><circle cx="68" cy="21" r="10"/><circle cx="61" cy="28" r="7"/><rect x="49" y="26" width="23" height="7" rx="3.5"/></g></svg>
SVG;
        exit;
    }

    /* ?icon_png&size=N -- raster app icon (GD, 2x supersample), full-bleed=maskable. */
    public function handlePwaIconPng(): void
    {
        $out = (int)($_GET['size'] ?? 512);
        if ($out < 48) $out = 48;
        if ($out > 1024) $out = 1024;
        $sz = $out * 2;
        $im = imagecreatetruecolor($sz, $sz);
        imagealphablending($im, true);
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
        $wh    = imagecolorallocate($im, 230, 237, 243);
        $sun   = imagecolorallocate($im, 255, 199, 64);
        $cloud = imagecolorallocate($im, 201, 214, 227);
        $S     = fn($v) => (int)round($v * $sz / 96.0);
        /* compass (left) */
        $ccx = $S(27); $ccy = $S(62); $cr = $S(17);
        for ($t = 0.0; $t < 360.0; $t += 1.5) { $r = deg2rad($t); imagefilledellipse($im, (int)round($ccx + cos($r) * $cr), (int)round($ccy + sin($r) * $cr), $S(4), $S(4), $blue); }
        $nw = $S(8);
        imagefilledpolygon($im, [$ccx, $ccy - $S(13), $ccx - $nw, $ccy, $ccx + $nw, $ccy], 3, $red);
        imagefilledpolygon($im, [$ccx, $ccy + $S(13), $ccx - $nw, $ccy, $ccx + $nw, $ccy], 3, $wh);
        imagefilledellipse($im, $ccx, $ccy, $S(8), $S(8), $blue);
        imagefilledellipse($im, $ccx, $ccy, $S(4), $S(4), $red);
        /* speedometer (right) */
        $scx = $S(69); $scy = $S(64); $sr = $S(17);
        for ($t = 180.0; $t <= 360.0; $t += 1.5) { $r = deg2rad($t); imagefilledellipse($im, (int)round($scx + cos($r) * $sr), (int)round($scy + sin($r) * $sr), $S(6), $S(6), $blue); }
        $na  = deg2rad(180 + 0.72 * 180);
        $tip = [(int)round($scx + cos($na) * $S(15)), (int)round($scy + sin($na) * $S(15))];
        $b1  = [(int)round($scx + cos($na + M_PI_2) * $S(4)), (int)round($scy + sin($na + M_PI_2) * $S(4))];
        $b2  = [(int)round($scx + cos($na - M_PI_2) * $S(4)), (int)round($scy + sin($na - M_PI_2) * $S(4))];
        imagefilledpolygon($im, [$tip[0], $tip[1], $b1[0], $b1[1], $b2[0], $b2[1]], 3, $red);
        imagefilledellipse($im, $scx, $scy, $S(9), $S(9), $blue);
        imagefilledellipse($im, $scx, $scy, $S(4), $S(4), $red);
        /* sun + cloud (top center) */
        $sx = $S(44); $sy = $S(28);
        imagesetthickness($im, $S(2));
        foreach ([90, 135, 180, 225, 270] as $ra) { $r = deg2rad($ra); imageline($im, (int)round($sx + cos($r) * $S(9)), (int)round($sy + sin($r) * $S(9)), (int)round($sx + cos($r) * $S(12)), (int)round($sy + sin($r) * $S(12)), $sun); }
        imagefilledellipse($im, $sx, $sy, $S(13), $S(13), $sun);
        imagefilledellipse($im, $S(55), $S(26), $S(15), $S(15), $cloud);
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
}
