<?php
/**
 * Storage — lead backup (monthly CSV), per-IP rate limiting and an error log,
 * all inside api/storage/ (blocked from the web by api/storage/.htaccess).
 */
declare(strict_types=1);

defined('LEAD_API') || exit;

final class Storage
{
    /** @var string */
    private $dir;

    public function __construct(string $dir)
    {
        $this->dir = rtrim($dir, '/\\');
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0750, true);
        }
    }

    /**
     * Appends a lead to storage/leads-YYYY-MM.csv (Excel-friendly, UTF-8 BOM on a new file).
     * @param array<string,string> $lead
     */
    public function saveLead(array $lead, string $mailStatus): bool
    {
        $file = $this->dir . '/leads-' . date('Y-m') . '.csv';
        $isNew = !is_file($file);
        $fh = @fopen($file, 'ab');
        if (!$fh) {
            return false;
        }
        flock($fh, LOCK_EX);
        $cols = ['submitted_at', 'form_label', 'project', 'name', 'phone', 'email', 'city', 'visit_date', 'visit_time', 'message', 'utm', 'page', 'referrer', 'ip'];
        if ($isNew) {
            fwrite($fh, "\xEF\xBB\xBF");
            fputcsv($fh, array_merge($cols, ['mail_status']));
        }
        $row = [];
        foreach ($cols as $c) {
            // neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell)
            $v = $lead[$c] ?? '';
            $row[] = preg_match('/^[=+\-@]/', $v) && $c !== 'phone' ? "'" . $v : $v;
        }
        $row[] = $mailStatus;
        $ok = fputcsv($fh, $row) !== false;
        flock($fh, LOCK_UN);
        fclose($fh);
        return $ok;
    }

    /** True if this IP is still under the limit (and records the attempt). */
    public function allow(string $ip, int $max, int $windowSeconds): bool
    {
        $file = $this->dir . '/rate-' . sha1($ip . '|' . __FILE__) . '.json';
        $now = time();
        $fh = @fopen($file, 'c+');
        if (!$fh) {
            return true;  // fail open: never block a real customer because of disk issues
        }
        flock($fh, LOCK_EX);
        $hits = json_decode((string) stream_get_contents($fh), true);
        $hits = array_values(array_filter(is_array($hits) ? $hits : [], static function ($t) use ($now, $windowSeconds) {
            return is_int($t) && $t > $now - $windowSeconds;
        }));
        $allowed = count($hits) < $max;
        if ($allowed) {
            $hits[] = $now;
        }
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($hits));
        flock($fh, LOCK_UN);
        fclose($fh);
        if (mt_rand(1, 50) === 1) {
            $this->pruneRateFiles($windowSeconds);
        }
        return $allowed;
    }

    public function logError(string $message): void
    {
        @file_put_contents($this->dir . '/errors.log', '[' . date('Y-m-d H:i:s') . '] ' . $message . "\n", FILE_APPEND | LOCK_EX);
    }

    private function pruneRateFiles(int $windowSeconds): void
    {
        foreach (glob($this->dir . '/rate-*.json') ?: [] as $f) {
            if (@filemtime($f) < time() - $windowSeconds * 2) {
                @unlink($f);
            }
        }
    }
}
