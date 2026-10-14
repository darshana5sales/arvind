# Image drop-in guide

The website is built to use the **exact filenames below**. Just drop your final
images into the right folder using the same name — you don't need to touch any HTML.
Until a real image exists, a branded placeholder is shown automatically.

> Format: use `.jpg` (photos) — keep names lowercase, no spaces.
> Optimise images before uploading (TinyPNG / Squoosh) so the site stays fast.

---

## 1. Project banner — `assets/images/projects/<project>/banner.jpg`
**One banner per project** drives THREE places automatically:
the home hero slider, the project cards (home grid + listing), and the big
banner at the top of that project's detail page. (Already added ✅)

Folders & file: `aqua-city/banner.jpg`, `everland/banner.jpg`,
`forreste/banner.jpg`, `uplands/banner.jpg`, `highgrove/banner.jpg`,
`alcove/banner.jpg`, `smartpark/banner.jpg`.

Recommended size: **2400 × 1350 px** (wide 16:9 desktop banner). To change a
banner, just overwrite that `banner.jpg` — every place using it updates.

> The home hero slider shows 4 of these banners (Aqua City, Forreste, Uplands,
> SmartPark). To feature different projects, edit the `src` of the hero slides
> in `index.html`.

## 2. Project detail galleries — `assets/images/projects/<project>/`
Below the banner, each detail page has a gallery of additional photos named
`gallery-1.jpg`, `gallery-2.jpg`, … (up to **6** by default). These are
separate from `banner.jpg`. To add more, copy a gallery `<figure>` block in
that project's HTML file.

Recommended size: **2000 × 1333 px** (3:2), landscape preferred.

## 3b. Project brochures (PDF) — `assets/brochures/`
Each project's **Download Brochure** button links to its own PDF, named
`arvind-<project>.pdf` (e.g. `arvind-aqua-city.pdf`). Drop the PDF in by that
exact name. See `assets/brochures/README.md` for the full filename list.

**Lead-capture popup (new):** clicking *Download Brochure* on any project detail
page now opens a popup that collects the visitor's **name, email, phone** and a
**consent tick** (permission for an executive to contact them). On submit it:
1. optionally sends the lead to your endpoint (see below),
2. force-downloads **that project's own** PDF, then
3. redirects to **`thank-you.html?project=<slug>`**.

The popup is injected by `js/main.js` (function `initBrochures`) — no per-page
HTML to edit. The button now shows on **every** detail page (it no longer
auto-hides), so leads are captured even for projects whose PDF isn't in yet; if
the PDF is missing the visitor still reaches the thank-you page (with a manual
"download" link there once the file exists).

## 4. Awards — `assets/images/awards/`
Pure image gallery. Name them `award-1.jpg`, `award-2.jpg`, … in order.
To add/remove, copy or delete an awards `<figure>` block in `awards.html`.

Recommended size: **1200 × 1500 px** (portrait certificate) or any consistent ratio.

## 5. Logo & favicon — `assets/`
- `logo.png` — header & footer logo. The **official Arvind logo** is in place.
  - It sits on a **dark** background, so it is rendered **white** via a CSS filter
    (`.brand-logo { filter: brightness(0) invert(1) }` in `css/style.css`).
  - To replace it, just overwrite `assets/logo.png` — every page updates automatically.
  - Want the original **maroon** colour instead? Delete the `filter:` line under
    `.brand-logo` in `css/style.css` (the black "SMARTSPACES" will then be hard to read
    on the dark header unless the header is made light).
  - Logo size is controlled in `css/style.css` (`.brand-logo { height: 38px }`).
- `favicon.png` — 512 × 512 px

---

## Things the developer must wire up (not animation)
- **Contact form**: currently opens the visitor's email app (`mailto:`) as a safe
  default. To collect submissions properly, set a Formspree (or backend) endpoint —
  see the comment marked `FORM ENDPOINT` in `contact.html`.
- **Brochure leads**: the download popup collects name/email/phone/consent. To
  actually capture those leads, paste your Formspree (or own API) URL into the
  `BROCHURE_LEAD_ENDPOINT` constant near the top of `initBrochures()` in
  `js/main.js`. Left blank, the download + thank-you flow still works — you just
  won't receive the lead. The lead is POSTed as JSON:
  `{ name, email, phone, consent, project, page }`.
- **Google Maps**: replace the sample `<iframe src="...">` in `contact.html` with the
  embed link for your real office locations.
- Animation code lives only in `js/animations.js` and is **driven by `data-animate`
  attributes in the HTML** — never edit that file. To animate a new block, copy the
  `data-animate="..."` attribute from a similar element.
