/* ==========================================================================
   main.js  —  Site behaviour: smooth scroll, header, sliders, tabs, filters,
               lightbox, amenity icons, brochure lead popup, enquiry forms.
   (Scroll reveal animations live in animations.js — keep them separate.)
   ========================================================================== */

(function () {
  "use strict";

  /* ---- 0. SITE SETTINGS — edit these ------------------------------------- */
  const SITE = {
    // Shown in WhatsApp messages. Phone / WhatsApp numbers in the HTML are
    // plain links (search the HTML for "919712131519" to change them).
    whatsapp: "919712131519",
    // LEAD ENDPOINT -------------------------------------------------------------
    // The PHP mailer in api/send-lead.php emails every lead (SMTP settings live in
    // api/config.php on the server). Both forms POST JSON:
    //   { form, name, email, phone, city, project, project_slug, message,
    //     visit_date, visit_time, consent, page, referrer, utm, website }
    //  • "api/send-lead.php"  (relative) → used when the site runs on a PHP host.
    //    On GitHub Pages (no PHP) it is skipped and site-visit forms hand the
    //    enquiry over on WhatsApp instead.
    //  • "https://…/send-lead.php" (absolute) → always used, e.g. the api/ folder
    //    uploaded to another domain (add this site to ALLOWED_ORIGINS there).
    //  • "" → no lead is sent anywhere.
    leadEndpoint: "api/send-lead.php",
  };

  // All projects (slug → name). Brochures live at assets/brochures/arvind-<slug>.pdf
  const PROJECTS = {
    "sensora": "Arvind Sensora",
    "aqua-city": "Arvind Aqua City",
    "everland": "Arvind Everland",
    "forreste": "Arvind Forreste",
    "uplands": "Arvind Uplands",
    "highgrove": "Arvind Highgrove",
    "alcove": "Arvind Alcove",
    "smartpark": "Arvind SmartPark",
  };

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Root of the site, worked out from this script's own URL ("…/js/main.js").
  const ROOT = (document.currentScript && document.currentScript.src || "").replace(/js\/main\.js(\?.*)?$/, "");
  const isHttp = /^https?:$/.test(location.protocol);
  const ICON = {
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6l6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6l-6 6"/></svg>',
  };

  const ENDPOINT = !SITE.leadEndpoint ? ""
    : /^https?:\/\//.test(SITE.leadEndpoint) ? SITE.leadEndpoint
    : (isHttp && !/\.github\.io$/.test(location.hostname)) ? ROOT + SITE.leadEndpoint : "";

  // Remember ad / campaign parameters from the landing URL for this visit.
  const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
  (function captureUtm() {
    try {
      const q = new URLSearchParams(location.search), found = {};
      UTM_KEYS.forEach((k) => { if (q.get(k)) found[k] = q.get(k).slice(0, 100); });
      if (Object.keys(found).length) sessionStorage.setItem("lead_utm", JSON.stringify(found));
      if (!sessionStorage.getItem("lead_ref") && document.referrer && !document.referrer.startsWith(location.origin)) {
        sessionStorage.setItem("lead_ref", document.referrer.slice(0, 300));
      }
    } catch (_) { /* storage blocked — fine */ }
  })();
  function trackingFields() {
    let utm = {}, referrer = "";
    try { utm = JSON.parse(sessionStorage.getItem("lead_utm") || "{}"); referrer = sessionStorage.getItem("lead_ref") || ""; } catch (_) {}
    return { utm, referrer, page: location.href };
  }

  // POSTs a lead. Resolves to { ok, status, message, errors } — never rejects.
  // status 0 = not sent (no endpoint / network error / timeout).
  function sendLead(data, timeoutMs = 12000) {
    if (!ENDPOINT) return Promise.resolve({ ok: false, status: 0 });
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(Object.assign({}, trackingFields(), data)),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok && j.success === true, status: r.status, message: j.message || "", errors: j.errors || [] })))
      .catch(() => ({ ok: false, status: 0 }))
      .finally(() => timer && clearTimeout(timer));
  }

  function whatsappText(lead) {
    return [
      `Hi, I'm interested in ${lead.project}.`, `Name: ${lead.name}`, `Phone: ${lead.phone}`,
      lead.email && `Email: ${lead.email}`, lead.city && `City: ${lead.city}`,
      lead.visit_date && `Preferred site visit: ${lead.visit_date}${lead.visit_time ? " " + lead.visit_time : ""}`,
      lead.message && `Message: ${lead.message}`,
    ].filter(Boolean).join("\n");
  }

  // Shows the server's validation message at the end of a form.
  function formNotice(form, text) {
    let n = form.querySelector(".form-notice");
    if (!n) { n = document.createElement("p"); n.className = "form-notice"; n.setAttribute("role", "alert"); form.appendChild(n); }
    n.textContent = text;
    n.hidden = !text;
  }

  function validate(form) {
    let ok = true;
    form.querySelectorAll("[required]").forEach((input) => {
      const field = input.closest(".field, .consent");
      if (!field || field.offsetParent === null && input.type !== "checkbox") return;
      let valid = input.value.trim() !== "";
      if (input.type === "email") valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
      if (input.type === "tel") valid = input.value.replace(/\D/g, "").length >= 10;
      if (input.type === "checkbox") valid = input.checked;
      field.classList.toggle("invalid", !valid);
      if (!valid) ok = false;
    });
    return ok;
  }
  function clearErrorsOnInput(form) {
    form.addEventListener("input", (e) => {
      const f = e.target.closest(".field, .consent");
      if (f) f.classList.remove("invalid");
    });
    form.addEventListener("change", (e) => {
      const f = e.target.closest(".field, .consent");
      if (f) f.classList.remove("invalid");
    });
  }

  /* ---- 1. Branded fallback for any image that hasn't been added yet ------ */
  function attachImageFallbacks() {
    document.querySelectorAll("img[data-fallback]").forEach((img) => {
      const swap = () => {
        if (img.dataset.failed) return;
        img.dataset.failed = "1";
        const ph = document.createElement("div");
        ph.className = "img-placeholder";
        ph.innerHTML = `<span>${img.getAttribute("alt") || "Arvind SmartSpaces"}</span>`;
        img.replaceWith(ph);
      };
      img.addEventListener("error", swap);
      if (img.complete && img.naturalWidth === 0) swap();
    });
  }

  /* ---- 2. Lenis smooth scroll ------------------------------------------- */
  let lenis = null;
  function initSmoothScroll() {
    if (prefersReduced || typeof window.Lenis === "undefined") return;
    lenis = new window.Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if (window.ScrollTrigger) lenis.on("scroll", window.ScrollTrigger.update);
  }
  function scrollToEl(el) {
    const offset = -((document.querySelector(".subnav") ? 130 : 80));
    if (lenis) lenis.scrollTo(el, { offset });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: prefersReduced ? "auto" : "smooth" });
  }
  function initAnchors() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute("href").length < 2) return;
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      document.body.classList.remove("nav-open");
      scrollToEl(target);
    });
  }

  /* ---- 3. Header: solid on scroll + mobile menu --------------------------- */
  function initHeader() {
    const header = document.querySelector(".site-header");
    if (header) {
      const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 40);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    const toggle = document.querySelector(".hamburger");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const open = document.body.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.querySelectorAll(".main-nav a").forEach((a) =>
        a.addEventListener("click", () => document.body.classList.remove("nav-open")));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });
      document.addEventListener("click", (e) => {
        if (document.body.classList.contains("nav-open") && !e.target.closest(".main-nav, .hamburger")) document.body.classList.remove("nav-open");
      });
    }
  }

  /* ---- 4. Home hero slider (Swiper) --------------------------------------- */
  function initHeroSlider() {
    const el = document.querySelector(".hero .swiper");
    if (!el || typeof window.Swiper === "undefined") return;
    const pager = document.querySelector(".hero-pager");
    const slides = el.querySelectorAll(".swiper-slide");
    if (pager) {
      pager.innerHTML = Array.from(slides, (_, i) => `<button type="button" aria-label="Slide ${i + 1}"></button>`).join("");
    }
    const swiper = new window.Swiper(el, {
      loop: true, speed: 1100, effect: "fade", fadeEffect: { crossFade: true },
      autoplay: prefersReduced ? false : { delay: 6000, disableOnInteraction: false },
      on: {
        slideChange() {
          if (pager) pager.querySelectorAll("button").forEach((b, i) => b.classList.toggle("active", i === this.realIndex));
          const active = this.slides[this.activeIndex];
          if (active && window.gsap && !prefersReduced) {
            window.gsap.fromTo(active.querySelectorAll("[data-slide-anim]"), { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.1 });
          }
        },
      },
    });
    if (pager) pager.querySelectorAll("button").forEach((b, i) => b.addEventListener("click", () => swiper.slideToLoop(i)));
    const prev = document.querySelector(".hero-arrows .prev"), next = document.querySelector(".hero-arrows .next");
    if (prev) prev.addEventListener("click", () => swiper.slidePrev());
    if (next) next.addEventListener("click", () => swiper.slideNext());
    swiper.emit("slideChange");
  }

  /* ---- 5. Feature image sliders (any .feature__media with 2+ images) ------ */
  function initFeatureSliders() {
    document.querySelectorAll(".feature__media").forEach((media) => {
      const imgs = Array.from(media.querySelectorAll("img.fslide"));
      if (imgs.length < 2) { if (imgs[0]) imgs[0].classList.add("active"); return; }
      let i = 0, timer = null;
      const dots = document.createElement("div");
      dots.className = "f-dots";
      dots.innerHTML = imgs.map((_, n) => `<button type="button" aria-label="Image ${n + 1}"></button>`).join("");
      media.insertAdjacentHTML("beforeend",
        `<button type="button" class="f-arrow f-prev" aria-label="Previous image">${ICON.left}</button>` +
        `<button type="button" class="f-arrow f-next" aria-label="Next image">${ICON.right}</button>`);
      media.appendChild(dots);
      const show = (n) => {
        i = (n + imgs.length) % imgs.length;
        imgs.forEach((im, k) => im.classList.toggle("active", k === i));
        dots.querySelectorAll("button").forEach((d, k) => d.classList.toggle("active", k === i));
      };
      const play = () => { if (!prefersReduced) { clearInterval(timer); timer = setInterval(() => show(i + 1), 5000); } };
      media.querySelector(".f-prev").addEventListener("click", () => { show(i - 1); play(); });
      media.querySelector(".f-next").addEventListener("click", () => { show(i + 1); play(); });
      dots.querySelectorAll("button").forEach((d, k) => d.addEventListener("click", () => { show(k); play(); }));
      show(0); play();
    });
  }

  /* ---- 6. Gallery sliders ------------------------------------------------- */
  function initGallerySliders() {
    if (typeof window.Swiper === "undefined") return;
    document.querySelectorAll(".gallery-swiper").forEach((el) => {
      const scope = el.closest("section") || document;
      new window.Swiper(el, {
        slidesPerView: 1.12, spaceBetween: 14, speed: 700, grabCursor: true,
        breakpoints: { 640: { slidesPerView: 1.8, spaceBetween: 18 }, 1024: { slidesPerView: 2.5, spaceBetween: 22 } },
        navigation: { prevEl: scope.querySelector(".slider-nav .prev"), nextEl: scope.querySelector(".slider-nav .next") },
      });
    });
  }

  /* ---- 7. Lightbox — each [data-lightbox] element is its own group -------- */
  function initLightbox() {
    const groups = Array.from(document.querySelectorAll("[data-lightbox]"));
    if (!groups.length) return;
    const box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("data-lenis-prevent", "");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = `<button class="lb-close" aria-label="Close">&times;</button>
      <button class="lb-prev" aria-label="Previous">&#8249;</button>
      <button class="lb-next" aria-label="Next">&#8250;</button><img alt=""><span class="lb-count"></span>`;
    document.body.appendChild(box);
    const imgEl = box.querySelector("img"), count = box.querySelector(".lb-count");
    let list = [], index = 0;
    const srcOf = (t) => t.dataset.full || t.currentSrc || t.src;
    function show(i) {
      index = (i + list.length) % list.length;
      imgEl.src = srcOf(list[index]);
      imgEl.alt = list[index].alt || "";
      count.textContent = list.length > 1 ? `${index + 1} / ${list.length}` : "";
      box.querySelector(".lb-prev").style.display = box.querySelector(".lb-next").style.display = list.length > 1 ? "" : "none";
    }
    function open(group, i) {
      list = Array.from(group.querySelectorAll("img")).filter((im) => !im.dataset.failed);
      show(Math.max(0, list.indexOf(i)));
      box.classList.add("open");
      requestAnimationFrame(() => box.classList.add("visible"));
      document.body.style.overflow = "hidden";
      if (lenis) lenis.stop();
    }
    function close() {
      box.classList.remove("visible");
      document.body.style.overflow = "";
      if (lenis) lenis.start();
      setTimeout(() => box.classList.remove("open"), 350);
    }
    groups.forEach((g) => g.addEventListener("click", (e) => {
      const img = e.target.closest("img");
      if (img && g.contains(img)) open(g, img);
    }));
    box.querySelector(".lb-close").addEventListener("click", close);
    box.querySelector(".lb-next").addEventListener("click", () => show(index + 1));
    box.querySelector(".lb-prev").addEventListener("click", () => show(index - 1));
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    document.addEventListener("keydown", (e) => {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "ArrowLeft") show(index - 1);
    });
  }

  /* ---- 8. Tabs (configurations / floor plans) ----------------------------- */
  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach((wrap) => {
      const btns = wrap.querySelectorAll(".tab-btn"), panels = wrap.querySelectorAll(".tab-panel");
      btns.forEach((b) => b.addEventListener("click", () => {
        btns.forEach((x) => { x.classList.toggle("active", x === b); x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === b.dataset.tab));
      }));
    });
  }

  /* ---- 9. Filters: buttons [data-filter] inside [data-filter-group] show
          items whose data-cat (space-separated) contains that value -------- */
  function initFilters() {
    document.querySelectorAll("[data-filter-group]").forEach((group) => {
      const target = document.querySelector(group.dataset.filterGroup);
      if (!target) return;
      const btns = group.querySelectorAll(".filter-btn");
      btns.forEach((b) => b.addEventListener("click", () => {
        btns.forEach((x) => x.classList.toggle("active", x === b));
        const f = b.dataset.filter;
        target.querySelectorAll("[data-cat]").forEach((item) => {
          const show = f === "all" || item.dataset.cat.split(" ").includes(f);
          item.classList.toggle("is-hidden", !show);
          if (show) { item.style.opacity = ""; item.style.transform = ""; }
        });
        if (window.__refreshScroll) window.__refreshScroll();
      }));
    });
  }

  /* ---- 10. Sticky project sub-nav: highlight the section in view ---------- */
  function initSubnav() {
    const links = Array.from(document.querySelectorAll(".subnav-links a[href^='#']"));
    if (!links.length || !("IntersectionObserver" in window)) return;
    const map = new Map();
    links.forEach((a) => { const s = document.querySelector(a.getAttribute("href")); if (s) map.set(s, a); });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.classList.remove("active"));
        const a = map.get(en.target);
        if (a) { a.classList.add("active"); a.scrollIntoView({ block: "nearest", inline: "center" }); }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    map.forEach((_, s) => io.observe(s));
  }

  /* ---- 11. Icons for amenities + feature bullet lists (matched by keyword) */
  // The developer keeps writing plain <li>Text</li> — a matching line icon is
  // added automatically (falls back to sparkles).
  // Icons: Tabler Icons (MIT, tabler.io/icons) + a few custom ones in the same style.
  function initIcons() {
    const targets = document.querySelectorAll(".amenity-grid li, .feature__list li");
    if (!targets.length) return;
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
      "car": '<path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5"/>',
      "sparkles": '<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z"/>',
      "temple": '<path d="M3 21h18"/><path d="M5 21v-7h14v7"/><path d="M10 21v-3a2 2 0 0 1 4 0v3"/><path d="M7 14c0 -3.5 2.2 -6.5 5 -8c2.8 1.5 5 4.5 5 8"/><path d="M12 6v-3l3 1l-3 1"/>',
      "billiards": '<circle cx="15" cy="15" r="6"/><circle cx="15" cy="15" r="2"/><path d="M3 3l6.5 6.5"/>',
      "shuttlecock": '<path d="M9.5 17.5h5v1a2.5 2.5 0 0 1 -5 0z"/><path d="M9.5 17.5l-3.5 -13.5h12l-3.5 13.5"/><path d="M12 17.5v-13.5"/><path d="M7 8h10"/>',
      "racket": '<ellipse cx="9.5" cy="9.5" rx="5" ry="6.5" transform="rotate(45 9.5 9.5)"/><path d="M13.5 13.5l6.5 6.5"/><path d="M6.5 7.5l5 5M9 5.5l4.5 4.5"/>',
    };

    // Ordered keyword → icon (first match wins; specific terms come first,
    // e.g. "Pool-side Café" is a café and "Amphitheatre" isn't a cinema).
    const MAP = [
      [["kashi ghat", "temple", "derasar"], "temple"],
      [["multi purpose hall", "multipurpose hall", "multi-purpose hall", "multiactivity", "multi-activity"], "building-community"],
      [["card room"], "dice-5"],
      [["reception", "concierge"], "bell-ringing"],
      [["laundry"], "spray"],
      [["taxi", "club car", "travel booking", "parking"], "car"],
      [["gazebo"], "armchair-2"],
      [["wi-fi", "wifi"], "plug-connected"],
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
      [["campfire", "bonfire", "adventure camp"], "campfire"],
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

    targets.forEach((li) => {
      if (li.querySelector(".am-ic, .ic")) return;
      const inList = li.closest(".feature__list");
      const span = document.createElement("span");
      span.className = inList ? "ic" : "am-ic";
      span.innerHTML = svg(pick(li.dataset.icon || li.textContent || ""));
      li.insertBefore(span, li.firstChild);
    });
  }

  /* ---- 12. Brochure download — lead-capture popup ------------------------- */
  // Every [data-brochure] button opens a popup asking for name / phone / email
  // + consent. On submit: (1) the lead goes to SITE.leadEndpoint (if set),
  // (2) THAT project's PDF downloads, (3) the visitor lands on thank-you/.
  // A button with data-project="<slug>" is tied to that project; one without
  // (header / floating button) lets the visitor pick the project in the popup.
  function initBrochures() {
    const triggers = Array.from(document.querySelectorAll("[data-brochure]"));
    if (!triggers.length) return;
    const pdf = (slug) => ROOT + "assets/brochures/arvind-" + slug + ".pdf";

    const modal = document.createElement("div");
    modal.className = "lead-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("data-lenis-prevent", ""); // let the popup scroll natively
    const options = Object.entries(PROJECTS).map(([s, n]) => `<option value="${s}">${n}</option>`).join("");
    modal.innerHTML = `
      <div class="lead-backdrop" data-lead-close></div>
      <div class="lead-dialog" role="dialog" aria-modal="true" aria-labelledby="lead-title">
        <button class="lead-x" type="button" aria-label="Close" data-lead-close>&times;</button>
        <div class="lead-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M12 11v6"/><path d="M9.5 14.5l2.5 2.5l2.5 -2.5"/></svg></div>
        <span class="lead-eyebrow">Download Brochure</span>
        <h3 class="lead-title" id="lead-title">Brochure</h3>
        <p class="lead-sub">Share your details and the brochure will download instantly.</p>
        <form class="lead-form" novalidate>
          <div class="field lead-pick">
            <label for="lead-project">Project *</label>
            <select id="lead-project" name="project" required><option value="">Select a project</option>${options}</select>
            <span class="err">Please choose a project.</span>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="lead-name">Full name *</label>
              <input id="lead-name" name="name" type="text" autocomplete="name" placeholder="Your name" required />
              <span class="err">Please enter your name.</span>
            </div>
            <div class="field">
              <label for="lead-phone">Mobile number *</label>
              <input id="lead-phone" name="phone" type="tel" autocomplete="tel" placeholder="10-digit mobile" required />
              <span class="err">Enter a valid mobile number.</span>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="lead-email">Email *</label>
              <input id="lead-email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required />
              <span class="err">Enter a valid email.</span>
            </div>
            <div class="field">
              <label for="lead-city">City *</label>
              <input id="lead-city" name="city" type="text" autocomplete="address-level2" placeholder="e.g. Ahmedabad" required />
              <span class="err">Please enter your city.</span>
            </div>
          </div>
          <label class="consent">
            <input type="checkbox" name="consent" required />
            <span>I authorise Arvind SmartSpaces &amp; its authorised channel partner to contact me via call, SMS, email or WhatsApp.</span>
            <span class="err">Please tick to continue.</span>
          </label>
          <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
          <button type="submit" class="btn btn-primary lead-submit">Download Brochure</button>
          <p class="lead-fineprint">Your details are used only to share this brochure and follow up on your enquiry.</p>
        </form>
      </div>`;
    document.body.appendChild(modal);

    const form = modal.querySelector(".lead-form");
    const title = modal.querySelector(".lead-title");
    const select = modal.querySelector("#lead-project");
    const submit = modal.querySelector(".lead-submit");
    let slug = "";

    // Over http(s): drop projects whose PDF isn't uploaded yet (no broken
    // buttons). Over file:// browsers can't check, so everything shows.
    if (isHttp) {
      Object.keys(PROJECTS).forEach((s) => {
        fetch(pdf(s), { method: "HEAD" }).then((r) => {
          if (r.ok) return;
          const opt = select.querySelector(`option[value="${s}"]`);
          if (opt) opt.remove();
          triggers.filter((t) => t.dataset.project === s).forEach((t) => (t.style.display = "none"));
        }).catch(() => {});
      });
    }

    function open(project) {
      slug = project || "";
      const pick = !slug;
      modal.classList.toggle("pick", pick);
      select.required = pick;
      select.value = "";
      title.textContent = pick ? "Project Brochures" : PROJECTS[slug] || "Brochure";
      modal.classList.add("open");
      requestAnimationFrame(() => modal.classList.add("visible"));
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      if (lenis) lenis.stop();
      setTimeout(() => (pick ? select : form.querySelector("#lead-name")).focus(), 80);
    }
    function close() {
      modal.classList.remove("visible");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (lenis) lenis.start();
      setTimeout(() => modal.classList.remove("open"), 400);
    }
    triggers.forEach((t) => t.addEventListener("click", (e) => { e.preventDefault(); open(t.dataset.project); }));
    modal.querySelectorAll("[data-lead-close]").forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
    clearErrorsOnInput(form);

    // Start the download straight away (same-origin `download` attribute) so
    // big PDFs don't load into memory first. Over file:// the attribute is
    // ignored, so the PDF opens in a new tab instead.
    function startDownload(url, filename) {
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      if (!isHttp) { a.target = "_blank"; a.rel = "noopener"; }
      document.body.appendChild(a); a.click(); a.remove();
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate(form)) return;
      const s = slug || select.value;
      if (!s) return;
      formNotice(form, "");
      submit.setAttribute("disabled", "");
      submit.textContent = "Please wait…";
      sendLead({
        form: "brochure", name: form.name.value.trim(), email: form.email.value.trim(),
        phone: form.phone.value.trim(), city: form.city.value.trim(), project: PROJECTS[s], project_slug: s,
        consent: form.consent.checked, website: form.website.value,
      }, 6000).then((res) => {
        if (res.status === 422 || res.status === 429) {      // fixable problem → let the visitor correct it
          formNotice(form, res.message || "Please check your details and try again.");
          submit.removeAttribute("disabled");
          submit.textContent = "Download Brochure";
          return;
        }
        // sent, or the mailer is unreachable — never block the brochure
        submit.textContent = "Starting your download…";
        startDownload(pdf(s), "arvind-" + s + ".pdf");
        setTimeout(() => { window.location.href = ROOT + "thank-you/?project=" + encodeURIComponent(s); }, 1200);
      });
    });
  }

  /* ---- 13. Enquiry / site-visit forms (form[data-enquiry]) ---------------- */
  function initEnquiryForms() {
    const param = new URLSearchParams(location.search).get("project");
    document.querySelectorAll("form[data-enquiry]").forEach((form) => {
      const select = form.querySelector('select[name="project"]');
      if (select && param && select.querySelector(`option[value="${param}"]`)) select.value = param;
      const toggle = form.querySelector("[data-schedule-toggle]");
      const sched = form.querySelector(".schedule-fields");
      if (toggle && sched) toggle.addEventListener("change", () => sched.classList.toggle("open", toggle.checked));
      const date = form.querySelector('input[name="visit_date"]');
      if (date) date.min = new Date().toISOString().slice(0, 10);
      clearErrorsOnInput(form);

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!validate(form)) return;
        const v = (n) => ((form.querySelector(`[name="${n}"]`) || {}).value || "").trim();
        const slug = v("project") || form.dataset.project || "";
        const projectName = PROJECTS[slug] || slug || "Arvind SmartSpaces projects";
        const visit = toggle && toggle.checked;
        const lead = {
          form: "enquiry", name: v("name"), email: v("email"), phone: v("phone"), city: v("city"), project: projectName,
          project_slug: PROJECTS[slug] ? slug : "", message: v("message"),
          visit_date: visit ? v("visit_date") : "", visit_time: visit ? v("visit_time") : "",
          consent: true, website: v("website"),
        };
        const thanks = ROOT + "thank-you/?type=visit" + (slug ? "&project=" + encodeURIComponent(slug) : "");
        const btn = form.querySelector('button[type="submit"]');
        const btnHtml = btn ? btn.innerHTML : "";
        formNotice(form, "");

        if (!ENDPOINT) {
          // No mailer here (e.g. GitHub Pages) → hand the enquiry over on WhatsApp, pre-filled.
          window.open(`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(whatsappText(lead))}`, "_blank", "noopener");
          window.location.href = thanks;
          return;
        }
        if (btn) { btn.setAttribute("disabled", ""); btn.textContent = "Sending…"; }
        sendLead(lead).then((res) => {
          if (res.ok) { window.location.href = thanks; return; }
          if (res.status === 422 || res.status === 429) {
            formNotice(form, res.message || "Please check your details and try again.");
            if (btn) { btn.removeAttribute("disabled"); btn.innerHTML = btnHtml; }
            return;
          }
          // Mailer unreachable → keep the lead and offer WhatsApp on the thank-you page.
          try { sessionStorage.setItem("lead_whatsapp", whatsappText(lead)); } catch (_) {}
          window.location.href = thanks + "&wa=1";
        });
      });
    });
  }

  /* ---- 14. Current year in footer ----------------------------------------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  /* ---- boot --------------------------------------------------------------- */
  function boot() {
    attachImageFallbacks();
    initSmoothScroll();
    initAnchors();
    initHeader();
    initHeroSlider();
    initFeatureSliders();
    initGallerySliders();
    initLightbox();
    initTabs();
    initFilters();
    initSubnav();
    initIcons();
    initBrochures();
    initEnquiryForms();
    initYear();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
