<?php
/**
 * SmtpMailer — a small, dependency-free SMTP client (no Composer / PHPMailer).
 *
 *   $mailer = new SmtpMailer([
 *       'host' => 'mail.example.com', 'port' => 465, 'secure' => 'ssl',   // or 587 + 'tls'
 *       'username' => 'hello@example.com', 'password' => '…',
 *   ]);
 *   $mailer->send($mimeMessage);      // throws SmtpException on any failure
 *   $mailer->testConnection();        // connect + login + quit, sends nothing
 *
 * Supports implicit TLS (port 465), STARTTLS (587/25), AUTH LOGIN and AUTH PLAIN,
 * multi-line replies and dot-stuffing. Keeps a transcript (password redacted)
 * for debugging. PHP 7.4+, needs the openssl extension.
 */
declare(strict_types=1);

defined('LEAD_API') || exit;

final class SmtpException extends RuntimeException
{
}

final class SmtpMailer
{
    /** @var array<string,mixed> */
    private $cfg;
    /** @var resource|null */
    private $sock = null;
    /** @var string[] */
    private $transcript = [];
    /** @var string[] server EHLO capabilities, upper-case */
    private $caps = [];

    /** @param array<string,mixed> $cfg */
    public function __construct(array $cfg)
    {
        $this->cfg = array_merge([
            'host' => '',
            'port' => 465,
            'secure' => 'ssl',          // 'ssl' (implicit TLS, 465) | 'tls' (STARTTLS) | '' (none — not recommended)
            'username' => '',
            'password' => '',
            'timeout' => 20,
            'verify_peer' => true,      // set false only if the host's certificate doesn't match its mail hostname
            'helo' => '',
        ], $cfg);
        if ($this->cfg['host'] === '') {
            throw new InvalidArgumentException('SMTP host is required');
        }
    }

