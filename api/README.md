# Lead mailer (PHP)

Emails every website lead (brochure popup + "Book Free Site Visit" forms) over
authenticated SMTP, using a small built-in library — no Composer / PHPMailer.

```
api/
  send-lead.php        ← the endpoint the forms POST to (the only public file)
  bootstrap.php        loads config + library
  config.sample.php    settings template (committed)
  config.php           REAL settings — git-ignored, create it on the server
  lib/
    SmtpMailer.php     SMTP client: SSL 465 / STARTTLS 587, AUTH LOGIN/PLAIN, transcript
    MimeMessage.php    builds the email (HTML + text, UTF-8, header-injection safe)
    Lead.php           validation + email template
    Storage.php        CSV backup of every lead, rate limiting, error log
  storage/             leads-YYYY-MM.csv, errors.log (blocked from the web)
  tools/smtp-test.php  command-line SMTP check
```

Needs PHP 7.4+ with the `openssl` extension (standard on SiteGround / cPanel hosts).
GitHub Pages cannot run PHP — the `api/` folder must live on a PHP host.

## Deploy — option A: whole site on the PHP host (simplest)
1. Upload the whole site (including `api/`) to the host, e.g. SiteGround.
2. Create `api/config.php` from `config.sample.php` and fill in the SMTP details.
3. Make `api/storage/` writable by PHP (755 is usually enough on SiteGround).
4. Nothing to change in the website: `js/main.js` already posts to `api/send-lead.php`.

## Deploy — option B: site stays on GitHub Pages, only `api/` on the PHP host
1. Upload the `api/` folder to the PHP host, e.g. `https://www.arvindaquacity.co.in/lead-api/`.
2. Create `config.php` there and make sure `ALLOWED_ORIGINS` includes `https://darshana5sales.github.io`.
3. In `js/main.js` set
   `leadEndpoint: "https://www.arvindaquacity.co.in/lead-api/send-lead.php"`
   and push.

## Check it
- From SSH: `php api/tools/smtp-test.php` (logs in, sends nothing) or
  `php api/tools/smtp-test.php --send you@example.com` (one test email to that address only).
- Submit a form on the live site — the email arrives at `MAIL_TO` (+ CC/BCC).
- Every lead is also appended to `api/storage/leads-YYYY-MM.csv`; if an email ever fails,
  the lead is still in that file and the reason is in `api/storage/errors.log`.

## Behaviour
- Validates name, mobile (Indian 10-digit or international `+…`), email (required for
  brochures), city and project; returns `422` with the messages, which the form shows.
- Honeypot field `website` silently drops bots; max 5 submissions per IP per 10 minutes (`429`).
- Brochure downloads never wait on the email — if the mailer is unreachable the PDF still downloads.
- If the site-visit form can't reach the mailer, the visitor lands on the thank-you page with a
  one-tap "send on WhatsApp" button holding their details.
