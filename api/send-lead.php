<?php
/**
 * POST /api/send-lead.php — receives a lead from the website forms and emails it.
 *
 * Request  (JSON or form-encoded): form, name, phone, email, city, project, project_slug,
 *          message, visit_date, visit_time, consent, page, referrer, utm{…}, website (honeypot)
 * Response (JSON): { "success": true|false, "message": "…" }
 *   200 sent · 422 validation error · 429 too many requests · 405 wrong method · 500 server error
 */
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, bool $ok, string $message, array $extra = []): void
{
    http_response_code($status);
    echo json_encode(['success' => $ok, 'message' => $message] + $extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ---- CORS: only the websites listed in ALLOWED_ORIGINS may post from the browser ----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = array_filter(array_map('trim', explode(',', (string) ALLOWED_ORIGINS)));
$selfOrigin = (isset($_SERVER['HTTP_HOST']) ? ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] : '');
if ($origin !== '' && ($origin === $selfOrigin || in_array($origin, $allowed, true))) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method !== 'POST') {
    header('Allow: POST, OPTIONS');
    respond(405, false, 'Method not allowed.');
}
if ($origin !== '' && $origin !== $selfOrigin && !in_array($origin, $allowed, true)) {
    respond(403, false, 'This website is not allowed to send leads here.');
}

// ---- read input (JSON body, or a normal form post) ------------------------------------
$raw = (string) file_get_contents('php://input', false, null, 0, 20000);
$input = json_decode($raw, true);
if (!is_array($input)) {
    $input = $_POST;
}

// Honeypot: real visitors never see / fill the "website" field. Pretend success for bots.
if (!empty($input['website'])) {
    respond(200, true, 'Thank you.');
}

$ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ip = filter_var(trim(explode(',', (string) $ip)[0]), FILTER_VALIDATE_IP) ?: 'unknown';
$storage = new Storage(__DIR__ . '/storage');

if (!$storage->allow($ip, (int) RATE_LIMIT_MAX, (int) RATE_LIMIT_WINDOW)) {
    respond(429, false, 'Too many requests. Please try again in a few minutes, or call us directly.');
}

try {
    $lead = Lead::fromInput($input, $ip, (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
} catch (LeadValidationException $e) {
    respond(422, false, implode(' ', $e->errors), ['errors' => $e->errors]);
}

// ---- send ---------------------------------------------------------------------------
$mailStatus = 'sent';
try {
    $msg = (new MimeMessage())
        ->setFrom(MAIL_FROM, MAIL_FROM_NAME)
        ->addList('to', MAIL_TO)
        ->addList('cc', (string) MAIL_CC)
        ->addList('bcc', (string) MAIL_BCC)
        ->setSubject(Lead::subject($lead))
        ->setHtml(Lead::html($lead, SITE_NAME))
        ->setText(Lead::text($lead, SITE_NAME))
        ->addHeader('X-Lead-Form', $lead['form'])
        ->addHeader('X-Mailer', 'Arvind-Lead-Mailer/1.0');
    if ($lead['email'] !== '') {
        $msg->setReplyTo($lead['email'], $lead['name']);
    }
    $mailer = lead_mailer();
    $mailer->send($msg);
} catch (Throwable $e) {
    $mailStatus = 'FAILED: ' . $e->getMessage();
    $storage->logError('Mail failed for ' . $lead['phone'] . ' / ' . $lead['project'] . ': ' . $e->getMessage()
        . (isset($mailer) ? ' | ' . implode(' | ', array_slice($mailer->transcript(), -6)) : ''));
}

$saved = SAVE_LEADS_CSV ? $storage->saveLead($lead, $mailStatus) : false;

if ($mailStatus === 'sent') {
    respond(200, true, 'Thank you! Our team will contact you shortly.');
}
// Email failed but the lead is safely stored → still a success for the visitor.
if ($saved) {
    respond(200, true, 'Thank you! Our team will contact you shortly.', ['queued' => true]);
}
respond(500, false, 'Sorry, we could not send your request. Please call or WhatsApp us.');
