<?php
namespace Stelnet\Html\MeteoStation;

/* Thin bootstrap for the stelnet host — the ONLY file the web dir lets us overwrite.
 * The actual app is the Meteo\* library (src/Meteo/*.php), the UI, and config.php — all of
 * which live in FILE_DIR (a world-writable dir; the web root can't take new files). deploy.sh
 * pushes them via ?edit&file=...[&src]; this file autoloads + runs them. See README / deploy.sh.
 *
 * The host framework routes …/MeteoStation/TestKurwa to a class named TestKurwa and instantiates
 * it — the constructor runs everything and exits. For a normal host use examples/standalone. */

const FILE_DIR = '/st/petro/tmp/meteo';

\spl_autoload_register(function ($class) {
    if (\strncmp($class, 'Meteo\\', 6) !== 0) return;
    $f = FILE_DIR . '/src/Meteo/' . \str_replace('\\', '/', \substr($class, 6)) . '.php';
    if (\is_file($f)) require $f;
});

class TestKurwa
{
    /* Framework lifecycle stub — never reached, the constructor always exits. */
    public function show(): void {}

    public function __construct()
    {
        $secrets = \is_file(FILE_DIR . '/config.php') ? (include FILE_DIR . '/config.php') : [];
        if (!\is_array($secrets)) $secrets = [];
        $cfg = $secrets + [
            'log'       => '/st/petro/tmp/MeteoPost.txt',
            'config'    => '/st/petro/tmp/MeteoConfig.json',
            'calib'     => '/st/petro/tmp/MeteoCalib.json',
            'live'      => '/tmp/MeteoLive.json',        /* /st/petro/tmp can't create new files */
            'pushSubs'  => '/tmp/MeteoPushSubs.json',
            'pushState' => '/tmp/MeteoPushState.json',
            'fileDir'   => FILE_DIR,
            'selfPath'  => __FILE__,
        ];
        (new \Meteo\Server($cfg))->handle();
    }
}
