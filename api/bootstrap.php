<?php
/**
 * Loads settings + the mail library. Included by send-lead.php and tools/smtp-test.php.
 */
declare(strict_types=1);

define('LEAD_API', true);
date_default_timezone_set('Asia/Kolkata');

// LEAD_API_CONFIG lets a local test run use a different config file (never set on the web server).
$config = (PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server') && getenv('LEAD_API_CONFIG') ? getenv('LEAD_API_CONFIG') : __DIR__ . '/config.php';
if (!is_file($config)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    exit(json_encode(['success' => false, 'message' => 'Mailer is not configured (api/config.php missing).']));
}
require $config;

// defaults for optional settings
$defaults = [
    'SMTP_SECURE' => (defined('SMTP_PORT') && (int) SMTP_PORT === 465) ? 'ssl' : 'tls',
    'SMTP_VERIFY_PEER' => true,
    'SMTP_TIMEOUT' => 20,
    'MAIL_CC' => '',
    'MAIL_BCC' => '',
    'SITE_NAME' => 'Website',
    'MAIL_FROM_NAME' => defined('SITE_NAME') ? SITE_NAME : 'Website',
    'ALLOWED_ORIGINS' => '',
    'RATE_LIMIT_MAX' => 5,
    'RATE_LIMIT_WINDOW' => 600,
    'SAVE_LEADS_CSV' => true,
];
foreach ($defaults as $k => $v) {
    if (!defined($k)) {
        define($k, $v);
    }
}

require __DIR__ . '/lib/MimeMessage.php';
require __DIR__ . '/lib/SmtpMailer.php';
require __DIR__ . '/lib/Lead.php';
require __DIR__ . '/lib/Storage.php';

function lead_mailer(): SmtpMailer
{
    return new SmtpMailer([
        'host' => SMTP_HOST,
        'port' => (int) SMTP_PORT,
        'secure' => SMTP_SECURE,
        'username' => SMTP_USER,
        'password' => SMTP_PASS,
        'timeout' => (int) SMTP_TIMEOUT,
        'verify_peer' => (bool) SMTP_VERIFY_PEER,
    ]);
}
