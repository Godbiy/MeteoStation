<?php
/* Copy to config.php (gitignored) and fill in your secrets.
 *   EDIT_KEY  — any long random string, e.g.  openssl rand -hex 24
 *   VAPID_*   — a P-256 keypair for Web Push, e.g.  npx web-push generate-vapid-keys
 *               (leave the VAPID_* values empty to disable push). Verify with ?push_selftest. */
return [
    'EDIT_KEY'      => 'change-me-to-a-long-random-string',
    'VAPID_PUBLIC'  => 'your-vapid-public-key (web push; leave empty to disable)',
    'VAPID_PRIVATE' => "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----",
    'VAPID_SUBJECT' => 'mailto:you@example.com',
];
