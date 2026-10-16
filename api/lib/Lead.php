<?php
/**
 * Lead — validates a website lead and renders the notification email.
 * Site-specific layer on top of MimeMessage / SmtpMailer.
 */
declare(strict_types=1);

defined('LEAD_API') || exit;

final class LeadValidationException extends RuntimeException
{
    /** @var string[] */
    public $errors;

    /** @param string[] $errors */
    public function __construct(array $errors)
    {
        parent::__construct(implode(' ', $errors));
        $this->errors = $errors;
    }
}

final class Lead
{
    /** Projects the forms can submit (slug → display name). Keep in sync with js/main.js. */
    public const PROJECTS = [
        'sensora' => 'Arvind Sensora',
        'aqua-city' => 'Arvind Aqua City',
        'everland' => 'Arvind Everland',
        'forreste' => 'Arvind Forreste',
        'uplands' => 'Arvind Uplands',
        'highgrove' => 'Arvind Highgrove',
        'alcove' => 'Arvind Alcove',
        'smartpark' => 'Arvind SmartPark',
    ];

    private const FORM_LABELS = [
        'enquiry' => 'Site Visit Request',
        'brochure' => 'Brochure Download',
    ];

    /**
     * Validates + normalises raw form input.
     * @param array<string,mixed> $in
     * @return array<string,string>
     * @throws LeadValidationException
     */
    public static function fromInput(array $in, string $ip, string $userAgent): array
    {
        $s = static function ($key, int $max = 200) use ($in): string {
            $v = isset($in[$key]) && is_scalar($in[$key]) ? (string) $in[$key] : '';
            $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '');
            return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
        };

        $form = $s('form', 20);
        if (!isset(self::FORM_LABELS[$form])) {
            $form = 'enquiry';
        }
        $errors = [];

        $name = preg_replace('/\s+/u', ' ', $s('name', 80)) ?? '';
        if (self::len($name) < 2) {
            $errors[] = 'Please enter your name.';
        }

        $phone = self::normalisePhone($s('phone', 25));
        if ($phone === null) {
            $errors[] = 'Please enter a valid mobile number.';
        }

