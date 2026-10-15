# Site assets & settings guide

Plain static HTML / CSS / JS — no build step. Edit the HTML files directly.
Until an image exists, a branded placeholder is shown automatically.

> Format: use `.jpg` for photos — lowercase names, no spaces.
> Optimise images before uploading (TinyPNG / Squoosh) so the site stays fast.

---

## 1. Project images — `assets/images/projects/<project>/`
Folders: `aqua-city`, `everland`, `forreste`, `uplands`, `highgrove`, `alcove`, `smartpark`.

Each folder holds `banner.jpg`, `gallery-1.jpg` … `gallery-6.jpg` plus named images
taken from that project's brochure (e.g. `aqua-city/kashi-ghat.jpg`,
`highgrove/villa-3bhk.jpg`, `highgrove/plan-3bhk.jpg`). Each image is referenced by
name in its project page — overwrite a file with the same name to replace it.

- **Hero (top) image** of each project page and the home slider use a large image
  per project (e.g. `aqua-city/lake.jpg`, `uplands/golf-aerial.jpg`) — see the
  `hero-media` block at the top of each `projects/arvind-<project>.html`.
- **Feature rows** (image + text blocks): a row with several `<img class="fslide">`
  becomes a small slider automatically. Add or remove `<img class="fslide">` tags freely.
- **Gallery**: add a `<div class="swiper-slide"><img …></div>` inside `.gallery-swiper`.

Recommended size: **1800–2400 px wide**, landscape.

## 2. Project brochures (PDF) — `assets/brochures/`
Named `arvind-<project>.pdf` (see `assets/brochures/README.md`).
**Arvind Alcove has no brochure yet** — add `arvind-alcove.pdf` and its buttons appear.

**Lead-capture popup:** every *Brochure* button opens a popup asking for name, mobile,
email and a consent tick. On submit it (1) sends the lead to the lead endpoint if one
is set, (2) downloads that project's PDF, (3) opens `thank-you.html?project=<slug>`.
Buttons in the header / floating tab / footer have no fixed project, so the popup
shows a project picker. On a live (http/https) site, projects whose PDF is missing
are hidden from buttons and the picker automatically.

## 3. Awards — `assets/images/awards/`
Images `award-1.jpg`, `award-2.jpg`, … To add one, copy a `<figure>` block in `awards.html`.

## 4. Logo, partner logo & favicon — `assets/`
- `logo.png` — Arvind SmartSpaces logo, rendered **white** by a CSS filter
  (`.logo-img { filter: brightness(0) invert(1) }` in `css/style.css`).
- `channel-partner-logo.jpg` — Daksh Realtors logo (footer + About section).
- `favicon.png` — browser-tab icon.

---

## Settings to wire up
All in `js/main.js`, section **0. SITE SETTINGS** at the top:

- **`leadEndpoint`** — paste a Formspree / Google Apps Script / CRM URL to **collect
  every lead** (brochure popup + site-visit forms). Leads are POSTed as JSON:
  `{ form, name, email, phone, city, project, message, visit_date, visit_time, consent, page }`.
  While it is blank, no lead is stored anywhere: brochures still download, and the
  site-visit form opens WhatsApp with the visitor's details pre-filled.
- **`whatsapp`** — the WhatsApp number used for pre-filled enquiries.

The phone / WhatsApp number shown on the pages is a plain link in the HTML — search all
`.html` files for `919712131519` / `97121 31519` to change it.

Animation code lives only in `js/animations.js` and is driven by `data-animate`
attributes in the HTML — to animate a new block, copy the attribute from a similar element.
