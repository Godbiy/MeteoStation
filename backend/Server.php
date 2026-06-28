<?php
namespace Meteo;

/* Front controller — pure router. Wires the components from a $cfg array (paths + secrets)
 * and dispatches each request to one of: Api (station POST + history/config), Ui (dashboard /
 * PWA), WebPush (push), Admin (key-gated edit). Build with $cfg and call handle().
 * See examples/standalone/index.php and the stelnet bootstrap (server/meteo.php). */
final class Server
{
    private Api $api;
    private Ui $ui;
    private WebPush $push;
    private Admin $admin;

    public function __construct(array $cfg)
    {
        $store       = new Store($cfg);
        $this->push  = new WebPush($store, $cfg);
        $this->api   = new Api($store, $this->push);
        $this->ui    = new Ui($cfg);
        $this->admin = new Admin($store, $cfg);
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
            /* Lazy watchdog: piggy-back the time-based push checks on the dashboard's own
             * polling so silence/live-pin advance even with no cron, while someone watches.
             * Throttled internally; skipped for the watchdog/asset routes themselves. */
            if (!isset($g['tick']) && !isset($g['daemon']) && !isset($g['asset']) && !isset($g['ui']))
                $this->push->tickIfDue();
            if (isset($g['ui']))            { $this->ui->handleUi(); exit; }
            if (isset($g['asset']))         { $this->ui->handleAsset(); exit; }
            if (isset($g['set_avg']))       { $this->api->handleSetAvg(); exit; }
            if (isset($g['set_samples']))   { $this->api->handleSetSamples(); exit; }
            if (isset($g['set_live']))      { $this->api->handleSetLive(); exit; }
            if (isset($g['live_now']))      { $this->api->handleLiveNow(); exit; }
            if (isset($g['config']))        { $this->api->handleConfig(); exit; }
            if (isset($g['dl_html']))       { $this->ui->handleDownloadHtml(); exit; }
            if (isset($g['restore']))       { $this->admin->handleRestore(); exit; }
            if (isset($g['gen_demo']))      { $this->admin->handleGenDemo(); exit; }
            if (isset($g['wipe_log']))      { $this->admin->handleWipeLog(); exit; }
            if (isset($g['calib']))         { $this->api->handleGetCalib(); exit; }
            if (isset($g['sw']))            { $this->ui->handlePwaSw(); exit; }
            if (isset($g['push_pub']))      { $this->push->handlePushPublic(); exit; }
            if (isset($g['push_selftest'])) { $this->push->handlePushSelftest(); exit; }
            if (isset($g['push_test']))     { $this->push->handlePushTest(); exit; }
            if (isset($g['push_testall']))  { $this->push->handlePushTestAll(); exit; }
            if (isset($g['push_list']))     { $this->push->handlePushList(); exit; }
            if (isset($g['push_chart']))    { $this->push->handlePushChart(); exit; }
            if (isset($g['tick']))          { $this->push->handleTick(); exit; }
            if (isset($g['daemon_status'])) { $this->push->handleDaemonStatus(); exit; }
            if (isset($g['daemon']))        { $this->push->handleDaemon(); exit; }
            if (isset($g['manifest']))      { $this->ui->handlePwaManifest(); exit; }
            if (isset($g['icon']))          { $this->ui->handlePwaIcon(); exit; }
            if (isset($g['icon_png']))      { $this->ui->handlePwaIconPng(); exit; }
            if (isset($g['push_icon']))     { $this->push->handlePushIcon(); exit; }
            $this->api->handleGet();
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

        $this->api->handleStationPost();
    }
}
