<?php
/* Copy to config.php (gitignored) and fill in your secrets. deploy.sh pushes config.php to
 * the host's FILE_DIR via ?edit&file=config.php; meteo.php reads it at runtime.
 *
 *   EDIT_KEY  — any long random string, e.g.  openssl rand -hex 24
 *   VAPID_*   — a P-256 keypair for Web Push, e.g.  npx web-push generate-vapid-keys
 *               (leave the VAPID_* values empty to disable push). After deploying, verify the
 *               crypto with  ?push_selftest  ->  "roundtrip":"OK". */
return [
    'EDIT_KEY'      => 'change-me-to-a-long-random-string',
    'VAPID_PUBLIC'  => 'your-vapid-public-key (web push; leave empty to disable)',
    'VAPID_PRIVATE' => "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----",
    'VAPID_SUBJECT' => 'mailto:you@example.com',
];
