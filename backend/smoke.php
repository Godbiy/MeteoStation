<?php
/* Host smoke test — validates the library loads + constructs without touching the live
 * endpoint. Run on the host BEFORE cutover:  php path/to/Meteo/smoke.php
 * Prints "OK" or the first fatal (file:line). Catches autoload/parse/construct errors. */
spl_autoload_register(function ($c) {
    if (strncmp($c, 'Meteo\\', 6) !== 0) return;
    $f = __DIR__ . '/' . str_replace('\\', '/', substr($c, 6)) . '.php';
    if (is_file($f)) require $f;
});
try {
    $cfg = [
        'log' => '/tmp/_s.log', 'config' => '/tmp/_s.cfg', 'calib' => '/tmp/_s.cal',
        'live' => '/tmp/_s.live', 'pushSubs' => '/tmp/_s.subs', 'pushState' => '/tmp/_s.st',
        'fileDir' => __DIR__, 'selfPath' => __FILE__,
        'EDIT_KEY' => 'x', 'VAPID_PUBLIC' => '', 'VAPID_PRIVATE' => '', 'VAPID_SUBJECT' => '',
    ];
    \Meteo\Payload::crc8("\x00", 1);
    new \Meteo\Server($cfg);   /* news up Store + WebPush + Ui + Admin too */
    echo "OK: all 6 classes load + construct\n";
} catch (\Throwable $e) {
    echo "FAIL: " . $e->getMessage() . " @ " . $e->getFile() . ":" . $e->getLine() . "\n";
}
