/* ==========================================================================
   animations.js  —  ALL motion lives here. DO NOT EDIT to change content.
   --------------------------------------------------------------------------
   How it works (for the developer):
     You never touch this file. To animate any element, just add a data
     attribute in the HTML:

       data-animate="fade-up"      slides + fades up on scroll
       data-animate="fade"         simple fade in
       data-animate="clip-reveal"  unmasks from bottom (great for images/headings)
       data-animate="zoom-in"      gentle scale + fade
       data-animate="stagger"      its DIRECT CHILDREN animate one after another
       data-animate="parallax"     element drifts as you scroll (background feel)

     Optional fine-tuning (all optional):
       data-delay="0.2"     wait before starting (seconds)
       data-stagger="0.12"  gap between staggered children (seconds)
       data-speed="0.2"     parallax strength (positive = slower than scroll)
       data-split           on a heading: reveals it word-by-word

   To animate a NEW block: copy a data-animate attribute from a similar block.
   That's it — no JavaScript needed.
   ========================================================================== */

(function () {
  const root = document.documentElement;
  root.classList.add("js");

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";

  // If GSAP is missing or user prefers reduced motion, reveal everything and stop.
  if (!hasGSAP || prefersReduced) {
    root.classList.add("reduced");
    return;
  }

  const { gsap } = window;
  gsap.registerPlugin(window.ScrollTrigger);
  const EASE = "power3.out";

  /* ---- helper: split a heading into animatable words --------------------- */
  // Each word's mask gets extra bottom padding (cancelled by a negative
  // margin) so descenders like g / p / y aren't cropped by overflow:hidden.
  function splitWords(el) {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.innerHTML = text
      .split(/(\s+)/)
      .map((chunk) =>
        /\s+/.test(chunk)
          ? chunk
          : `<span class="word" style="display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.2em;margin-bottom:-.2em"><span class="word-i" style="display:inline-block">${chunk}</span></span>`
      )
      .join("");
    return el.querySelectorAll(".word-i");
  }

  /* ---- 1. HERO / above-the-fold load reveal ------------------------------ */
  // Any element with [data-hero-load] animates immediately on page load.
  function heroLoad() {
    const items = gsap.utils.toArray("[data-hero-load]");
    if (!items.length) return;
    items.sort(
      (a, b) =>
        (+a.dataset.order || 0) - (+b.dataset.order || 0)
    );
    gsap.set(items, { opacity: 0, y: 34 });
    gsap.to(items, {
      opacity: 1,
      y: 0,
      duration: 1.1,
      ease: EASE,
      stagger: 0.12,
      delay: 0.25,
    });
  }

  /* ---- 2. Scroll-triggered reveals --------------------------------------- */
  function scrollReveals() {
    gsap.utils.toArray("[data-animate]").forEach((el) => {
      const type = el.dataset.animate;
      const delay = parseFloat(el.dataset.delay) || 0;
      const start = "top 85%";
      const base = {
        scrollTrigger: { trigger: el, start, once: true },
        duration: 1.1,
        ease: EASE,
        delay,
      };

      switch (type) {
        case "fade":
          gsap.to(el, { opacity: 1, ...base });
          break;

        case "fade-up":
          gsap.to(el, { opacity: 1, y: 0, ...base });
          break;

        case "zoom-in":
          gsap.to(el, { opacity: 1, scale: 1, duration: 1.4, ...base, ease: EASE });
          break;

        case "clip-reveal":
          // If it's a heading and asked to split, reveal word-by-word.
          if (el.hasAttribute("data-split")) {
            const words = splitWords(el);
            gsap.set(el, { clipPath: "none" });
            gsap.fromTo(
              words,
              { yPercent: 130 },
              {
                yPercent: 0,
                duration: 1,
                ease: EASE,
                stagger: 0.06,
                delay,
                scrollTrigger: { trigger: el, start, once: true },
              }
            );
          } else {
            gsap.to(el, {
              clipPath: "inset(0 0 0% 0)",
              duration: 1.3,
              ...base,
              ease: EASE,
            });
          }
          break;

        case "stagger": {
          const children = el.children;
          const gap = parseFloat(el.dataset.stagger) || 0.1;
          gsap.to(children, {
            opacity: 1,
            y: 0,
            duration: 1.05,
            ease: EASE,
            stagger: gap,
            delay,
            scrollTrigger: { trigger: el, start, once: true },
          });
          break;
        }

        case "parallax": {
          const speed = parseFloat(el.dataset.speed) || 0.18;
          gsap.fromTo(
            el,
            { yPercent: -speed * 50 },
            {
              yPercent: speed * 50,
              ease: "none",
              scrollTrigger: {
                trigger: el.parentElement || el,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            }
          );
          break;
        }
      }
    });
  }

  /* ---- 3. Standalone split headings (no scroll mask needed) -------------- */
  // [data-split] used WITHOUT data-animate just animates words on enter.
  function splitHeadings() {
    gsap.utils.toArray("[data-split]:not([data-animate])").forEach((el) => {
      const words = splitWords(el);
      gsap.fromTo(
        words,
        { yPercent: 130 },
        {
          yPercent: 0,
          duration: 1,
          ease: EASE,
          stagger: 0.05,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    });
  }

  /* ---- init -------------------------------------------------------------- */
  function init() {
    heroLoad();
    splitHeadings();
    scrollReveals();
    // Recalculate once everything (fonts/images) is settled.
    window.addEventListener("load", () => window.ScrollTrigger.refresh());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose a refresh hook for main.js (e.g. after Lenis is ready).
  window.__refreshScroll = () => window.ScrollTrigger && window.ScrollTrigger.refresh();
})();
