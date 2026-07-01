/* =========================================================================
   Via Bunicului — vanilla JS (shared by index.html + catalogue.html).
   Every init() guards on the elements it needs, so this file is safe on
   both pages. No framework, no build step.
   ========================================================================= */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // true while initFencePull owns the Section 2 fence transform (so initParallax skips it)
  var fencePullActive = false;

  /* Shared scroll-dot state. initScrollDots wires the IntersectionObserver (the
     baseline for S1 + S2-before-pin + the reduced-motion/mobile fallback). During
     the desktop fence-pull, initFencePull drives dot 2↔3 from --s2s3 instead, so
     dot 3 lights when the cellar reveal dominates rather than waiting for the real
     #scene-cellar to cross the IO threshold after release. pinDotsEngaged gates
     ownership so the two never fight. */
  var dotsNavEl = null;
  var dotEls = null;
  var pinDotsEngaged = false; // true while the S2→S3 pin owns dot 2↔3
  var lastDotKey = "";        // memo so per-frame calls don't thrash the DOM
  function setActiveDot(idx, onDark) {
    if (!dotsNavEl || !dotEls) return;
    var key = idx + "|" + (onDark ? 1 : 0);
    if (key === lastDotKey) return;
    lastDotKey = key;
    var want = String(idx);
    dotEls.forEach(function (dot) {
      dot.classList.toggle("is-active", dot.getAttribute("data-dot") === want);
    });
    dotsNavEl.classList.toggle("on-dark", !!onDark);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMenu();
    initHeaderScroll();
    initScrollArrows();
    initScrollDots();
    initParallax();
    initScrollJourney();
    initFencePull();
    initCatalogue();
  });

  /* ----------------------------- scroll lock ----------------------------- */
  var lockCount = 0;
  function lockScroll() {
    lockCount++;
    document.body.style.overflow = "hidden";
  }
  function unlockScroll() {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.style.overflow = "";
  }

  /* ------------------------------- menu ---------------------------------- */
  function initMenu() {
    var toggle = document.getElementById("menuToggle");
    var overlay = document.getElementById("menuOverlay");
    if (!toggle || !overlay) return;

    var lastFocus = null;
    var isOpen = false;

    function open() {
      if (isOpen) return;
      isOpen = true;
      lastFocus = document.activeElement;
      overlay.hidden = false;
      requestAnimationFrame(function () {
        overlay.classList.add("is-open");
      });
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      lockScroll();
      var first = overlay.querySelector("a");
      if (first) first.focus();
      document.addEventListener("keydown", onKey);
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      overlay.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      unlockScroll();
      document.removeEventListener("keydown", onKey);
      window.setTimeout(function () {
        overlay.hidden = true;
      }, 300);
      if (lastFocus) lastFocus.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "Tab") trapFocus(e, overlay);
    }

    toggle.addEventListener("click", function () {
      if (isOpen) close();
      else open();
    });
    // close after following an in-page or page link
    overlay.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", close);
    });
  }

  function trapFocus(e, container) {
    var f = container.querySelectorAll(
      'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* -------------------------- header on scroll --------------------------- */
  function initHeaderScroll() {
    var header = document.getElementById("siteHeader");
    if (!header || document.body.dataset.page !== "home") return;
    function update() {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ----------------------- scroll arrows / buttons ----------------------- */
  function initScrollArrows() {
    document.querySelectorAll("[data-scroll-target]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = document.querySelector(btn.getAttribute("data-scroll-target"));
        if (target)
          target.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
          });
      });
    });
  }

  /* --------------------------- scroll dots ------------------------------- */
  function initScrollDots() {
    dotsNavEl = document.getElementById("scrollDots");
    var sections = document.querySelectorAll(".scene");
    if (!dotsNavEl || !sections.length) return;
    dotEls = dotsNavEl.querySelectorAll(".dot");

    var io = new IntersectionObserver(
      function (entries) {
        // While the desktop fence-pull owns dot 2↔3 (rawT>0), ignore the IO so the
        // two controllers never fight. The pin covers the pinned S2 and all of S3;
        // the IO still owns S1 and the S2 body above the pin, plus the whole
        // mobile/reduced-motion fallback (where pinDotsEngaged stays false).
        if (pinDotsEngaged) return;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var idx = entry.target.getAttribute("data-scene");
          // recolour dots over the dark cellar scene
          setActiveDot(idx, entry.target.classList.contains("scene--cellar"));
        });
      },
      { threshold: 0.55 }
    );
    sections.forEach(function (s) {
      io.observe(s);
    });
  }

  /* ---------------------------- parallax fence --------------------------- */
  function initParallax() {
    var layers = document.querySelectorAll("[data-parallax]");
    if (!layers.length) return;

    // build fence posts procedurally so spacing is easy to retune
    var fencePosts = document.querySelector(".scene__fence .fence-posts");
    if (fencePosts && !fencePosts.childNodes.length) {
      var NS = "http://www.w3.org/2000/svg";
      for (var x = 20; x <= 1420; x += 80) {
        var r = document.createElementNS(NS, "rect");
        r.setAttribute("x", x);
        r.setAttribute("y", 28);
        r.setAttribute("width", 14);
        r.setAttribute("height", 176);
        fencePosts.appendChild(r);
      }
    }

    if (prefersReducedMotion) return;

    var ticking = false;
    function update() {
      var vh = window.innerHeight;
      layers.forEach(function (layer) {
        // while the desktop fence-pull is active it owns the pinned fence's
        // transform — skip it here so the two controllers never fight.
        if (fencePullActive && layer.closest(".s2-stage")) return;
        var section = layer.closest(".scene");
        if (!section) return;
        var rect = section.getBoundingClientRect();
        var speed = parseFloat(layer.getAttribute("data-parallax")) || 0.2;
        // distance of section centre from viewport centre → vertical offset
        var fromCenter = vh / 2 - (rect.top + rect.height / 2);
        var shift = fromCenter * speed;
        // Clamp travel so the fence never lifts past its CSS bottom cushion (-8vh) and exposes a gap
        var max = vh * 0.07;
        if (shift > max) shift = max;
        else if (shift < -max) shift = -max;
        layer.style.transform = "translate3d(0," + shift + "px,0)";
      });
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  /* ----------------------- cinematic scroll journey ---------------------- */
  /* Sets scroll-progress CSS vars so the section seams blend (see styles.css).
     Runs regardless of reduced-motion — CSS decides what to do with the vars. */
  function initScrollJourney() {
    var s2 = document.getElementById("scene-house");
    var s3 = document.getElementById("scene-cellar");
    if (!s2 && !s3) return; // homepage only
    var root = document.documentElement;
    function clamp01(n) {
      return n < 0 ? 0 : n > 1 ? 1 : n;
    }
    var ticking = false;
    function update() {
      var vh = window.innerHeight || 1;
      if (s2) {
        var p1 = clamp01((vh - s2.getBoundingClientRect().top) / (vh * 0.8));
        root.style.setProperty("--village-to-house", p1.toFixed(3));
        root.style.setProperty("--haze", (1 - Math.abs(2 * p1 - 1)).toFixed(3));
      }
      if (s3) {
        var p2 = clamp01((vh - s3.getBoundingClientRect().top) / (vh * 0.8));
        root.style.setProperty("--house-to-cellar", p2.toFixed(3));
        root.style.setProperty("--doorway", (1 - Math.abs(2 * p2 - 1)).toFixed(3));
      }
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  /* ----------------------- fence-pull pin (S2→S3) ------------------------ */
  /* Desktop + motion-OK only. Computes pin progress --s2s3 (0..1) across the
     sticky .s2-pin track and lifts the Section 2 fence as you scroll through the
     pinned hold. While active it is the SINGLE owner of the fence transform
     (initParallax skips the fence via fencePullActive), blending the existing
     parallax into the lift so there is no handoff jump and no drift fight.
     Mobile / reduced-motion: no-op → initParallax keeps the normal fence.
     Native scroll only — no scroll-jacking. */
  function initFencePull() {
    var pin = document.querySelector(".s2-pin");
    var stage = document.querySelector(".s2-stage");
    var fence = document.querySelector(".scene--house .scene__fence");
    var cellar = document.getElementById("scene-cellar"); // real S3 — for the handoff swap
    if (!pin || !stage || !fence) return; // homepage only
    var root = document.documentElement;
    var mq = window.matchMedia(
      "(min-width: 761px) and (prefers-reduced-motion: no-preference)"
    );

    var LIFT_VH = 1.0; // fence lift distance: a full viewport so the ground-line sweeps to the top (the cellar reveal edge tracks it) and the fence body clears the viewport by t=1
    var DOT_SWITCH = 0.6; // --s2s3 at which dot 2→3 (+on-dark) flips: cellar now dominant
    function ease(t) {
      return t * t * (3 - 2 * t); // smoothstep
    }

    var ticking = false;
    function update() {
      ticking = false;
      fencePullActive = mq.matches;
      if (!fencePullActive) {
        // mobile / reduced-motion: no pin lift; initParallax owns the fence and the
        // IntersectionObserver owns the dots (normal fallback behaviour)
        root.style.setProperty("--s2s3", "0");
        root.style.setProperty("--s2s3e", "0"); // reveal mask stays fully closed
        pinDotsEngaged = false;
        pin.classList.remove("is-released"); // no handoff swap in the fallback
        return;
      }
      var vh = window.innerHeight || 1;
      // pin progress: how far the sticky stage has travelled through its track.
      // rawT keeps the sign so we can tell "before the pin" (<0) from "in/past it".
      var track = pin.offsetHeight - vh; // = --pin-extra in px
      var rawT = track > 0 ? -pin.getBoundingClientRect().top / track : 0;
      var t = rawT < 0 ? 0 : rawT > 1 ? 1 : rawT; // clamped progress used for visuals
      root.style.setProperty("--s2s3", t.toFixed(4));

      // Scroll-dot sync: once the pin starts (rawT>0) the reveal progress owns dot
      // 2↔3 — dot 2 while the house is dominant, dot 3 (+on-dark) once the cellar
      // reveal dominates at t≈DOT_SWITCH. This holds through release into the real
      // #scene-cellar (rawT stays >0, t=1), so there is no flicker back to dot 2.
      // Above the pin start (rawT≤0) we hand back to the IntersectionObserver.
      if (rawT > 0) {
        pinDotsEngaged = true;
        if (t >= DOT_SWITCH) setActiveDot(3, true);
        else setActiveDot(2, false);
      } else {
        pinDotsEngaged = false;
      }

      // Handoff swap: once the real #scene-cellar has risen to the viewport top it is
      // superimposed on the released stage (same image, same box), so hide the stage —
      // the swap is invisible and the real cellar (with its heading/CTA) takes over.
      // ~2vh tolerance so it fires just before the absolute scroll bottom.
      if (cellar) {
        pin.classList.toggle(
          "is-released",
          cellar.getBoundingClientRect().top <= 1
        );
      }
      // existing clamped parallax for the fence (matches initParallax)
      var rect = fence.closest(".scene").getBoundingClientRect();
      var speed = parseFloat(fence.getAttribute("data-parallax")) || 0.22;
      var fromCenter = vh / 2 - (rect.top + rect.height / 2);
      var parallax = fromCenter * speed;
      var max = vh * 0.07;
      if (parallax > max) parallax = max;
      else if (parallax < -max) parallax = -max;
      // blend parallax -> pure lift as the hold progresses (single owner, no jump)
      var e = ease(t);
      // publish the EASED progress so the cellar reveal mask (styles.css) wipes up on
      // the same curve as the fence lift, keeping the reveal edge glued to the ground-line
      root.style.setProperty("--s2s3e", e.toFixed(4));
      var y = parallax * (1 - e) + -(vh * LIFT_VH) * e;
      fence.style.transform = "translate3d(0," + y + "px,0)";
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    mq.addEventListener("change", onScroll);
  }

  /* =======================================================================
     CATALOGUE (rebuilt shop — sectioned collections + Quick View)
     ===================================================================== */
  // PLACEHOLDER wine data. Easy to edit later — replace fields, add rows, swap
  // image paths. Bottle <img> uses `image`; a colored SVG silhouette renders if
  // the image fails to load or `image` is missing.
  var WINES = [
    // ---- Vinuri Rosii ----
    {
      id: "ciuleandra", name: "Ciuleandra", type: "rosu", typeLabel: "Vin Rosu",
      varietal: "Merlot",
      collection: "vinuri-rosii", image: "assets/wines/ciuleandra.png",
      vintage: 2019, price: 12,
      tasting: "Cherries kept under oak — pepper, dried herbs, a long stoney finish.",
      notes: "Hand-harvested from the upper hillside rows. Fermented in open vats and rested 18 months in old oak. A red built for slow Sunday tables.",
      badge: "new"
    },
    {
      id: "pe-cal-alb", name: "Pe Cal Alb", type: "rosu", typeLabel: "Vin Rosu",
      varietal: "Merlot",
      collection: "vinuri-rosii", image: "assets/wines/pe-cal-alb.png",
      vintage: 2018, price: 15,
      tasting: "Bold plum and warm spice — a country-table red with a velvet finish.",
      notes: "Old-vine selection from stony soil. Long maceration, gentle oak, bottled unfiltered. Best decanted an hour before pouring."
    },
    {
      id: "viata-lunga", name: "Viata Lunga", type: "rosu", typeLabel: "Vin Rosu",
      varietal: "Cabernet Sauvignon",
      collection: "vinuri-rosii", image: "assets/wines/viata-lunga.png",
      vintage: 2019, price: 13,
      tasting: "Cellar-aged depth — dark berry, leather, slow earth.",
      notes: "Aged four years in the stone cellar before release. A keeper — drinking well now and through the decade.",
      badge: "limited"
    },
    // ---- Vinuri Albe ----
    {
      id: "regina-vinului", name: "Regina Vinului", type: "alb", typeLabel: "Vin Alb",
      varietal: "Muscat Ottonel",
      collection: "vinuri-albe", image: "assets/wines/regina-vinului.png",
      vintage: 2019, price: 18,
      tasting: "Orchard fruit, crisp stone, a late-sun glow on the finish.",
      notes: "Cool-fermented in stainless, six months on fine lees. Pours pale gold; drinks bright and long. The queen of the cellar's white range."
    },
    // ---- Vinuri Rose ----
    {
      id: "amintiri", name: "Amintiri", type: "rose", typeLabel: "Vin Rose",
      varietal: "Cabernet Sauvignon",
      collection: "vinuri-rose", image: "assets/wines/amintiri.png",
      vintage: 2019, price: 16,
      tasting: "Soft blush, garden roses, dry warm finish. A memory in a glass.",
      notes: "Picked early at first light, pressed gently, fermented cool. Light pink, dry, low alcohol — a porch wine with a long memory."
    }
  ];

  var COLLECTIONS = [
    { key: "vinuri-rosii", label: "Vinuri Rosii", layout: "grid" },
    { key: "vinuri-albe", label: "Vinuri Albe", layout: "feature" },
    { key: "vinuri-rose", label: "Vinuri Rose", layout: "feature" }
  ];

  // Color tokens for the SVG bottle fallback per wine type
  var TYPE_FALLBACK_COLOR = { rosu: "#7a2434", alb: "#d8c075", rose: "#d68893" };

  function bottleSVG(type) {
    var color = TYPE_FALLBACK_COLOR[type] || TYPE_FALLBACK_COLOR.rosu;
    return (
      '<svg class="bottle-fallback" viewBox="0 0 60 200" aria-hidden="true">' +
      '<rect x="26" y="6" width="8" height="30" rx="2" fill="' + color + '"/>' +
      '<path d="M22 36 q8 6 8 24 v118 a8 8 0 0 1-8 8 h16 a8 8 0 0 1-8-8 V60 q0-18 8-24 Z" fill="' + color + '"/>' +
      '<path d="M22 36 q8 6 8 24 v118 a8 8 0 0 1-8 8 V60 q0-18 0-24 Z" fill="#000" opacity="0.14"/>' +
      '<rect x="20" y="120" width="20" height="40" rx="2" fill="#fbf4e7" opacity="0.92"/>' +
      "</svg>"
    );
  }

  function initCatalogue() {
    // Cheap detection: only run on the catalogue page
    if (document.body.getAttribute("data-page") !== "catalogue") return;
    var anyGrid = document.querySelector("[id^='grid-vinuri-']");
    if (!anyGrid) return;

    var cartCountEl = document.getElementById("cartCount");
    var cart = 0;

    /* ---- helpers ---- */
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
    function badgeHTML(badge) {
      if (!badge) return "";
      var label = badge === "sold-out" ? "Sold out" : badge === "limited" ? "Limited" : "New";
      return '<span class="wine-badge wine-badge--' + esc(badge) + '">' + label + "</span>";
    }
    // The card's bottle area: <img> if asset present, falls back to silhouette on error
    function bottleHTML(p) {
      var fallback = bottleSVG(p.type);
      if (!p.image) return fallback;
      return (
        '<img class="wine-bottle" src="' + esc(p.image) + '" alt="" loading="lazy" decoding="async" ' +
        'onerror="this.outerHTML=' + JSON.stringify(fallback).replace(/"/g, "&quot;") + '" />'
      );
    }
    function itemHTML(p, variant) {
      var sold = p.badge === "sold-out";
      var addLabel = sold ? "Sold out" : "Add to cart";
      var cls = "shop-item" + (variant ? " shop-item--" + variant : "");
      var bottle = (
        '<div class="shop-item__bottle">' +
        bottleHTML(p) +
        badgeHTML(p.badge) +
        "</div>"
      );
      var info = (
        '<div class="shop-item__info">' +
        '<p class="shop-item__vintage">' + esc(p.vintage) + "</p>" +
        '<h3 class="shop-item__name">' + esc(p.name) + "</h3>" +
        '<p class="shop-item__type">' + esc(p.varietal || p.typeLabel) + "</p>" +
        '<p class="shop-item__price">€ ' + esc(p.price) + "</p>" +
        '<div class="shop-item__actions">' +
        '<button class="pill pill--solid" type="button" data-add="' + esc(p.id) + '"' + (sold ? " disabled" : "") + ">" + esc(addLabel) + "</button>" +
        "</div></div>"
      );
      return (
        '<article class="' + cls + '" data-wine-id="' + esc(p.id) + '">' +
        bottle + info +
        "</article>"
      );
    }

    /* ---- render all 3 sections ---- */
    COLLECTIONS.forEach(function (col) {
      var grid = document.getElementById("grid-" + col.key);
      if (!grid) return;
      var wines = WINES.filter(function (w) { return w.collection === col.key; });
      if (col.layout === "grid") {
        grid.innerHTML = wines.map(function (w) { return itemHTML(w, "row"); }).join("");
      } else {
        grid.innerHTML = wines.map(function (w) { return itemHTML(w, "feature"); }).join("");
      }
    });

    /* ---- add-to-cart (delegated, document-wide so it works on cards + quick-view) ---- */
    document.addEventListener("click", function (e) {
      var add = e.target.closest("[data-add], [data-quick-add]");
      if (!add || add.disabled) return;
      cart++;
      if (cartCountEl) cartCountEl.textContent = String(cart);
      var original = add.textContent;
      add.textContent = "Added ✓";
      add.classList.add("is-added");
      window.setTimeout(function () {
        add.textContent = original;
        add.classList.remove("is-added");
      }, 1400);
    });

    /* ---- Quick View modal ---- */
    var quick = document.getElementById("quickView");
    if (quick) {
      var qvImg = document.getElementById("quickViewImg");
      var qvType = document.getElementById("quickViewType");
      var qvTitle = document.getElementById("quickViewTitle");
      var qvMeta = document.getElementById("quickViewMeta");
      var qvNotes = document.getElementById("quickViewNotes");
      var qvPrice = document.getElementById("quickViewPrice");
      var qvAdd = quick.querySelector("[data-quick-add]");
      var qvClose = document.getElementById("quickViewClose");
      var lastFocus = null;

      function openQuick(wine) {
        lastFocus = document.activeElement;
        if (wine.image && qvImg) {
          qvImg.src = wine.image;
          qvImg.alt = wine.name + " bottle";
          qvImg.style.display = "";
          qvImg.onerror = function () {
            var fallbackHolder = qvImg.parentNode;
            qvImg.style.display = "none";
            // remove any prior fallback we injected
            var prior = fallbackHolder.querySelector(".bottle-fallback");
            if (prior) prior.remove();
            fallbackHolder.insertAdjacentHTML("beforeend", bottleSVG(wine.type));
          };
        } else if (qvImg) {
          qvImg.style.display = "none";
          var holder = qvImg.parentNode;
          var prior = holder.querySelector(".bottle-fallback");
          if (prior) prior.remove();
          holder.insertAdjacentHTML("beforeend", bottleSVG(wine.type));
        }
        qvType.textContent = wine.typeLabel + " · Vintage " + wine.vintage;
        qvTitle.textContent = wine.name;
        qvMeta.textContent = wine.tasting || "";
        qvNotes.textContent = wine.notes || "";
        qvPrice.textContent = "€ " + wine.price;
        if (qvAdd) {
          qvAdd.disabled = wine.badge === "sold-out";
          qvAdd.textContent = wine.badge === "sold-out" ? "Sold out" : "Add to cart";
          qvAdd.setAttribute("data-add", wine.id);
        }
        quick.hidden = false;
        quick.setAttribute("aria-hidden", "false");
        requestAnimationFrame(function () { quick.classList.add("is-open"); });
        lockScroll();
        document.addEventListener("keydown", quickKey);
        if (qvClose) qvClose.focus();
      }
      function closeQuick() {
        quick.classList.remove("is-open");
        quick.setAttribute("aria-hidden", "true");
        unlockScroll();
        document.removeEventListener("keydown", quickKey);
        window.setTimeout(function () { quick.hidden = true; }, 260);
        if (lastFocus) lastFocus.focus();
      }
      function quickKey(e) {
        if (e.key === "Escape") closeQuick();
        if (e.key === "Tab") trapFocus(e, quick.querySelector(".quick-view__panel"));
      }

      document.addEventListener("click", function (e) {
        var open = e.target.closest("[data-quick-open]");
        if (open) {
          var id = open.getAttribute("data-quick-open");
          var wine = WINES.filter(function (w) { return w.id === id; })[0];
          if (wine) openQuick(wine);
          return;
        }
        if (e.target.closest("[data-quick-close]")) closeQuick();
      });
      if (qvClose) qvClose.addEventListener("click", closeQuick);
    }

    /* ---- footer year ---- */
    var year = document.getElementById("footerYear");
    if (year) year.textContent = String(new Date().getFullYear());
  }
})();
