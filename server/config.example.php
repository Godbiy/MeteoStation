<?php
/* Copy to config.php (gitignored) and fill in your secrets. deploy.sh pushes config.php to
 * the host's FILE_DIR via ?edit&file=config.php; meteo.php reads it at runtime. */
return [
    'EDIT_KEY'      => 'change-me-to-a-long-random-string',
    'VAPID_PUBLIC'  => 'your-vapid-public-key (web push; leave empty to disable)',
    'VAPID_PRIVATE' => "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----",
    'VAPID_SUBJECT' => 'mailto:you@example.com',
];
