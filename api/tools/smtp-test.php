<?php
/**
 * SMTP check — command line only (refuses to run from the web).
 *
 *   php api/tools/smtp-test.php                     connect + log in, sends nothing
 *   php api/tools/smtp-test.php --send you@x.com    also sends one test email to that address only
 *                                                   (MAIL_TO / CC / BCC are NOT used for the test)
 *   … --send you@x.com --form brochure              same, as a Brochure Download lead (default: site visit)
 *   … --send you@x.com --form visit                 same, as a "Book Site Visit" popup booking
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/../bootstrap.php';

$sendTo = null;
$form = 'enquiry';
foreach ($argv as $i => $a) {
    if ($a === '--send' && isset($argv[$i + 1])) {
        $sendTo = $argv[$i + 1];
    }
    if ($a === '--form' && isset($argv[$i + 1]) && in_array($argv[$i + 1], ['enquiry', 'visit', 'brochure'], true)) {
        $form = $argv[$i + 1];
    }
}

$mailer = lead_mailer();
echo 'SMTP ' . SMTP_HOST . ':' . SMTP_PORT . ' (' . SMTP_SECURE . ') as ' . SMTP_USER . PHP_EOL;
try {
    if ($sendTo === null) {
        $mailer->testConnection();
        echo PHP_EOL . 'OK — connected and logged in. No email was sent.' . PHP_EOL;
    } else {
        // Sample lead with every field filled, exactly as the website form would send it.
        $sample = $form === 'visit'
            ? ['form' => 'visit', 'name' => 'Test Lead (Visit Booking)', 'phone' => '+91 98765 43210', 'email' => $sendTo,
               'city' => 'Ahmedabad', 'project_slug' => 'sensora', 'message' => 'This is a test of the Book Site Visit popup — please ignore.',
               'visit_date' => date('Y-m-d', strtotime('+2 days')), 'visit_time' => '11:30']
            : ($form === 'brochure'
            ? ['form' => 'brochure', 'name' => 'Test Lead (Brochure)', 'phone' => '+91 98765 43210', 'email' => $sendTo,
               'city' => 'Ahmedabad', 'project_slug' => 'aqua-city']
            : ['form' => 'enquiry', 'name' => 'Test Lead (Site Visit)', 'phone' => '+91 98765 43210', 'email' => $sendTo,
               'city' => 'Ahmedabad', 'project_slug' => 'highgrove', 'message' => 'This is a test of the website site-visit form — please ignore.',
               'visit_date' => date('Y-m-d', strtotime('+3 days')), 'visit_time' => '11:00']);
        $lead = Lead::fromInput($sample + [
            'consent' => true,
            'page' => 'https://www.arvindsmartspace.com/projects/arvind-' . $sample['project_slug'] . '/',
            'referrer' => 'https://www.google.com/',
            'utm' => ['utm_source' => 'test', 'utm_campaign' => 'smtp-check'],
        ], '127.0.0.1', 'cli');
        $msg = (new MimeMessage())
            ->setFrom(MAIL_FROM, MAIL_FROM_NAME)
            ->addTo($sendTo)
            ->setSubject('[TEST] ' . Lead::subject($lead))
            ->setHtml(Lead::html($lead, SITE_NAME))
            ->setText(Lead::text($lead, SITE_NAME));
        $mailer->send($msg);
        echo PHP_EOL . 'OK — test email accepted by the server for ' . $sendTo . PHP_EOL;
    }
    $code = 0;
} catch (Throwable $e) {
    echo PHP_EOL . 'FAILED: ' . $e->getMessage() . PHP_EOL;
    $code = 1;
}
echo PHP_EOL . "Transcript:" . PHP_EOL . '  ' . implode(PHP_EOL . '  ', $mailer->transcript()) . PHP_EOL;
exit($code);
