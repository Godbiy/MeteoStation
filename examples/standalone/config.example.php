<?php
/* Copy to config.php (gitignored) and fill in your secrets. */
return [
    'EDIT_KEY'      => 'change-me-to-a-long-random-string',
    'VAPID_PUBLIC'  => 'your-vapid-public-key (web push; leave empty to disable)',
    'VAPID_PRIVATE' => "-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----",
    'VAPID_SUBJECT' => 'mailto:you@example.com',
];