        $email = $s('email', 120);
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Please enter a valid email address.';
        }
        if ($form === 'brochure' && $email === '') {
            $errors[] = 'Please enter your email address.';
        }

        $city = preg_replace('/\s+/u', ' ', $s('city', 60)) ?? '';
        if (self::len($city) < 2) {
            $errors[] = 'Please enter your city.';
        }

        $slug = $s('project_slug', 30);
        if ($slug !== '' && !isset(self::PROJECTS[$slug])) {
            $slug = '';
        }
        $project = $slug !== '' ? self::PROJECTS[$slug] : $s('project', 80);
        if ($project === '') {
            $errors[] = 'Please choose a project.';
        }

        $date = $s('visit_date', 10);
        if ($date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $date = '';
        }
        $time = $s('visit_time', 5);
        if ($time !== '' && !preg_match('/^\d{2}:\d{2}$/', $time)) {
            $time = '';
        }

        if ($errors) {
            throw new LeadValidationException($errors);
        }

        $utm = [];
        if (isset($in['utm']) && is_array($in['utm'])) {
            foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'] as $k) {
                if (isset($in['utm'][$k]) && is_scalar($in['utm'][$k]) && $in['utm'][$k] !== '') {
                    $utm[] = $k . '=' . substr(preg_replace('/[^\w\-.~%+]/', '', (string) $in['utm'][$k]) ?? '', 0, 100);
                }
            }
        }

        return [
            'form' => $form,
            'form_label' => self::FORM_LABELS[$form],
            'name' => $name,
            'phone' => (string) $phone,
            'email' => $email,
            'city' => $city,
            'project' => $project,
            'project_slug' => $slug,
            'message' => $s('message', 1000),
            'visit_date' => $date,
            'visit_time' => $time,
            'page' => filter_var($s('page', 300), FILTER_VALIDATE_URL) ?: '',
            'referrer' => filter_var($s('referrer', 300), FILTER_VALIDATE_URL) ?: '',
            'utm' => implode(' & ', $utm),
            'consent' => !empty($in['consent']) ? 'Yes' : 'No',
            'submitted_at' => date('d M Y, h:i A') . ' IST',
            'ip' => $ip,
            'user_agent' => substr($userAgent, 0, 250),
        ];
    }

    private static function len(string $s): int
    {
        return (int) preg_match_all('/./us', $s);
    }

    /** Indian mobiles (+91 / 0 / bare 10 digits) → "+91 98765 43210"; other + numbers kept as international. */
    public static function normalisePhone(string $raw): ?string
    {
        $digits = preg_replace('/\D/', '', $raw) ?? '';
        if (strlen($digits) === 12 && strpos($digits, '91') === 0) {
            $digits = substr($digits, 2);
        } elseif (strlen($digits) === 11 && $digits[0] === '0') {
            $digits = substr($digits, 1);
        }
        if (strlen($digits) === 10 && preg_match('/^[6-9]/', $digits)) {
            return '+91 ' . substr($digits, 0, 5) . ' ' . substr($digits, 5);
        }
        if (strpos(ltrim($raw), '+') === 0 && strlen($digits) >= 8 && strlen($digits) <= 15) {
            return '+' . $digits;   // NRI / international
        }
        return null;
    }

    /** @param array<string,string> $lead */
    public static function subject(array $lead): string
    {
        return sprintf('New %s — %s — %s (%s)', $lead['form_label'], $lead['project'], $lead['name'], $lead['city']);
    }

    /** @param array<string,string> $lead */
    public static function html(array $lead, string $siteName): string
    {
        $e = static function (string $v): string {
            return htmlspecialchars($v, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        };
        $tel = preg_replace('/[^\d+]/', '', $lead['phone']) ?? '';
        $wa = ltrim($tel, '+');
        $waText = rawurlencode('Hi ' . $lead['name'] . ', thank you for your interest in ' . $lead['project'] . '.');

        $rows = [
            ['Name', $e($lead['name'])],
            ['Mobile', '<a href="tel:' . $e($tel) . '" style="color:#0B3D6B;font-weight:700">' . $e($lead['phone']) . '</a>'
                . ' &nbsp;·&nbsp; <a href="https://wa.me/' . $e($wa) . '?text=' . $waText . '" style="color:#128C4A;font-weight:700">WhatsApp</a>'],
            ['Email', $lead['email'] !== '' ? '<a href="mailto:' . $e($lead['email']) . '" style="color:#0B3D6B">' . $e($lead['email']) . '</a>' : '—'],
            ['City', $e($lead['city'])],
            ['Project', '<strong>' . $e($lead['project']) . '</strong>'],
            ['Request', $e($lead['form_label'])],
        ];
        if ($lead['visit_date'] !== '') {
            $when = date('D, d M Y', strtotime($lead['visit_date']) ?: time());
            if ($lead['visit_time'] !== '') {
                $when .= ', ' . date('h:i A', strtotime($lead['visit_time']) ?: time());
            }
            $rows[] = ['Preferred visit', '<strong>' . $e($when) . '</strong>'];
        }
        if ($lead['message'] !== '') {
            $rows[] = ['Message', nl2br($e($lead['message']))];
        }
        $meta = [
            ['Submitted', $e($lead['submitted_at'])],
            ['Page', $lead['page'] !== '' ? '<a href="' . $e($lead['page']) . '" style="color:#7A7A9A">' . $e($lead['page']) . '</a>' : '—'],
            ['Came from', $lead['referrer'] !== '' ? $e($lead['referrer']) : 'Direct / unknown'],
            ['Campaign (UTM)', $lead['utm'] !== '' ? $e($lead['utm']) : '—'],
            ['Consent to contact', $e($lead['consent'])],
            ['IP address', $e($lead['ip'])],
        ];

        $tr = static function (array $r, bool $muted = false): string {
            $c = $muted ? '#7A7A9A' : '#1A1A2E';
            return '<tr><td style="padding:10px 14px;border-bottom:1px solid #E8ECF2;color:#7A7A9A;font-size:13px;width:150px;vertical-align:top">'
                . $r[0] . '</td><td style="padding:10px 14px;border-bottom:1px solid #E8ECF2;color:' . $c . ';font-size:14px">' . $r[1] . '</td></tr>';
        };

        return '<!DOCTYPE html><html><body style="margin:0;background:#F4F6F9;font-family:Arial,Helvetica,sans-serif">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:24px 12px"><tr><td align="center">'
            . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E1E6EE">'
            . '<tr><td style="background:#0B3D6B;padding:22px 24px">'
            . '<div style="color:#C9A84C;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700">' . $e($siteName) . '</div>'
            . '<div style="color:#FFFFFF;font-size:22px;margin-top:6px">New ' . $e($lead['form_label']) . '</div>'
            . '<div style="color:#E8F1FB;font-size:14px;margin-top:4px">' . $e($lead['project']) . '</div></td></tr>'
            . '<tr><td style="padding:18px 10px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
            . implode('', array_map($tr, $rows)) . '</table></td></tr>'
            . '<tr><td style="padding:6px 24px 4px"><a href="tel:' . $e($tel) . '" style="display:inline-block;background:#C9A84C;color:#0B3D6B;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:30px">Call ' . $e($lead['name']) . '</a>'
            . ' &nbsp; <a href="https://wa.me/' . $e($wa) . '?text=' . $waText . '" style="display:inline-block;background:#25D366;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:30px">WhatsApp</a></td></tr>'
            . '<tr><td style="padding:18px 10px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
            . implode('', array_map(static function ($r) use ($tr) { return $tr($r, true); }, $meta)) . '</table></td></tr>'
            . '<tr><td style="padding:14px 24px 20px;color:#9AA3B2;font-size:11px">Sent automatically by the website lead form. '
            . ($lead['email'] !== '' ? 'Reply to this email to answer the customer directly.' : 'No email address was given — please call or WhatsApp the customer.') . '</td></tr>'
            . '</table></td></tr></table></body></html>';
    }

    /** @param array<string,string> $lead */
    public static function text(array $lead, string $siteName): string
    {
        $lines = [
            $siteName . ' — New ' . $lead['form_label'],
            str_repeat('-', 40),
            'Name:     ' . $lead['name'],
            'Mobile:   ' . $lead['phone'],
            'Email:    ' . ($lead['email'] ?: '—'),
            'City:     ' . $lead['city'],
            'Project:  ' . $lead['project'],
        ];
        if ($lead['visit_date'] !== '') {
            $lines[] = 'Visit:    ' . $lead['visit_date'] . ($lead['visit_time'] ? ' ' . $lead['visit_time'] : '');
        }
        if ($lead['message'] !== '') {
            $lines[] = 'Message:  ' . $lead['message'];
        }
        $lines[] = '';
        $lines[] = 'Submitted: ' . $lead['submitted_at'];
        $lines[] = 'Page:      ' . ($lead['page'] ?: '—');
        $lines[] = 'UTM:       ' . ($lead['utm'] ?: '—');
        $lines[] = 'IP:        ' . $lead['ip'];
        return implode("\n", $lines);
    }
}
