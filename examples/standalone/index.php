<?php
/* Standalone MeteoStation server for a normal PHP host (one that can serve static files +
 * create files). Point the firmware's SERVER_URL at this directory. See README.md.
 *
 * The whole app is the Meteo\* library in ../../backend; this file just wires paths + secrets. */

spl_autoload_register(function ($class) {
    if (strncmp($class, 'Meteo\\', 6) !== 0) return;
    $f = __DIR__ . '/../../backend/' . str_replace('\\', '/', substr($class, 6)) . '.php';
    if (is_file($f)) require $f;
});

$secrets = is_file(__DIR__ . '/config.php') ? (include __DIR__ . '/config.php') : [];
if (!is_array($secrets)) $secrets = [];

$data = __DIR__ . '/data';
@mkdir($data, 0775, true);

$cfg = $secrets + [
    'log'       => $data . '/log.ndjson',
    'config'    => $data . '/config.json',
    'calib'     => $data . '/calib.json',
    'live'      => $data . '/live.json',
    'pushSubs'  => $data . '/push_subs.json',
    'pushState' => $data . '/push_state.json',
    'fileDir'   => __DIR__ . '/public',   /* dashboard.html + serial.html served from here */
    'selfPath'  => __FILE__,
];

(new Meteo\Server($cfg))->handle();
