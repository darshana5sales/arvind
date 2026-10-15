<?php
/**
 * SMTP check — command line only (refuses to run from the web).
 *
 *   php api/tools/smtp-test.php                     connect + log in, sends nothing
 *   php api/tools/smtp-test.php --send you@x.com    also sends one test email to that address only
 *                                                   (MAIL_TO / CC / BCC are NOT used for the test)
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/../bootstrap.php';

$sendTo = null;
foreach ($argv as $i => $a) {
    if ($a === '--send' && isset($argv[$i + 1])) {
        $sendTo = $argv[$i + 1];
    }
}

$mailer = lead_mailer();
echo 'SMTP ' . SMTP_HOST . ':' . SMTP_PORT . ' (' . SMTP_SECURE . ') as ' . SMTP_USER . PHP_EOL;
try {
    if ($sendTo === null) {
        $mailer->testConnection();
        echo PHP_EOL . 'OK — connected and logged in. No email was sent.' . PHP_EOL;
    } else {
        $lead = Lead::fromInput([
            'form' => 'enquiry', 'name' => 'SMTP Test', 'phone' => '9999999999', 'email' => '',
            'city' => 'Ahmedabad', 'project_slug' => 'aqua-city', 'message' => 'Test email from api/tools/smtp-test.php — please ignore.',
            'consent' => true,
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
