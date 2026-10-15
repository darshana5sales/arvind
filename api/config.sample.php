<?php
/**
 * Lead mailer settings — TEMPLATE.
 *
 * On the server: copy this file to  api/config.php  and fill in the real values.
 * config.php is git-ignored on purpose — NEVER commit real credentials
 * (the GitHub repository is public).
 */
defined('LEAD_API') || exit;

// ---- SMTP account the website sends from ---------------------------------------
define('SMTP_HOST',      'mail.example.com');
define('SMTP_PORT',      465);                          // 465 = SSL, 587 = STARTTLS
define('SMTP_USER',      'hello@example.com');
define('SMTP_PASS',      'change-me');
define('MAIL_FROM',      'hello@example.com');           // must be the SMTP account (or an alias of it)
define('MAIL_FROM_NAME', 'Arvind SmartSpaces Projects');

// ---- Who receives the leads ----------------------------------------------------
define('MAIL_TO',        'you@example.com');             // comma-separated list allowed
define('MAIL_CC',        '');                            // optional, comma-separated
define('MAIL_BCC',       '');                            // optional, comma-separated
define('SITE_NAME',      'Arvind SmartSpaces Projects'); // shown in the email header / subject

// ---- Optional (defaults shown) --------------------------------------------------
// define('SMTP_SECURE', 'ssl');          // 'ssl' for 465, 'tls' for 587
// define('SMTP_VERIFY_PEER', true);      // false only if the mail server's certificate doesn't match SMTP_HOST
// define('SMTP_TIMEOUT', 20);            // seconds
// Websites allowed to post leads here (needed when the site is on another domain, e.g. GitHub Pages):
// define('ALLOWED_ORIGINS', 'https://darshana5sales.github.io,https://www.example.com');
// define('RATE_LIMIT_MAX', 5);           // submissions per IP …
// define('RATE_LIMIT_WINDOW', 600);      // … per this many seconds
// define('SAVE_LEADS_CSV', true);        // keep a backup of every lead in api/storage/leads-YYYY-MM.csv