    public function send(MimeMessage $message): void
    {
        $data = $message->build();          // build first: fail fast before opening a connection
        $rcpts = $message->recipients();
        try {
            $this->open();
            $this->command('MAIL FROM:<' . $message->fromAddress() . '>', [250]);
            foreach ($rcpts as $r) {
                $this->command('RCPT TO:<' . $r . '>', [250, 251]);
            }
            $this->command('DATA', [354]);
            // dot-stuffing (RFC 5321 §4.5.2) + end-of-data marker
            $body = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $data)) ?? $data;
            $body = str_replace("\n", "\r\n", $body);
            $this->write($body . "\r\n.\r\n", '[message body: ' . strlen($body) . ' bytes]');
            $this->expect([250]);
            $this->quit();
        } catch (Throwable $e) {
            $this->abort();
            throw $e instanceof SmtpException ? $e : new SmtpException($e->getMessage(), 0, $e);
        }
    }

    /** Connects and logs in, then quits. Throws SmtpException if anything fails. */
    public function testConnection(): void
    {
        try {
            $this->open();
            $this->quit();
        } catch (Throwable $e) {
            $this->abort();
            throw $e instanceof SmtpException ? $e : new SmtpException($e->getMessage(), 0, $e);
        }
    }

    /** @return string[] conversation log, password redacted */
    public function transcript(): array
    {
        return $this->transcript;
    }

    // ---- connection ---------------------------------------------------------

    private function open(): void
    {
        $this->transcript = [];
        $c = $this->cfg;
        $ssl = [
            'verify_peer' => (bool) $c['verify_peer'],
            'verify_peer_name' => (bool) $c['verify_peer'],
            'allow_self_signed' => !$c['verify_peer'],
            'peer_name' => $c['host'],
            'SNI_enabled' => true,
        ];
        $ctx = stream_context_create(['ssl' => $ssl]);
        $remote = ($c['secure'] === 'ssl' ? 'ssl://' : 'tcp://') . $c['host'] . ':' . (int) $c['port'];

        $errno = 0;
        $errstr = '';
        $sock = @stream_socket_client($remote, $errno, $errstr, (float) $c['timeout'], STREAM_CLIENT_CONNECT, $ctx);
        if (!$sock) {
            throw new SmtpException("Could not connect to {$remote}: {$errstr} ({$errno})");
        }
        $this->sock = $sock;
        stream_set_timeout($sock, (int) $c['timeout']);
        $this->log('-- connected to ' . $remote);

        $this->expect([220]);
        $this->ehlo();

        if ($c['secure'] === 'tls') {
            if (!in_array('STARTTLS', $this->caps, true)) {
                throw new SmtpException('Server does not offer STARTTLS');
            }
            $this->command('STARTTLS', [220]);
            $method = STREAM_CRYPTO_METHOD_TLS_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                $method |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            }
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                $method |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
            }
            if (!@stream_socket_enable_crypto($sock, true, $method)) {
                throw new SmtpException('STARTTLS negotiation failed');
            }
            $this->ehlo();  // capabilities change after TLS
        }

        if ($c['username'] !== '') {
            $this->authenticate((string) $c['username'], (string) $c['password']);
        }
    }

    private function ehlo(): void
    {
        $name = $this->cfg['helo'] ?: ($_SERVER['SERVER_NAME'] ?? gethostname() ?: 'localhost');
        $reply = $this->command('EHLO ' . preg_replace('/[^A-Za-z0-9.\-]/', '', (string) $name), [250]);
        $this->caps = [];
        foreach (array_slice($reply['lines'], 1) as $line) {
            $this->caps[] = strtoupper(trim(substr($line, 4)));
        }
        // keep the AUTH line's mechanisms separately addressable
        foreach ($this->caps as $cap) {
            if (strpos($cap, 'AUTH') === 0) {
                foreach (preg_split('/[\s=]+/', substr($cap, 4)) ?: [] as $m) {
                    if ($m !== '') {
                        $this->caps[] = 'AUTH:' . $m;
                    }
                }
            }
        }
    }

    private function authenticate(string $user, string $pass): void
    {
        if (in_array('AUTH:PLAIN', $this->caps, true) && !in_array('AUTH:LOGIN', $this->caps, true)) {
            $this->command('AUTH PLAIN ' . base64_encode("\0" . $user . "\0" . $pass), [235], 'AUTH PLAIN [redacted]');
            return;
        }
        $this->command('AUTH LOGIN', [334]);
        $this->command(base64_encode($user), [334], '[username]');
        $this->command(base64_encode($pass), [235], '[password redacted]');
    }

    private function quit(): void
    {
        if ($this->sock) {
            try {
                $this->command('QUIT', [221]);
            } catch (Throwable $e) {
                // ignore — message already accepted
            }
            fclose($this->sock);
            $this->sock = null;
        }
    }

    private function abort(): void
    {
        if ($this->sock) {
            @fwrite($this->sock, "QUIT\r\n");
            @fclose($this->sock);
            $this->sock = null;
        }
    }

    // ---- protocol -------------------------------------------------------------

    /**
     * @param int[] $okCodes
     * @return array{code:int, lines:string[]}
     */
    private function command(string $cmd, array $okCodes, ?string $logAs = null): array
    {
        $this->write($cmd . "\r\n", $logAs ?? $cmd);
        return $this->expect($okCodes);
    }

    private function write(string $data, string $logAs): void
    {
        if (!$this->sock) {
            throw new SmtpException('Not connected');
        }
        $this->log('> ' . $logAs);
        $len = strlen($data);
        for ($done = 0; $done < $len; $done += $n) {
            $n = @fwrite($this->sock, substr($data, $done, 8192));
            if ($n === false || $n === 0) {
                throw new SmtpException('Connection lost while writing');
            }
        }
    }

    /**
     * @param int[] $okCodes
     * @return array{code:int, lines:string[]}
     */
    private function expect(array $okCodes): array
    {
        $lines = [];
        $code = 0;
        while (true) {
            $line = $this->sock ? fgets($this->sock, 1024) : false;
            if ($line === false) {
                $meta = $this->sock ? stream_get_meta_data($this->sock) : [];
                throw new SmtpException(!empty($meta['timed_out']) ? 'SMTP server timed out' : 'SMTP connection closed unexpectedly');
            }
            $line = rtrim($line, "\r\n");
            $this->log('< ' . $line);
            $lines[] = $line;
            $code = (int) substr($line, 0, 3);
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;  // last line of a (possibly multi-line) reply
            }
        }
        if (!in_array($code, $okCodes, true)) {
            throw new SmtpException('SMTP error: ' . end($lines), $code);
        }
        return ['code' => $code, 'lines' => $lines];
    }

    private function log(string $line): void
    {
        $this->transcript[] = $line;
    }
}
