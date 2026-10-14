/* ==========================================================================
   main.js  —  Site behaviour: smooth scroll, sliders, nav, lightbox,
               image fallbacks, contact form.
   (Animation reveals live in animations.js — keep them separate.)
   ========================================================================== */

(function () {
  "use strict";
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1. Branded fallback for any image that hasn't been added yet ------ */
  // Lets the dev reference final filenames now; a nice placeholder shows until
  // the real file is dropped into /assets. No HTML editing needed later.
  function attachImageFallbacks() {
    document.querySelectorAll("img[data-fallback]").forEach((img) => {
      const swap = () => {
        if (img.dataset.failed) return;
        img.dataset.failed = "1";
        const label = img.getAttribute("alt") || "Arvind SmartSpaces";
        const ph = document.createElement("div");
        ph.className = "img-placeholder";
        ph.innerHTML = `<span>${label}</span>`;
        img.replaceWith(ph);
      };
      img.addEventListener("error", swap);
      // Already errored before JS ran (cached broken)?
      if (img.complete && img.naturalWidth === 0) swap();
    });
  }

  /* ---- 2. Lenis smooth scroll ------------------------------------------- */
  function initSmoothScroll() {
    if (prefersReduced || typeof window.Lenis === "undefined") return;
    const lenis = new window.Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Keep ScrollTrigger in sync with Lenis.
    if (window.ScrollTrigger) {
      lenis.on("scroll", window.ScrollTrigger.update);
    }
    // In-page anchor links use Lenis too.
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href"));
        if (target) {
          e.preventDefault();
          lenis.scrollTo(target, { offset: -80 });
        }
      });
    });
  }

  /* ---- 3. Header: solidify on scroll + mobile menu ---------------------- */
  function initHeader() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".nav-toggle");
    // Transparent over a full-bleed hero (home + project pages) until you
    // scroll; every other page keeps the solid header at all times.
    const hasHero = document.querySelector(".hero, .detail-hero");
    if (header && hasHero) {
      const onScroll = () =>
        header.classList.toggle("scrolled", window.scrollY > 40);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    } else if (header) {
      header.classList.add("scrolled");
    }
    if (toggle) {
      toggle.addEventListener("click", () =>
        document.body.classList.toggle("nav-open")
      );
      document
        .querySelectorAll(".nav-links a")
        .forEach((a) =>
          a.addEventListener("click", () =>
            document.body.classList.remove("nav-open")
          )
        );
    }
  }

  /* ---- 4. Hero slider (Swiper) ------------------------------------------ */
  function initHeroSlider() {
    const el = document.querySelector(".hero .swiper");
    if (!el || typeof window.Swiper === "undefined") return;
    const bar = document.querySelector(".hero-progress .bar");
    const count = document.querySelector(".hero-count");

    const swiper = new window.Swiper(el, {
      loop: true,
      speed: 1100,
      effect: "fade",
      fadeEffect: { crossFade: true },
      autoplay: { delay: 5500, disableOnInteraction: false },
      on: {
        slideChange() {
          if (count) {
            const n = (this.realIndex + 1).toString().padStart(2, "0");
            const total = this.slides.length - 2; // minus loop clones
            count.textContent = `${n} — ${total.toString().padStart(2, "0")}`;
          }
          // Re-run the per-slide caption reveal.
          const active = this.slides[this.activeIndex];
          if (active) {
            const cap = active.querySelectorAll("[data-slide-anim]");
            if (window.gsap && !prefersReduced) {
              window.gsap.fromTo(
                cap,
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.1 }
              );
            }
          }
        },
        autoplayTimeLeft(s, time, progress) {
          if (bar) bar.style.setProperty("--p", 1 - progress);
        },
      },
    });
    // Fire first caption reveal.
    swiper.emit("slideChange");
  }

  /* ---- 5. Generic gallery slider (project detail pages) ----------------- */
  function initGallerySliders() {
    if (typeof window.Swiper === "undefined") return;
    document.querySelectorAll(".gallery-swiper").forEach((el) => {
      new window.Swiper(el, {
        slidesPerView: 1.15,
        spaceBetween: 16,
        speed: 700,
        grabCursor: true,
        breakpoints: {
          640: { slidesPerView: 1.8, spaceBetween: 22 },
          1024: { slidesPerView: 2.4, spaceBetween: 26 },
        },
        navigation: {
          nextEl: el.querySelector(".gs-next"),
          prevEl: el.querySelector(".gs-prev"),
        },
      });
    });
  }

  /* ---- 6. Lightbox (awards + project galleries) ------------------------- */
  function initLightbox() {
    const triggers = Array.from(
      document.querySelectorAll("[data-lightbox] img")
    ).filter((img) => img.tagName === "IMG");
    if (!triggers.length) return;

    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `
      <button class="lb-close" aria-label="Close">&times;</button>
      <button class="lb-prev" aria-label="Previous">&#8249;</button>
      <button class="lb-next" aria-label="Next">&#8250;</button>
      <img alt="">`;
    document.body.appendChild(box);
    const imgEl = box.querySelector("img");
    let index = 0;

    const srcOf = (t) => t.dataset.full || t.currentSrc || t.src;
    function show(i) {
      index = (i + triggers.length) % triggers.length;
      imgEl.src = srcOf(triggers[index]);
      imgEl.alt = triggers[index].alt || "";
    }
    function open(i) {
      show(i);
      box.classList.add("open");
      requestAnimationFrame(() => box.classList.add("visible"));
      document.body.style.overflow = "hidden";
    }
    function close() {
      box.classList.remove("visible");
      document.body.style.overflow = "";
      setTimeout(() => box.classList.remove("open"), 400);
    }

    triggers.forEach((img, i) => {
      // skip placeholders that already failed
      img.style.cursor = "zoom-in";
      img.addEventListener("click", () => open(i));
    });
    box.querySelector(".lb-close").addEventListener("click", close);
    box.querySelector(".lb-next").addEventListener("click", () => show(index + 1));
    box.querySelector(".lb-prev").addEventListener("click", () => show(index - 1));
    box.addEventListener("click", (e) => {
      if (e.target === box) close();
    });
    document.addEventListener("keydown", (e) => {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "ArrowLeft") show(index - 1);
    });
  }

  /* ---- 7. Listing filter chips (visual filter by city) ------------------ */
  function initFilters() {
    const chips = document.querySelectorAll(".filter-chip");
    if (!chips.length) return;
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        const f = chip.dataset.filter;
        document.querySelectorAll("[data-category]").forEach((card) => {
          const show = f === "all" || card.dataset.category === f;
          card.style.display = show ? "" : "none";
        });
        if (window.__refreshScroll) window.__refreshScroll();
      });
    });
  }

  /* ---- 8. Pre-select project on contact form via ?project= -------------- */
  function initContactPrefill() {
    const select = document.querySelector("#project");
    if (!select) return;
    const param = new URLSearchParams(location.search).get("project");
    if (param) {
      const match = Array.from(select.options).find(
        (o) => o.value.toLowerCase() === param.toLowerCase()
      );
      if (match) select.value = match.value;
    }
  }

  /* ---- 9. Contact form: validation + safe mailto submit ----------------- */
  function initContactForm() {
    const form = document.querySelector("#enquiry-form");
    if (!form) return;
    const success = form.querySelector(".form-success");

    function setError(field, on) {
      field.classList.toggle("invalid", on);
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;
      form.querySelectorAll("[required]").forEach((input) => {
        const field = input.closest(".field, .consent");
        let valid = input.value.trim() !== "";
        if (input.type === "email")
          valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
        if (input.type === "checkbox") valid = input.checked;
        setError(field, !valid);
        if (!valid) ok = false;
      });
      if (!ok) return;

      // FORM ENDPOINT --------------------------------------------------------
      // Default: opens the visitor's email client (no backend needed).
      // To collect submissions, set form action to a Formspree URL and
      // remove this mailto block. See assets/README.md.
      if (!form.getAttribute("action")) {
        const get = (n) => encodeURIComponent((form.querySelector(`[name="${n}"]`) || {}).value || "");
        const body = `Name: ${get("name")}%0D%0APhone: ${get("phone")}%0D%0AEmail: ${get("email")}%0D%0AProject: ${get("project")}%0D%0A%0D%0A${get("message")}`;
        window.location.href = `mailto:sales@arvindsmartspaces.com?subject=Enquiry%20-%20Arvind%20SmartSpaces&body=${body}`;
      } else {
        form.submit();
        return;
      }
      if (success) success.style.display = "block";
      form.reset();
    });

    // Clear error state as the user fixes a field.
    form.addEventListener("input", (e) => {
      const field = e.target.closest(".field, .consent");
      if (field) field.classList.remove("invalid");
    });
  }

  /* ---- 9b. Brochure download — lead-capture gate ------------------------- */
  // Every "Download Brochure" button (a[data-brochure]) opens a popup that
  // collects the visitor's name / email / phone + a consent tick BEFORE the
  // download. On submit we: (1) optionally send the lead to your endpoint,
  // (2) force-download THAT project's own PDF, (3) redirect to thank-you.html.
  // The popup markup is injected here so no per-page HTML editing is needed.
  //
  // LEAD ENDPOINT --------------------------------------------------------------
  // Leave "" to skip sending (the download + thank-you still work). To actually
  // COLLECT the leads, paste your Formspree (or own API) URL below — the form
  // is POSTed there as { name, email, phone, consent, project, page }.
  const BROCHURE_LEAD_ENDPOINT = "";

  function initBrochures() {
    const buttons = Array.from(document.querySelectorAll("a[data-brochure]"));
    if (!buttons.length) return;

    // Over http(s), hide the button for any project whose PDF isn't uploaded
    // yet (no broken buttons). Over file:// browsers can't check, so it shows.
    if (/^https?:$/.test(location.protocol)) {
      buttons.forEach((a) => {
        fetch(a.getAttribute("href"), { method: "HEAD" })
          .then((r) => { if (!r.ok) a.style.display = "none"; })
          .catch(() => {});
      });
    }

    // --- build the popup once ---
    const modal = document.createElement("div");
    modal.className = "lead-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="lead-backdrop" data-lead-close></div>
      <div class="lead-dialog" role="dialog" aria-modal="true" aria-labelledby="lead-title">
        <button class="lead-x" type="button" aria-label="Close" data-lead-close>&times;</button>
        <span class="lead-eyebrow">Download Brochure</span>
        <h3 class="lead-title" id="lead-title" data-lead-project>Brochure</h3>
        <p class="lead-sub">Share your details and your brochure will download right away.</p>
        <form class="lead-form" novalidate>
          <div class="field">
            <label for="lead-name">Full name</label>
            <input id="lead-name" name="name" type="text" autocomplete="name" required />
            <span class="err">Please enter your name.</span>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="lead-email">Email</label>
              <input id="lead-email" name="email" type="email" autocomplete="email" required />
              <span class="err">Enter a valid email.</span>
            </div>
            <div class="field">
              <label for="lead-phone">Phone</label>
              <input id="lead-phone" name="phone" type="tel" autocomplete="tel" required />
              <span class="err">Enter a valid phone number.</span>
            </div>
          </div>
          <label class="consent">
            <input type="checkbox" name="consent" required />
            <span>I authorise Arvind SmartSpaces &amp; its representatives to contact me about this enquiry via call, SMS, email or WhatsApp.</span>
          </label>
          <button type="submit" class="btn btn-primary lead-submit">Download Brochure <span class="arrow">↓</span></button>
          <p class="lead-fineprint">Your details are used only to share this brochure and follow up on your enquiry.</p>
        </form>
      </div>`;
    document.body.appendChild(modal);

    const form = modal.querySelector(".lead-form");
    const titleEl = modal.querySelector("[data-lead-project]");
    const submitBtn = modal.querySelector(".lead-submit");
    let current = null; // { url, file, slug, thankYou }

    function open() {
      modal.classList.add("open");
      requestAnimationFrame(() => modal.classList.add("visible"));
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      const first = form.querySelector('input[name="name"]');
      if (first) setTimeout(() => first.focus(), 80);
    }
    function close() {
      modal.classList.remove("visible");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      setTimeout(() => modal.classList.remove("open"), 400);
    }

    // Wire each button to open the popup (instead of downloading directly).
    buttons.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const url = a.getAttribute("href");
        const file = url.split("/").pop();                       // arvind-uplands.pdf
        const slug = file.replace(/^arvind-/, "").replace(/\.pdf$/i, "");
        const base = url.slice(0, url.indexOf("assets/"));        // ../  (we're in /projects/)
        const name = (document.querySelector(".detail-title") || {}).textContent || "this project";
        current = { url, file, slug, thankYou: base + "thank-you.html?project=" + encodeURIComponent(slug) };
        titleEl.textContent = name.trim();
        open();
      });
    });

    // Close interactions.
    modal.querySelectorAll("[data-lead-close]").forEach((el) =>
      el.addEventListener("click", close)
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
    });
    form.addEventListener("input", (e) => {
      const field = e.target.closest(".field, .consent");
      if (field) field.classList.remove("invalid");
    });

    // Start the download straight away (same-origin `download` attribute), so
    // large PDFs don't have to load into memory before the redirect. Over
    // file:// the attribute is ignored, so open the PDF in a new tab instead.
    function startDownload(url, filename) {
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      if (location.protocol === "file:") { a.target = "_blank"; a.rel = "noopener"; }
      document.body.appendChild(a); a.click(); a.remove();
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!current) return;

      // validate
      let ok = true;
      form.querySelectorAll("[required]").forEach((input) => {
        const field = input.closest(".field, .consent");
        let valid = input.value.trim() !== "";
        if (input.type === "email") valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
        if (input.type === "tel") valid = (input.value.replace(/\D/g, "").length >= 7);
        if (input.type === "checkbox") valid = input.checked;
        field.classList.toggle("invalid", !valid);
        if (!valid) ok = false;
      });
      if (!ok) return;

      const lead = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        consent: form.consent.checked,
        project: titleEl.textContent,
        page: location.href,
      };

      // (1) send the lead if an endpoint is configured (fire-and-forget).
      if (BROCHURE_LEAD_ENDPOINT) {
        try {
          fetch(BROCHURE_LEAD_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(lead),
          }).catch(() => {});
        } catch (_) { /* never block the download */ }
      }

      // (2) start the brochure download, then (3) go to the thank-you page.
      submitBtn.setAttribute("disabled", "");
      submitBtn.textContent = "Starting your download…";
      const thankYou = current.thankYou;
      startDownload(current.url, current.file);
      setTimeout(() => { window.location.href = thankYou; }, 1200);
    });
  }

  /* ---- 9c. Amenity icons (auto-matched from the text) -------------------- */
  // Gives every <li> in an .amenities-grid a relevant line icon, picked by
  // keyword from its text. The developer keeps writing plain <li>Text</li> —
  // a matching icon is assigned automatically (falls back to sparkles).
  // Icons: Tabler Icons (MIT, tabler.io/icons) + a few custom ones in the same style.
  function initAmenityIcons() {
    const lists = document.querySelectorAll(".amenities-grid");
    if (!lists.length) return;

    const svg = (inner) =>
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

    const I = {
      "building-community": '<path d="M8 9l5 5v7h-5v-4m0 4h-5v-7l5 -5m1 1v-6a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v17h-8"/><path d="M13 7l0 .01"/><path d="M17 7l0 .01"/><path d="M17 11l0 .01"/><path d="M17 15l0 .01"/>',
      "sofa": '<path d="M4 11a2 2 0 0 1 2 2v1h12v-1a2 2 0 1 1 4 0v5a1 1 0 0 1 -1 1h-18a1 1 0 0 1 -1 -1v-5a2 2 0 0 1 2 -2z"/><path d="M4 11v-3a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v3"/><path d="M12 5v9"/>',
      "books": '<path d="M5 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"/><path d="M9 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z"/><path d="M5 8h4"/><path d="M9 16h4"/><path d="M13.803 4.56l2.184 -.53c.562 -.135 1.133 .19 1.282 .732l3.695 13.418a1.02 1.02 0 0 1 -.634 1.219l-.133 .041l-2.184 .53c-.562 .135 -1.133 -.19 -1.282 -.732l-3.695 -13.418a1.02 1.02 0 0 1 .634 -1.219l.133 -.041z"/><path d="M14 9l4 -1"/><path d="M16 16l3.923 -.98"/>',
      "presentation": '<path d="M3 4l18 0"/><path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10"/><path d="M12 16l0 4"/><path d="M9 20l6 0"/><path d="M8 12l3 -3l2 2l3 -3"/>',
      "ping-pong": '<path d="M12.718 20.713a7.64 7.64 0 0 1 -7.48 -12.755l.72 -.72a7.643 7.643 0 0 1 9.105 -1.283l2.387 -2.345a2.08 2.08 0 0 1 3.057 2.815l-.116 .126l-2.346 2.387a7.644 7.644 0 0 1 -1.052 8.864"/><path d="M14 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M9.3 5.3l9.4 9.4"/>',
      "ball-tennis": '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M6 5.3a9 9 0 0 1 0 13.4"/><path d="M18 5.3a9 9 0 0 0 0 13.4"/>',
      "ball-basketball": '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M5.65 5.65l12.7 12.7"/><path d="M5.65 18.35l12.7 -12.7"/><path d="M12 3a9 9 0 0 0 9 9"/><path d="M3 12a9 9 0 0 1 9 9"/>',
      "ball-volleyball": '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 12a8 8 0 0 0 8 4"/><path d="M7.5 13.5a12 12 0 0 0 8.5 6.5"/><path d="M12 12a8 8 0 0 0 -7.464 4.928"/><path d="M12.951 7.353a12 12 0 0 0 -9.88 4.111"/><path d="M12 12a8 8 0 0 0 -.536 -8.928"/><path d="M15.549 15.147a12 12 0 0 0 1.38 -10.611"/>',
      "ball-football": '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55z"/><path d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45"/>',
      "cricket": '<path d="M11.105 18.79l-1 .992a4.159 4.159 0 0 1 -6.038 -5.715l.157 -.166l8.282 -8.401l1.5 1.5l3.45 -3.391a2.08 2.08 0 0 1 3.057 2.815l-.116 .126l-3.391 3.45l1.5 1.5l-3.668 3.617"/><path d="M10.5 7.5l6 6"/><path d="M14 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>',
      "target-arrow": '<path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M13 3.055a9 9 0 1 0 7.941 7.945"/><path d="M15 6v3h3l3 -3h-3v-3z"/><path d="M15 9l-3 3"/>',
      "roller-skating": '<path d="M5.905 5h3.418a1 1 0 0 1 .928 .629l1.143 2.856a3 3 0 0 0 2.207 1.83l4.717 .926a2.084 2.084 0 0 1 1.682 2.045v.714a1 1 0 0 1 -1 1h-13.895a1 1 0 0 1 -1 -1.1l.8 -8a1 1 0 0 1 1 -.9z"/><path d="M8 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M16 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>',
      "mountain": '<path d="M3 20h18l-6.921 -14.612a2.3 2.3 0 0 0 -4.158 0l-6.921 14.612z"/><path d="M7.5 11l2 2.5l2.5 -2.5l2 3l2.5 -2"/>',
      "telescope": '<path d="M6 21l6 -5l6 5"/><path d="M12 13v8"/><path d="M3.294 13.678l.166 .281c.52 .88 1.624 1.265 2.605 .91l14.242 -5.165a1.023 1.023 0 0 0 .565 -1.456l-2.62 -4.705a1.087 1.087 0 0 0 -1.447 -.42l-.056 .032l-12.694 7.618c-1.02 .613 -1.357 1.897 -.76 2.905z"/><path d="M14 5l3 5.5"/>',
      "binoculars": '<path d="M7 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M17 16m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M16.346 9.17l-.729 -1.261c-.16 -.248 -1.056 -.203 -1.117 .091l-.177 1.38"/><path d="M19.761 14.813l-2.84 -5.133c-.189 -.31 -.592 -.68 -1.421 -.68c-.828 0 -1.5 .448 -1.5 1v6"/><path d="M7.654 9.17l.729 -1.261c.16 -.249 1.056 -.203 1.117 .091l.177 1.38"/><path d="M4.239 14.813l2.84 -5.133c.189 -.31 .592 -.68 1.421 -.68c.828 0 1.5 .448 1.5 1v6"/><rect width="4" height="2" x="10" y="12"/>',
      "butterfly": '<path d="M12 18.176a3 3 0 1 1 -4.953 -2.449l-.025 .023a4.502 4.502 0 0 1 1.483 -8.75c1.414 0 2.675 .652 3.5 1.671a4.5 4.5 0 1 1 4.983 7.079a3 3 0 1 1 -4.983 2.25z"/><path d="M12 19v-10"/><path d="M9 3l3 2l3 -2"/>',
      "campfire": '<path d="M4 21l16 -4"/><path d="M20 21l-16 -4"/><path d="M12 15a4 4 0 0 0 4 -4c0 -3 -2 -3 -2 -8c-4 2 -6 5 -6 8a4 4 0 0 0 4 4z"/>',
      "tree": '<path d="M12 13l-2 -2"/><path d="M12 12l2 -2"/><path d="M12 21v-13"/><path d="M9.824 16a3 3 0 0 1 -2.743 -3.69a3 3 0 0 1 .304 -4.833a3 3 0 0 1 4.615 -3.707a3 3 0 0 1 4.614 3.707a3 3 0 0 1 .305 4.833a3 3 0 0 1 -2.919 3.695h-4z"/>',
      "trees": '<path d="M16 5l3 3l-2 1l4 4l-3 1l4 4h-9"/><path d="M15 21l0 -3"/><path d="M8 13l-2 -2"/><path d="M8 12l2 -2"/><path d="M8 21v-13"/><path d="M5.824 16a3 3 0 0 1 -2.743 -3.69a3 3 0 0 1 .304 -4.833a3 3 0 0 1 4.615 -3.707a3 3 0 0 1 4.614 3.707a3 3 0 0 1 .305 4.833a3 3 0 0 1 -2.919 3.695h-4z"/>',
      "swimming": '<path d="M16 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M6 11l4 -2l3.5 3l-1.5 2"/><path d="M3 16.75a2.4 2.4 0 0 0 1 .25a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 1 -.25"/>',
      "home-2": '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M10 12h4v4h-4z"/>',
      "pool": '<path d="M2 20a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1"/><path d="M2 16a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1"/><path d="M15 12v-7.5a1.5 1.5 0 0 1 3 0"/><path d="M9 12v-7.5a1.5 1.5 0 0 0 -3 0"/><path d="M15 5l-6 0"/><path d="M9 10l6 0"/>',
      "tools-kitchen-2": '<path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12zm0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3"/>',
      "coffee": '<path d="M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1"/><path d="M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2"/><path d="M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2"/><path d="M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z"/><path d="M16.746 16.726a3 3 0 1 0 .252 -5.555"/>',
      "confetti": '<path d="M4 5h2"/><path d="M5 4v2"/><path d="M11.5 4l-.5 2"/><path d="M18 5h2"/><path d="M19 4v2"/><path d="M15 9l-1 1"/><path d="M18 13l2 -.5"/><path d="M18 19h2"/><path d="M19 18v2"/><path d="M14 16.518l-6.518 -6.518l-4.39 9.58a1 1 0 0 0 1.329 1.329l9.579 -4.39z"/>',
      "balloon": '<path d="M14 8a2 2 0 0 0 -2 -2"/><path d="M6 8a6 6 0 1 1 12 0c0 4.97 -2.686 9 -6 9s-6 -4.03 -6 -9"/><path d="M12 17v1a2 2 0 0 1 -2 2h-3a2 2 0 0 0 -2 2"/>',
      "gift": '<path d="M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z"/><path d="M12 8l0 13"/><path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5"/>',
      "grill": '<path d="M19 8h-14a6 6 0 0 0 6 6h2a6 6 0 0 0 6 -5.775l0 -.225z"/><path d="M17 20a2 2 0 1 1 0 -4a2 2 0 0 1 0 4z"/><path d="M15 14l1 2"/><path d="M9 14l-3 6"/><path d="M15 18h-8"/><path d="M15 5v-1"/><path d="M12 5v-1"/><path d="M9 5v-1"/>',
      "barbell": '<path d="M2 12h1"/><path d="M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2"/><path d="M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z"/><path d="M9 12h6"/><path d="M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z"/><path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2"/><path d="M22 12h-1"/>',
      "stretching": '<path d="M16 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M5 20l5 -.5l1 -2"/><path d="M18 20v-5h-5.5l2.5 -6.5l-5.5 1l1.5 2"/>',
      "yoga": '<path d="M12 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M4 20h4l1.5 -3"/><path d="M17 20l-1 -5h-5l1 -7"/><path d="M4 10l4 -1l4 -1l4 1.5l4 1.5"/>',
      "massage": '<path d="M4 17m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M9 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M4 22l4 -2v-3h12"/><path d="M11 20h9"/><path d="M8 14l3 -2l1 -4c3 1 3 4 3 6"/>',
      "music": '<path d="M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M9 17v-13h10v13"/><path d="M9 8h10"/>',
      "masks-theater": '<path d="M13.192 9h6.616a2 2 0 0 1 1.992 2.183l-.567 6.182a4 4 0 0 1 -3.983 3.635h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183z"/><path d="M15 13h.01"/><path d="M18 13h.01"/><path d="M15 16.5c1 .667 2 .667 3 0"/><path d="M8.632 15.982a4.037 4.037 0 0 1 -.382 .018h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183h6.616a2 2 0 0 1 2 2"/><path d="M6 8h.01"/><path d="M9 8h.01"/><path d="M6 12c.764 -.51 1.528 -.63 2.291 -.36"/>',
      "movie": '<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M8 4l0 16"/><path d="M16 4l0 16"/><path d="M4 8l4 0"/><path d="M4 16l4 0"/><path d="M4 12l16 0"/><path d="M16 8l4 0"/><path d="M16 16l4 0"/>',
      "chess-knight": '<path d="M8 16l-1.447 .724a1 1 0 0 0 -.553 .894v2.382h12v-2.382a1 1 0 0 0 -.553 -.894l-1.447 -.724h-8z"/><path d="M9 3l1 3l-3.491 2.148a1 1 0 0 0 .524 1.852h2.967l-2.073 6h7.961l.112 -5c0 -3 -1.09 -5.983 -4 -7c-1.94 -.678 -2.94 -1.011 -3 -1z"/>',
      "dice-5": '<path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><circle cx="8.5" cy="8.5" r=".5" fill="currentColor"/><circle cx="15.5" cy="8.5" r=".5" fill="currentColor"/><circle cx="15.5" cy="15.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="15.5" r=".5" fill="currentColor"/><circle cx="12" cy="12" r=".5" fill="currentColor"/>',
      "baby-carriage": '<path d="M8 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M18 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M2 5h2.5l1.632 4.897a6 6 0 0 0 5.693 4.103h2.675a5.5 5.5 0 0 0 0 -11h-.5v6"/><path d="M6 9h14"/><path d="M9 17l1 -3"/><path d="M16 14l1 3"/>',
      "horse-toy": '<path d="M3.5 17.5c5.667 4.667 11.333 4.667 17 0"/><path d="M19 18.5l-2 -8.5l1 -2l2 1l1.5 -1.5l-2.5 -4.5c-5.052 .218 -5.99 3.133 -7 6h-6a3 3 0 0 0 -3 3"/><path d="M5 18.5l2 -9.5"/><path d="M8 20l2 -5h4l2 5"/>',
      "mood-kid": '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 10l.01 0"/><path d="M15 10l.01 0"/><path d="M9.5 15a3.5 3.5 0 0 0 5 0"/><path d="M12 3a2 2 0 0 0 0 4"/>',
      "flower": '<path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M12 2a3 3 0 0 1 3 3c0 .562 -.259 1.442 -.776 2.64l-.724 1.36l1.76 -1.893c.499 -.6 .922 -1 1.27 -1.205a2.968 2.968 0 0 1 4.07 1.099a3.011 3.011 0 0 1 -1.09 4.098c-.374 .217 -.99 .396 -1.846 .535l-2.664 .366l2.4 .326c1 .145 1.698 .337 2.11 .576a3.011 3.011 0 0 1 1.09 4.098a2.968 2.968 0 0 1 -4.07 1.098c-.348 -.202 -.771 -.604 -1.27 -1.205l-1.76 -1.893l.724 1.36c.516 1.199 .776 2.079 .776 2.64a3 3 0 0 1 -6 0c0 -.562 .259 -1.442 .776 -2.64l.724 -1.36l-1.76 1.893c-.499 .601 -.922 1 -1.27 1.205a2.968 2.968 0 0 1 -4.07 -1.098a3.011 3.011 0 0 1 1.09 -4.098c.374 -.218 .99 -.396 1.846 -.536l2.664 -.366l-2.4 -.325c-1 -.145 -1.698 -.337 -2.11 -.576a3.011 3.011 0 0 1 -1.09 -4.099a2.968 2.968 0 0 1 4.07 -1.099c.348 .203 .771 .604 1.27 1.205l1.76 1.894c-1 -2.292 -1.5 -3.625 -1.5 -4a3 3 0 0 1 3 -3z"/>',
      "ripple": '<path d="M3 7c3 -2 6 -2 9 0s6 2 9 0"/><path d="M3 17c3 -2 6 -2 9 0s6 2 9 0"/><path d="M3 12c3 -2 6 -2 9 0s6 2 9 0"/>',
      "old": '<path d="M11 21l-1 -4l-2 -3v-6"/><path d="M5 14l-1 -3l4 -3l3 2l3 .5"/><path d="M8 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M7 17l-2 4"/><path d="M16 21v-8.5a1.5 1.5 0 0 1 3 0v.5"/>',
      "armchair-2": '<path d="M5 10v-4a3 3 0 0 1 3 -3h8a3 3 0 0 1 3 3v4"/><path d="M16 15v-2a3 3 0 1 1 3 3v3h-14v-3a3 3 0 1 1 3 -3v2"/><path d="M8 12h8"/><path d="M7 19v2"/><path d="M17 19v2"/>',
      "plant-2": '<path d="M2 9a10 10 0 1 0 20 0"/><path d="M12 19a10 10 0 0 1 10 -10"/><path d="M2 9a10 10 0 0 1 10 10"/><path d="M12 4a9.7 9.7 0 0 1 2.99 7.5"/><path d="M9.01 11.5a9.7 9.7 0 0 1 2.99 -7.5"/>',
      "run": '<path d="M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M4 17l5 1l.75 -1.5"/><path d="M15 21l0 -4l-4 -3l1 -6"/><path d="M7 12l0 -3l5 -1l3 3l3 1"/>',
      "walk": '<path d="M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M7 21l3 -4"/><path d="M16 21l-2 -4l-3 -3l1 -6"/><path d="M6 12l2 -3l4 -1l3 3l3 1"/>',
      "bed": '<path d="M7 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M22 17v-3h-20"/><path d="M2 8v9"/><path d="M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5z"/>',
      "bell-ringing": '<path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/><path d="M21 6.727a11.05 11.05 0 0 0 -2.794 -3.727"/><path d="M3 6.727a11.05 11.05 0 0 1 2.792 -3.727"/>',
      "spray": '<path d="M4 10m0 2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2z"/><path d="M6 10v-4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4"/><path d="M15 7h.01"/><path d="M18 9h.01"/><path d="M18 5h.01"/><path d="M21 3h.01"/><path d="M21 7h.01"/><path d="M21 11h.01"/><path d="M10 7h1"/>',
      "golf": '<path d="M12 18v-15l7 4l-7 4"/><path d="M9 17.67c-.62 .36 -1 .82 -1 1.33c0 1.1 1.8 2 4 2s4 -.9 4 -2c0 -.5 -.38 -.97 -1 -1.33"/>',
      "road": '<path d="M4 19l4 -14"/><path d="M16 5l4 14"/><path d="M12 8v-2"/><path d="M12 13v-2"/><path d="M12 18v-2"/>',
      "map-pin": '<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>',
      "plug-connected": '<path d="M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1 -5 -5l1.5 -1.5z"/><path d="M17 12l-5 -5l1.5 -1.5a3.536 3.536 0 1 1 5 5l-1.5 1.5z"/><path d="M3 21l2.5 -2.5"/><path d="M18.5 5.5l2.5 -2.5"/><path d="M10 11l-2 2"/><path d="M13 14l-2 2"/>',
      "bulb": '<path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"/><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"/><path d="M9.7 17l4.6 0"/>',
      "recycle": '<path d="M12 17l-2 2l2 2"/><path d="M10 19h9a2 2 0 0 0 1.75 -2.75l-.55 -1"/><path d="M8.536 11l-.732 -2.732l-2.732 .732"/><path d="M7.804 8.268l-4.5 7.794a2 2 0 0 0 1.506 2.89l1.141 .024"/><path d="M15.464 11l2.732 .732l.732 -2.732"/><path d="M18.196 11.732l-4.5 -7.794a2 2 0 0 0 -3.256 -.14l-.591 .976"/>',
      "scale": '<path d="M7 20l10 0"/><path d="M6 6l6 -1l6 1"/><path d="M12 3l0 17"/><path d="M9 12l-3 -6l-3 6a3 3 0 0 0 6 0"/><path d="M21 12l-3 -6l-3 6a3 3 0 0 0 6 0"/>',
      "truck": '<path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5"/>',
      "building": '<path d="M3 21l18 0"/><path d="M9 8l1 0"/><path d="M9 12l1 0"/><path d="M9 16l1 0"/><path d="M14 8l1 0"/><path d="M14 12l1 0"/><path d="M14 16l1 0"/><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16"/>',
      "building-store": '<path d="M3 21l18 0"/><path d="M3 7v1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1h-18l2 -4h14l2 4"/><path d="M5 21l0 -10.15"/><path d="M19 21l0 -10.15"/><path d="M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4"/>',
      "shield-check": '<path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06"/><path d="M15 19l2 2l4 -4"/>',
      "device-cctv": '<path d="M3 3m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z"/><path d="M12 14m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M19 7v7a7 7 0 0 1 -14 0v-7"/><path d="M12 14l.01 0"/>',
      "ambulance": '<path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5"/><path d="M6 10h4m-2 -2v4"/>',
      "fire-extinguisher": '<path d="M12 7a4 4 0 0 1 4 4v9a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-9a4 4 0 0 1 4 -4z"/><path d="M9 16h6"/><path d="M12 7v-3"/><path d="M16 5l-4 -1l4 -1"/><path d="M12 4h-3a3 3 0 0 0 -3 3"/>',
      "sparkles": '<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z"/>',
      "temple": '<path d="M3 21h18"/><path d="M5 21v-7h14v7"/><path d="M10 21v-3a2 2 0 0 1 4 0v3"/><path d="M7 14c0 -3.5 2.2 -6.5 5 -8c2.8 1.5 5 4.5 5 8"/><path d="M12 6v-3l3 1l-3 1"/>',
      "billiards": '<circle cx="15" cy="15" r="6"/><circle cx="15" cy="15" r="2"/><path d="M3 3l6.5 6.5"/>',
      "shuttlecock": '<path d="M9.5 17.5h5v1a2.5 2.5 0 0 1 -5 0z"/><path d="M9.5 17.5l-3.5 -13.5h12l-3.5 13.5"/><path d="M12 17.5v-13.5"/><path d="M7 8h10"/>',
      "racket": '<ellipse cx="9.5" cy="9.5" rx="5" ry="6.5" transform="rotate(45 9.5 9.5)"/><path d="M13.5 13.5l6.5 6.5"/><path d="M6.5 7.5l5 5M9 5.5l4.5 4.5"/>',
    };

    // Ordered keyword → icon (first match wins; specific terms come first,
    // e.g. "Pool-side Café" is a café and "Amphitheatre" isn't a cinema).
    const MAP = [
      [["kashi ghat", "temple"], "temple"],
      [["golf"], "golf"],
      [["conference", "meeting", "presentation", "seminar"], "presentation"],
      [["library"], "books"],
      [["billiard", "pool table", "snooker"], "billiards"],
      [["table tennis", "ping pong", "pickleball"], "ping-pong"],
      [["badminton"], "shuttlecock"],
      [["squash"], "racket"],
      [["tennis"], "ball-tennis"],
      [["basketball", "multipurpose court"], "ball-basketball"],
      [["volleyball"], "ball-volleyball"],
      [["futsal", "football", "outdoor games"], "ball-football"],
      [["cricket"], "cricket"],
      [["archery"], "target-arrow"],
      [["skating"], "roller-skating"],
      [["climb", "cave"], "mountain"],
      [["gazing", "stargaz", "observ"], "telescope"],
      [["bird"], "binoculars"],
      [["butterfly"], "butterfly"],
      [["campfire", "bonfire"], "campfire"],
      [["tree house"], "tree"],
      [["trail", "jungle", "forest"], "trees"],
      [["kids' pool", "kids pool", "splash"], "swimming"],
      [["villa"], "home-2"],
      [["restaurant", "dining", "canteen", "cuisine", "cafeteria", "food"], "tools-kitchen-2"],
      [["café", "cafe", "coffee"], "coffee"],
      [["banquet"], "confetti"],
      [["party", "celebrat"], "balloon"],
      [["surprise", "gift"], "gift"],
      [["pool", "swim"], "pool"],
      [["barbeque", "barbecue", "bbq", "grill"], "grill"],
      [["gym", "fitness"], "barbell"],
      [["yoga"], "stretching"],
      [["meditat", "zen square"], "yoga"], // not bare "zen" — it's inside "citizen"
      [["spa", "sauna", "steam", "salon", "wellness", "massage"], "massage"],
      [["disco", "music"], "music"],
      [["amphitheat"], "masks-theater"],
      [["theatre", "theater", "cinema", "multimedia"], "movie"],
      [["board game", "puzzle"], "dice-5"],
      [["game", "chess", "carrom"], "chess-knight"],
      [["creche", "crèche"], "baby-carriage"],
      [["play area", "playground", "children", "kids' park", "kids park", "fun square"], "horse-toy"],
      [["kids", "kid's", "kid "], "mood-kid"],
      [["lily", "lilies", "pond"], "flower"],
      [["fire"], "fire-extinguisher"],
      [["lake", "water body", "water bodies", "waterfront"], "ripple"],
      [["senior", "citizen", "elder"], "old"],
      [["sit-out", "sitout", "deck"], "armchair-2"],
      [["garden", "flower", "green", "landscap", "orchard", "lawn"], "plant-2"],
      [["jog", "running", "track", "cycling"], "run"],
      [["walk", "promenade"], "walk"],
      [["guest room", "hotel", "suite", "rooms", "resort", "dormitor", "accommodat"], "bed"],
      [["clubhouse", "club house", "club"], "building-community"],
      [["lounge"], "sofa"],
      [["concierge"], "bell-ringing"],
      [["housekeep"], "spray"],
      [["frontage", "highway", "road"], "road"],
      [["plot"], "map-pin"],
      [["utilit", "plug"], "plug-connected"],
      [["lighting", "street light"], "bulb"],
      [["cetp", "zld", "recycl", "effluent"], "recycle"],
      [["weighbridge"], "scale"],
      [["truck", "logistic", "loading", "dock"], "truck"],
      [["admin", "business", "office"], "building"],
      [["store", "shop", "convenience", "retail"], "building-store"],
      [["cctv", "surveillance", "camera"], "device-cctv"],
      [["security", "gated", "guard"], "shield-check"],
      [["medical", "ambulance", "health", "clinic"], "ambulance"],
      [["court"], "ball-basketball"],
    ];

    const pick = (text) => {
      const t = text.toLowerCase();
      for (const [keys, name] of MAP) {
        if (keys.some((k) => t.indexOf(k) !== -1)) return I[name];
      }
      return I.sparkles;
    };

    lists.forEach((ul) => {
      ul.classList.add("with-icons");
      ul.querySelectorAll("li").forEach((li) => {
        if (li.querySelector(".am-ic")) return;
        const span = document.createElement("span");
        span.className = "am-ic";
        // pick() returns bare <path>s — they must sit inside an <svg> to render
        span.innerHTML = svg(pick(li.textContent || ""));
        li.insertBefore(span, li.firstChild);
      });
    });
  }

  /* ---- 10. Current year in footer --------------------------------------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ---- boot ------------------------------------------------------------- */
  function boot() {
    attachImageFallbacks();
    initSmoothScroll();
    initHeader();
    initHeroSlider();
    initGallerySliders();
    initLightbox();
    initFilters();
    initContactPrefill();
    initContactForm();
    initBrochures();
    initAmenityIcons();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
