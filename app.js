(function () {
  "use strict";

  const data = window.__DATA__ || window.MANGA_DATA;
  if (!data) {
    console.error("Manga data not found. Please ensure data.js is generated via scripts/build-data.mjs.");
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const navLabels = {
    completed: "Completed",
    ongoing: "Ongoing",
    "to-read": "To Read",
    totals: "Totals",
    taste: "Taste"
  };

  const allCards = new Map();
  const allCardIds = [];
  let visibleCardIds = [];
  let currentModalCardId = null;

  data.sections.forEach((section) => {
    section.items.forEach((item) => {
      allCards.set(item.id, item);
      allCardIds.push(item.id);
    });
  });
  visibleCardIds = [...allCardIds];

  function posterMarkup(item, eager) {
    const badge = item.badge ? `<span class="badge">${esc(item.badge)}</span>` : "";
    const percent =
      Array.isArray(item.progress) && item.progress[1] > 0
        ? Math.min(100, (item.progress[0] / item.progress[1]) * 100)
        : null;
    const progress =
      percent === null
        ? ""
        : `<span class="progress" aria-hidden="true"><span style="width:${percent.toFixed(2)}%"></span></span>`;

    if (item.image) {
      return `<span class="poster">
        <img src="${esc(item.image)}" alt="${esc(item.title)} cover" ${eager ? "" : 'loading="lazy"'} width="700" height="1050" decoding="async">
        ${badge}${progress}
      </span>`;
    }

    return `<span class="poster poster--empty">
      <span class="empty-mark" aria-hidden="true">${esc(item.emptyMark || "M")}</span>
      <span class="empty-label">${esc(item.emptyLabel || item.title)}</span>
      ${badge}${progress}
    </span>`;
  }

  function cardMarkup(item, eager) {
    return `<button class="card" type="button" data-card="${esc(item.id)}" aria-label="Open reading details for ${esc(item.title)}">
      ${posterMarkup(item, eager)}
      <span class="card-title">${esc(item.shortTitle || item.title)}</span>
      <span class="card-meta">${esc(item.meta || "")}</span>
    </button>`;
  }

  function renderShell() {
    if (data.meta) {
      if ($("#profile")) $("#profile").textContent = data.meta.profile || "";
      if ($("#time-note")) $("#time-note").textContent = data.meta.timeNote || "";
      if ($("#hero-date")) $("#hero-date").textContent = data.meta.date || "Nov 2026";
    }

    if ($("#hero-stats") && Array.isArray(data.heroStats)) {
      $("#hero-stats").innerHTML = data.heroStats
        .map(
          (stat) => `<div class="stat">
            <strong>${esc(stat.value)}</strong>
            <span>${esc(stat.label)}</span>
          </div>`
        )
        .join("");
    }

    renderStackedHeroBar();
    renderNav();
  }

  function renderStackedHeroBar() {
    const barHost = $("#hero-stacked-bar");
    const legendHost = $("#hero-stacked-legend");
    const totalHost = $("#hero-stacked-total");
    if (!barHost || !legendHost) return;

    const stackedBars = data.totals?.stackedBars || [];
    const totalChapters = stackedBars.reduce((sum, b) => sum + (b.chapters || 0), 0);

    if (totalHost) {
      totalHost.textContent = `${totalChapters.toLocaleString()} chapters total`;
    }

    if (!stackedBars.length || totalChapters === 0) {
      barHost.innerHTML = `<div class="hero-stacked-segment" style="width: 100%; background: rgba(255, 255, 255, 0.06); cursor: default;" title="No chapters tracked yet"></div>`;
      legendHost.innerHTML = `<span class="legend-empty">Awaiting reading list entries</span>`;
      return;
    }

    barHost.innerHTML = stackedBars
      .filter((b) => (b.chapters || 0) > 0)
      .map(
        (bar) => `<div class="hero-stacked-segment" style="width:${bar.percentage}%; background-color:${esc(
          bar.accent
        )};" title="${esc(bar.label)}: ${bar.chapters.toLocaleString()} ch (${bar.percentage}%)" data-scroll-to="${esc(
          bar.sectionId
        )}"></div>`
      )
      .join("");

    legendHost.innerHTML = stackedBars
      .map(
        (bar) => `<div class="legend-item" data-scroll-to="${esc(bar.sectionId)}">
          <span class="legend-dot" style="background-color:${esc(bar.accent)}"></span>
          <span>${esc(bar.label)} (${bar.display || `${bar.chapters || 0} ch`})</span>
        </div>`
      )
      .join("");

    const scrollTargets = [barHost, legendHost];
    scrollTargets.forEach((target) => {
      target.addEventListener("click", (e) => {
        const item = e.target.closest("[data-scroll-to]");
        if (!item) return;
        const targetId = item.dataset.scrollTo;
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function renderNav() {
    const navItems = [
      ...data.sections.map((section, index) => ({
        id: section.id,
        label: navLabels[section.id] || section.title,
        count: section.items ? section.items.length : 0,
        num: String(index + 1).padStart(2, "0")
      })),
      { id: "totals", label: navLabels.totals, count: null, num: String(data.sections.length + 1).padStart(2, "0") },
      { id: "taste", label: navLabels.taste, count: null, num: String(data.sections.length + 2).padStart(2, "0") }
    ];

    $("#nav").innerHTML = navItems
      .map(
        (item) => `<a href="#${esc(item.id)}" data-nav="${esc(item.id)}">
          <span class="nav-num" aria-hidden="true">${esc(item.num)}</span>
          ${esc(item.label)}
          ${item.count != null ? `<span class="nav-pill">${item.count}</span>` : ""}
        </a>`
      )
      .join("");
  }

  function renderSections() {
    const host = $("#sections");
    if (!host) return;

    host.innerHTML = data.sections
      .map((section, sectionIndex) => {
        const classes = ["section"];
        if (section.feature) classes.push("section--feature");
        if (section.muted) classes.push("section--muted");

        const hasItems = Array.isArray(section.items) && section.items.length > 0;
        const cards = hasItems
          ? section.items.map((item, index) => cardMarkup(item, sectionIndex === 0 && index < 8)).join("")
          : `<div class="shelf-empty">
              <span class="shelf-empty-icon" aria-hidden="true">📖</span>
              <p>No titles in this shelf yet.</p>
            </div>`;

        return `<section class="${classes.join(" ")}" id="${esc(section.id)}" style="--accent:${esc(
          section.accent
        )}" data-section="${esc(section.id)}">
          <header class="section-head">
            <div class="section-kicker">${String(sectionIndex + 1).padStart(2, "0")}</div>
            <div class="section-heading">
              <h2>${esc(section.title)}</h2>
              ${section.subtitle ? `<p>${esc(section.subtitle)}</p>` : ""}
            </div>
            <div class="section-count">${esc(section.tag || `${(section.items || []).length} titles`)}</div>
          </header>
          <div class="grid">${cards}</div>
          ${section.footer ? `<p class="section-footnote">${esc(section.footer)}</p>` : ""}
        </section>`;
      })
      .join("");
  }

  function renderTotals() {
    if (!data.totals) return;

    if ($("#total-stats") && Array.isArray(data.totals.stats)) {
      $("#total-stats").innerHTML = data.totals.stats
        .map(
          (stat) => `<div class="stat-card">
            <strong>${esc(stat.value)}</strong>
            <span>${esc(stat.label)}</span>
          </div>`
        )
        .join("");
    }

    const chapterStat = data.totals.stats?.find((stat) => /chapter/i.test(stat.label));
    if (chapterStat && $("#bars-total")) {
      $("#bars-total").textContent = `${chapterStat.value} total`;
    }

    if (Array.isArray(data.totals.bars) && $("#bars")) {
      const barsWithData = data.totals.bars.filter((b) => (b.chapters || b.hours || 0) > 0);
      if (!barsWithData.length) {
        $("#bars").innerHTML = `<p class="bars-empty">No shelf data recorded yet.</p>`;
      } else {
        const max = Math.max(...barsWithData.map((bar) => bar.chapters || bar.hours || 0), 1);
        $("#bars").innerHTML = data.totals.bars
          .map(
            (bar) => {
              const val = bar.chapters != null ? bar.chapters : (bar.hours || 0);
              return `<div class="bar-row" style="--accent:${esc(bar.accent)}">
                <span class="bar-label">${esc(bar.label)}</span>
                <span class="bar-track" aria-hidden="true">
                  <span class="bar-fill" style="width:${Math.max(2, (val / max) * 100).toFixed(2)}%"></span>
                </span>
                <span class="bar-value">${esc(bar.display || `${val.toLocaleString()} ch`)}</span>
              </div>`;
            }
          )
          .join("");
      }
    }

    if (Array.isArray(data.totals.notes) && $("#total-notes")) {
      $("#total-notes").innerHTML = data.totals.notes.map((note) => `<li>${esc(note)}</li>`).join("");
    }
  }

  function renderTaste() {
    if (!data.taste) return;
    if ($("#taste-yes") && Array.isArray(data.taste.yes)) {
      $("#taste-yes").innerHTML = data.taste.yes.map((item) => `<li>${esc(item)}</li>`).join("");
    }
    if ($("#taste-no") && Array.isArray(data.taste.no)) {
      $("#taste-no").innerHTML = data.taste.no.map((item) => `<li>${esc(item)}</li>`).join("");
    }
    if ($("#taste-note") && data.taste.note) {
      $("#taste-note").textContent = data.taste.note;
    }
  }

  // ---------- Modal Logic & Keyboard Navigation ----------
  const modal = $("#modal");
  const panel = modal.querySelector(".modal-panel");
  const banner = $("#modal-banner");
  const heroEmpty = $("#modal-hero-empty");
  const posterHost = $("#modal-poster");
  const btnPrev = $("#modal-prev");
  const btnNext = $("#modal-next");
  let lastFocused = null;

  function formatLabel(format) {
    if (!format) return "Manga";
    if (format === "MANGA") return "Manga";
    if (format === "MANHWA") return "Manhwa";
    if (format === "MANHUA") return "Manhua";
    if (format === "NOVEL" || format === "LIGHT_NOVEL") return "Light Novel";
    if (format === "ONE_SHOT") return "One Shot";
    return format.charAt(0) + format.slice(1).toLowerCase();
  }

  function chip(text, extraClass) {
    return `<span class="chip${extraClass ? " " + extraClass : ""}">${esc(text)}</span>`;
  }

  function openModal(id) {
    const item = allCards.get(id);
    if (!item) return;

    currentModalCardId = id;
    lastFocused = document.activeElement;
    panel.style.setProperty("--accent", item.accent || "#e7b267");
    modal.hidden = false;
    document.body.classList.add("no-scroll");

    // Banner
    if (item.banner) {
      banner.src = item.banner;
      banner.alt = `${item.title} banner artwork`;
      banner.hidden = false;
      heroEmpty.classList.remove("is-visible");
      heroEmpty.innerHTML = "";
    } else {
      banner.removeAttribute("src");
      banner.hidden = true;
      heroEmpty.classList.add("is-visible");
      heroEmpty.innerHTML = `<span class="empty-mark" aria-hidden="true">${esc(item.emptyMark || "M")}</span>`;
    }

    // Poster
    if (item.image) {
      posterHost.classList.remove("is-empty");
      posterHost.innerHTML = `<img src="${esc(item.image)}" alt="${esc(item.title)} cover" width="700" height="1050">`;
    } else {
      posterHost.classList.add("is-empty");
      posterHost.innerHTML = `<span class="empty-mark" aria-hidden="true">${esc(
        item.emptyMark || "M"
      )}</span><span class="empty-label">${esc(item.emptyLabel || item.title)}</span>`;
    }

    // Titles & Section
    $("#modal-section").textContent = item.sectionTitle || "Manga Shelf";
    $("#modal-title").textContent = item.title;
    $("#modal-alt").textContent = item.alt || "";

    // Chips
    const chips = [];
    const format = formatLabel(item.info.format);
    chips.push({ text: format, class: "chip--format" });

    if (item.info.year) {
      chips.push({ text: String(item.info.year), class: "" });
    }

    if (item.info.status) {
      chips.push({ text: item.info.status.replace(/_/g, " "), class: "" });
    }

    if (item.meta) {
      chips.push({ text: item.meta, class: "" });
    } else if (item.chaptersRead || item.totalChapters) {
      const chText = item.chaptersRead
        ? `${item.chaptersRead}${item.totalChapters ? ` / ${item.totalChapters}` : ""} ch`
        : `${item.totalChapters} chapters`;
      chips.push({ text: chText, class: "" });
    }

    if (item.info.averageScore) {
      chips.push({ text: `★ ${item.info.averageScore}%`, class: "chip--score" });
    }

    // Authors / Staff
    if (Array.isArray(item.info.staff) && item.info.staff.length) {
      const primaryAuthor = item.info.staff.find((s) => /Story|Art|Author|Original/i.test(s.role)) || item.info.staff[0];
      if (primaryAuthor && primaryAuthor.name) {
        chips.push({ text: `${primaryAuthor.role || "Creator"}: ${primaryAuthor.name}`, class: "chip--author" });
      }
    }

    // Genres
    (item.info.genres || []).slice(0, 3).forEach((genre) => {
      chips.push({ text: genre, class: "chip--genre" });
    });

    $("#modal-chips").innerHTML = chips.map((c) => chip(c.text, c.class)).join("");

    // Personal Note
    const noteBlock = $("#modal-note");
    if (item.note) {
      noteBlock.hidden = false;
      $("#modal-note-text").textContent = item.note;
    } else {
      noteBlock.hidden = true;
    }

    // Synopsis
    const aboutBlock = $("#modal-about");
    if (item.synopsis) {
      aboutBlock.hidden = false;
      $("#modal-synopsis").textContent = item.synopsis;
    } else {
      aboutBlock.hidden = true;
    }

    // Gallery
    const gallery = $("#modal-gallery");
    const galleryGrid = $("#gallery-grid");
    const pictures = [];
    if (item.image) pictures.push({ src: item.image, label: "Cover Poster" });
    if (item.banner && item.banner !== item.image) pictures.push({ src: item.banner, label: "Banner Key Art" });

    if (pictures.length) {
      gallery.hidden = false;
      galleryGrid.classList.toggle("is-single", pictures.length === 1);
      galleryGrid.innerHTML = pictures
        .map(
          (pic) => `<a class="gallery-item" href="${esc(pic.src)}" target="_blank" rel="noopener">
            <img src="${esc(pic.src)}" alt="${esc(item.title)} ${esc(pic.label.toLowerCase())}" loading="lazy">
            <span>${esc(pic.label)}</span>
          </a>`
        )
        .join("");
    } else {
      gallery.hidden = true;
    }

    // Foot
    const foot = $("#modal-foot");
    const native = item.info.native || item.info.romaji || "";
    const hasNative = Boolean(native && native !== item.title);
    const hasLink = Boolean(item.info.siteUrl);
    const nativeLine = hasNative ? `<span class="native">${esc(native)}</span>` : "<span></span>";
    const link = hasLink
      ? `<a href="${esc(item.info.siteUrl)}" target="_blank" rel="noopener">View on AniList ↗</a>`
      : "";
    foot.hidden = !hasNative && !hasLink;
    foot.innerHTML = `${nativeLine}${link}`;

    // Update navigation buttons status
    const currentIndex = visibleCardIds.indexOf(id);
    if (btnPrev) btnPrev.disabled = currentIndex <= 0;
    if (btnNext) btnNext.disabled = currentIndex === -1 || currentIndex >= visibleCardIds.length - 1;

    try {
      history.replaceState(null, "", `#${id}`);
    } catch (_) {}

    panel.scrollTop = 0;
    $("#modal-close").focus({ preventScroll: true });
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("no-scroll");
    currentModalCardId = null;
    if (banner.src) banner.removeAttribute("src");
    posterHost.innerHTML = "";
    $("#gallery-grid").innerHTML = "";

    try {
      if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    } catch (_) {}

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
    }
  }

  function cycleModal(direction) {
    if (!currentModalCardId || !visibleCardIds.length) return;
    const currentIndex = visibleCardIds.indexOf(currentModalCardId);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = visibleCardIds.length - 1;
    if (nextIndex >= visibleCardIds.length) nextIndex = 0;

    openModal(visibleCardIds[nextIndex]);
  }

  function setupModal() {
    $("#sections").addEventListener("click", (event) => {
      const card = event.target.closest("[data-card]");
      if (card) openModal(card.dataset.card);
    });

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close]")) closeModal();
    });

    if (btnPrev) btnPrev.addEventListener("click", () => cycleModal(-1));
    if (btnNext) btnNext.addEventListener("click", () => cycleModal(1));

    document.addEventListener("keydown", (event) => {
      if (modal.hidden) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycleModal(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        cycleModal(1);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
        (element) => element.offsetParent !== null
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  // ---------- Live Search & Real-time Filter ----------
  function setupSearch() {
    const input = $("#search-input");
    const clearBtn = $("#search-clear");
    const shortcut = $("#search-shortcut");
    const statusBanner = $("#search-status");
    const statusText = $("#search-status-text");
    const resetBtn = $("#search-reset");
    const emptyState = $("#empty-search");
    const emptyResetBtn = $("#empty-reset-btn");

    if (!input) return;

    function filterCards(query) {
      const q = query.trim().toLowerCase();
      clearBtn.hidden = !q;
      if (shortcut) shortcut.hidden = Boolean(q);

      if (!q) {
        visibleCardIds = [...allCardIds];
        $$(".section").forEach((s) => s.classList.remove("is-hidden"));
        $$(".card").forEach((c) => c.classList.remove("is-hidden"));
        if (statusBanner) statusBanner.hidden = true;
        if (emptyState) emptyState.hidden = true;
        return;
      }

      let totalMatched = 0;
      let matchedSectionsCount = 0;
      const matchedIds = [];

      data.sections.forEach((section) => {
        const sectionEl = document.getElementById(section.id);
        let sectionMatched = 0;

        section.items.forEach((item) => {
          const cardEl = $(`[data-card="${item.id}"]`);
          const staffNames = (item.info.staff || []).map((s) => `${s.role} ${s.name}`).join(" ");
          const genres = (item.info.genres || []).join(" ");
          const searchCorpus = [
            item.title,
            item.alt,
            item.shortTitle,
            item.note,
            item.meta,
            item.info.english,
            item.info.romaji,
            item.info.native,
            item.info.format,
            genres,
            staffNames
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matches = searchCorpus.includes(q);
          if (cardEl) cardEl.classList.toggle("is-hidden", !matches);
          if (matches) {
            sectionMatched++;
            totalMatched++;
            matchedIds.push(item.id);
          }
        });

        if (sectionEl) {
          sectionEl.classList.toggle("is-hidden", sectionMatched === 0);
          if (sectionMatched > 0) matchedSectionsCount++;
        }
      });

      visibleCardIds = matchedIds;

      if (statusBanner && statusText) {
        statusBanner.hidden = false;
        statusText.textContent = `Showing ${totalMatched} of ${allCardIds.length} titles across ${matchedSectionsCount} shelf${
          matchedSectionsCount === 1 ? "" : "s"
        } for "${query}"`;
      }

      if (emptyState) {
        emptyState.hidden = totalMatched > 0;
      }
    }

    input.addEventListener("input", (e) => filterCards(e.target.value));

    function clearFilter() {
      input.value = "";
      filterCards("");
      input.focus();
    }

    clearBtn.addEventListener("click", clearFilter);
    if (resetBtn) resetBtn.addEventListener("click", clearFilter);
    if (emptyResetBtn) emptyResetBtn.addEventListener("click", clearFilter);

    // Keyboard shortcut: '/' focuses search
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== input && modal.hidden) {
        e.preventDefault();
        input.focus();
      } else if (e.key === "Escape" && document.activeElement === input) {
        clearFilter();
        input.blur();
      }
    });
  }

  // ---------- Navigation Spy ----------
  function setupNavHighlight() {
    const sections = [...document.querySelectorAll("main section[id]")];
    const links = new Map(
      [...document.querySelectorAll(".nav a")].map((link) => [link.getAttribute("href").slice(1), link])
    );

    let ticking = false;

    function update() {
      const marker = window.scrollY + 140;
      let currentId = sections.length ? sections[0].id : null;

      const atBottom =
        Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 4;

      if (atBottom) {
        currentId = sections.length ? sections[sections.length - 1].id : currentId;
      } else {
        for (const section of sections) {
          if (!section.classList.contains("is-hidden") && section.offsetTop <= marker) {
            currentId = section.id;
          }
        }
      }

      links.forEach((link, id) => {
        const active = id === currentId;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      ticking = false;
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
  }

  // Check initial hash for deep linking to a card
  function checkInitialHash() {
    const hash = window.location.hash.slice(1);
    if (hash && allCards.has(hash)) {
      openModal(hash);
    }
  }

  // Initialize
  renderShell();
  renderSections();
  renderTotals();
  renderTaste();
  setupModal();
  setupSearch();
  setupNavHighlight();
  checkInitialHash();
})();
