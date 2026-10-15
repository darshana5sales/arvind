<?php
/**
 * MimeMessage — builds an RFC 5322 / MIME email (HTML + plain-text alternative).
 *
 * Part of the site's dependency-free mail library (no Composer / PHPMailer):
 *   MimeMessage  → builds the message
 *   SmtpMailer   → delivers it over authenticated SMTP
 *
 * Every header value is stripped of CR/LF so user input can never inject headers.
 * PHP 7.4+.
 */
declare(strict_types=1);

defined('LEAD_API') || exit;

final class MimeMessage
{
    /** @var array{0:string,1:string} */
    private $from = ['', ''];
    /** @var array<int, array{0:string,1:string}> */
    private $to = [];
    /** @var array<int, array{0:string,1:string}> */
    private $cc = [];
    /** @var array<int, array{0:string,1:string}> */
    private $bcc = [];
    /** @var array{0:string,1:string}|null */
    private $replyTo = null;
    /** @var string */
    private $subject = '';
    /** @var string */
    private $html = '';
    /** @var string */
    private $text = '';
    /** @var array<string,string> */
    private $extraHeaders = [];

    public function setFrom(string $email, string $name = ''): self
    {
        $this->from = [self::assertEmail($email), self::clean($name)];
        return $this;
    }

    public function addTo(string $email, string $name = ''): self
    {
        $this->to[] = [self::assertEmail($email), self::clean($name)];
        return $this;
    }

    public function addCc(string $email, string $name = ''): self
    {
        $this->cc[] = [self::assertEmail($email), self::clean($name)];
        return $this;
    }

    public function addBcc(string $email): self
    {
        $this->bcc[] = [self::assertEmail($email), ''];
        return $this;
    }

    /** Adds every address in a comma / semicolon separated list (blank entries ignored). */
    public function addList(string $kind, string $list): self
    {
        foreach (preg_split('/[,;]+/', $list) ?: [] as $addr) {
            $addr = trim($addr);
            if ($addr === '') {
                continue;
            }
            if ($kind === 'to') {
                $this->addTo($addr);
            } elseif ($kind === 'cc') {
                $this->addCc($addr);
            } else {
                $this->addBcc($addr);
            }
        }
        return $this;
    }

    public function setReplyTo(string $email, string $name = ''): self
    {
        $this->replyTo = [self::assertEmail($email), self::clean($name)];
        return $this;
    }

    public function setSubject(string $subject): self
    {
        $this->subject = self::clean($subject);
        return $this;
    }

    public function setHtml(string $html): self
    {
        $this->html = $html;
        return $this;
    }

    public function setText(string $text): self
    {
        $this->text = $text;
        return $this;
    }

    public function addHeader(string $name, string $value): self
    {
        if (!preg_match('/^[A-Za-z0-9-]+$/', $name)) {
            throw new InvalidArgumentException('Invalid header name');
        }
        $this->extraHeaders[$name] = self::clean($value);
        return $this;
    }

    public function fromAddress(): string
    {
        return $this->from[0];
    }

    /** Envelope recipients (To + Cc + Bcc), de-duplicated. @return string[] */
    public function recipients(): array
    {
        $all = [];
        foreach (array_merge($this->to, $this->cc, $this->bcc) as $r) {
            $all[strtolower($r[0])] = $r[0];
        }
        return array_values($all);
    }

    /** Full message (headers + body) with CRLF line endings, ready for SMTP DATA. */
    public function build(): string
    {
        if ($this->from[0] === '' || !$this->to) {
            throw new LogicException('A message needs a From address and at least one To address');
        }
        $domain = substr(strrchr($this->from[0], '@') ?: '@localhost', 1);
        $boundary = '=_alt_' . bin2hex(random_bytes(12));

        $h = [];
        $h[] = 'Date: ' . date('r');
        $h[] = 'From: ' . self::formatAddress($this->from);
        $h[] = 'To: ' . implode(', ', array_map([self::class, 'formatAddress'], $this->to));
        if ($this->cc) {
            $h[] = 'Cc: ' . implode(', ', array_map([self::class, 'formatAddress'], $this->cc));
        }
        // Bcc is deliberately NOT written as a header — only used in the SMTP envelope.
        if ($this->replyTo) {
            $h[] = 'Reply-To: ' . self::formatAddress($this->replyTo);
        }
        $h[] = 'Subject: ' . self::encodeHeader($this->subject);
        $h[] = 'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . '>';
        $h[] = 'MIME-Version: 1.0';
        foreach ($this->extraHeaders as $name => $value) {
            $h[] = $name . ': ' . self::encodeHeader($value);
        }

        $text = $this->text !== '' ? $this->text : self::htmlToText($this->html);
        if ($this->html === '') {
            $h[] = 'Content-Type: text/plain; charset=UTF-8';
            $h[] = 'Content-Transfer-Encoding: base64';
            return implode("\r\n", $h) . "\r\n\r\n" . self::b64($text);
        }

        $h[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
        $body = "This is a multi-part message in MIME format.\r\n\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . self::b64($text) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . self::b64($this->html) . "\r\n"
            . "--{$boundary}--\r\n";

        return implode("\r\n", $h) . "\r\n\r\n" . $body;
    }

    // ---- helpers ------------------------------------------------------------

    /** Removes CR / LF / NUL so a value can never break out of its header. */
    public static function clean(string $s): string
    {
        return trim(str_replace(["\r", "\n", "\0"], ' ', $s));
    }

    public static function assertEmail(string $email): string
    {
        $email = self::clean($email);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Invalid email address: ' . $email);
        }
        return $email;
    }

    /** RFC 2047 encoded-word for non-ASCII header text. */
    public static function encodeHeader(string $s): string
    {
        if ($s === '' || preg_match('/^[\x20-\x7E]*$/', $s)) {
            return $s;
        }
        // split into chunks so each encoded-word stays under the 75-char limit
        $out = [];
        foreach (self::utf8Chunks($s, 45) as $chunk) {
            $out[] = '=?UTF-8?B?' . base64_encode($chunk) . '?=';
        }
        return implode("\r\n ", $out);
    }

    /** @param array{0:string,1:string} $a */
    private static function formatAddress(array $a): string
    {
        [$email, $name] = $a;
        if ($name === '') {
            return $email;
        }
        $display = preg_match('/^[\x20-\x7E]*$/', $name)
            ? '"' . addcslashes($name, '"\\') . '"'
            : self::encodeHeader($name);
        return $display . ' <' . $email . '>';
    }

    private static function b64(string $s): string
    {
        return rtrim(chunk_split(base64_encode($s), 76, "\r\n"));
    }

    /** @return string[] */
    private static function utf8Chunks(string $s, int $bytes): array
    {
        $chunks = [];
        $cur = '';
        foreach (preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $ch) {
            if (strlen($cur . $ch) > $bytes) {
                $chunks[] = $cur;
                $cur = '';
            }
            $cur .= $ch;
        }
        if ($cur !== '') {
            $chunks[] = $cur;
        }
        return $chunks;
    }

    private static function htmlToText(string $html): string
    {
        $t = preg_replace('~<(br|/p|/tr|/h[1-6]|/div)\b[^>]*>~i', "\n", $html) ?? $html;
        $t = html_entity_decode(strip_tags($t), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $t = preg_replace("/[ \t]+/", ' ', $t) ?? $t;
        return trim(preg_replace("/\n\s*\n+/", "\n\n", $t) ?? $t);
    }
}
