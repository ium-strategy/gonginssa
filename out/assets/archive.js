/* ===========================================================
 * 공인싸 (GONGINSSA) — 아티클 전체보기 페이지
 * data/articles.json 을 불러와 전체보기/카테고리별 필터로 보여준다.
 * 카드 마크업은 render.js 의 window.GI.cardHTML 을 그대로 재사용해
 * 홈 카드 디자인과 항상 같은 모습을 유지한다.
 * =========================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function boot() {
    const CFG = window.GI_CONFIG;
    const tabsEl = $("categoryTabs");
    const gridEl = $("archiveGrid");
    const emptyEl = $("emptyMsg");
    if (!tabsEl || !gridEl) return;

    let ARTICLES = [];
    let activeCategory = new URLSearchParams(location.search).get("category") || "all";
    let activeTag = new URLSearchParams(location.search).get("tag") || "";
    let activeQuery = (new URLSearchParams(location.search).get("q") || "").trim();
    const cloudEl = $("topicCloud");
    const queryEl = $("queryFilter");
    let searchTracked = false;

    // 태그로 들어온 페이지(?tag=영상)가 "전체 아티클 모아보기"라고 계속 표시되던 문제 수정.
    // <title>·<h1>·브레드크럼·부제목·og:title/twitter:title은 원래 빌드 시점에 고정된
    // 정적 텍스트라 태그 필터(클라이언트에서만 처리)와 완전히 분리돼 있었다 — 태그를
    // 고르거나 태그 URL로 바로 들어와도 절대 안 바뀌었다. 기본값을 한 번 저장해두고
    // 태그 활성/해제될 때마다 되돌릴 수 있게 한다.
    const titleEl = $("archiveTitle");
    const subtitleEl = $("archiveSubtitle");
    const breadcrumbEl = $("archiveBreadcrumb");
    const ogTitleEl = document.querySelector('meta[property="og:title"]');
    const twitterTitleEl = document.querySelector('meta[name="twitter:title"]');
    const DEFAULTS = {
      docTitle: document.title,
      h1: titleEl ? titleEl.textContent : "",
      subtitle: subtitleEl ? subtitleEl.textContent : "",
      breadcrumb: breadcrumbEl ? breadcrumbEl.textContent : "",
      ogTitle: ogTitleEl ? ogTitleEl.getAttribute("content") : "",
      twitterTitle: twitterTitleEl ? twitterTitleEl.getAttribute("content") : "",
    };

    function updateHeading() {
      if (activeTag) {
        const label = `'${activeTag}' 아티클 모아보기`;
        document.title = `${label} — 공인싸`;
        if (titleEl) titleEl.textContent = label;
        if (subtitleEl) subtitleEl.textContent = `'${activeTag}' 태그가 붙은 아티클만 모아봤어요.`;
        if (breadcrumbEl) breadcrumbEl.textContent = activeTag;
        if (ogTitleEl) ogTitleEl.setAttribute("content", `${label} — 공인싸`);
        if (twitterTitleEl) twitterTitleEl.setAttribute("content", `${label} — 공인싸`);
      } else {
        document.title = DEFAULTS.docTitle;
        if (titleEl) titleEl.textContent = DEFAULTS.h1;
        if (subtitleEl) subtitleEl.textContent = DEFAULTS.subtitle;
        if (breadcrumbEl) breadcrumbEl.textContent = DEFAULTS.breadcrumb;
        if (ogTitleEl) ogTitleEl.setAttribute("content", DEFAULTS.ogTitle);
        if (twitterTitleEl) twitterTitleEl.setAttribute("content", DEFAULTS.twitterTitle);
      }
    }

    function categoryLabel(key) {
      if (key === "all") return "전체보기";
      return (CFG.categories[key] && CFG.categories[key].name) || key;
    }

    function matchesQuery(a) {
      if (!activeQuery) return true;
      const haystack = [
        a.title,
        a.excerpt,
        (a.tags || []).join(" "),
        categoryLabel(a.category),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(activeQuery.toLowerCase());
    }

    function matches(a) {
      const okCat = activeCategory === "all" || a.category === activeCategory;
      const okTag = !activeTag || (a.tags || []).includes(activeTag);
      return okCat && okTag && matchesQuery(a);
    }

    // 태그로 이동해 들어온 경우에도(예: 홈 #보도자료 클릭) 다른 태그로 바로 갈아탈 수 있도록
    // 태그 하나만 보여주고 끝내지 않고, 항상 전체 태그 목록을 띄워둔다.
    // 카운트는 카테고리·검색어는 반영하고 태그 자체는 무시한 풀 기준 — "이 태그를 고르면 몇 건" 을 보여준다.
    function renderTopicCloud() {
      if (!cloudEl) return;
      const pool = ARTICLES.filter(
        (a) => (activeCategory === "all" || a.category === activeCategory) && matchesQuery(a)
      );
      const counts = {};
      pool.forEach((a) => (a.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
      const dict = (CFG.tagDictionary || Object.keys(counts)).filter((t) => counts[t]);
      const topics = dict.sort((a, b) => counts[b] - counts[a] || a.localeCompare(b, "ko"));
      const allChip = `<button type="button" class="tag${activeTag ? "" : " active"}" data-tag="">전체보기<span class="cnt">${pool.length}</span></button>`;
      const tagChips = topics
        .map(
          (t) =>
            `<button type="button" class="tag${t === activeTag ? " active" : ""}" data-tag="${esc(t)}">#${esc(t)}<span class="cnt">${counts[t]}</span></button>`
        )
        .join("");
      cloudEl.innerHTML = allChip + tagChips;
    }

    function renderQueryFilter() {
      if (!queryEl) return;
      queryEl.hidden = !activeQuery;
      if (!activeQuery) return;
      queryEl.innerHTML =
        `<span>\u2018<b>${esc(activeQuery)}</b>\u2019 검색 결과</span>` +
        `<button type="button" class="clear" id="clearQuery">검색 해제</button>`;
      const btn = document.getElementById("clearQuery");
      if (btn) btn.addEventListener("click", () => setQuery(""));
    }

    function setQuery(q) {
      activeQuery = q;
      const url = new URL(location.href);
      if (q) url.searchParams.set("q", q);
      else url.searchParams.delete("q");
      history.replaceState(null, "", url);
      const input = document.getElementById("site-search-input");
      if (input) input.value = q;
      renderQueryFilter();
      renderTopicCloud();
      renderTabs();
      renderGrid();
    }

    function setTag(tag) {
      activeTag = tag;
      const url = new URL(location.href);
      if (tag) url.searchParams.set("tag", tag);
      else url.searchParams.delete("tag");
      history.replaceState(null, "", url);
      updateHeading();
      renderTopicCloud();
      renderTabs();
      renderGrid();
    }

    function renderTabs() {
      const present = [...new Set(ARTICLES.map((a) => a.category))];
      const keys = ["all", ...present];
      tabsEl.innerHTML = keys
        .map((k) => {
          const pool = ARTICLES.filter(
            (a) => (!activeTag || (a.tags || []).includes(activeTag)) && matchesQuery(a)
          );
          const count = k === "all" ? pool.length : pool.filter((a) => a.category === k).length;
          return `<button type="button" class="tab-btn${k === activeCategory ? " active" : ""}" data-cat="${k}">${categoryLabel(k)} · ${count}</button>`;
        })
        .join("");
    }

    function renderGrid() {
      const list = ARTICLES.filter(matches).sort((a, b) => b.date.localeCompare(a.date));
      gridEl.innerHTML = list.map((a) => window.GI.cardHTML(a, false)).join("");
      if (emptyEl) {
        emptyEl.hidden = list.length > 0;
        emptyEl.textContent = activeQuery
          ? "검색 결과가 없습니다. 다른 키워드로 찾아보세요."
          : "조건에 맞는 아티클이 아직 없습니다.";
      }
      // GA4 — 검색으로 페이지에 들어온 경우 결과 수와 함께 1회만 집계한다.
      // (탭 전환 때마다 중복 발생하지 않도록 플래그로 막는다)
      if (activeQuery && !searchTracked) {
        searchTracked = true;
        // 260907: GTM 맞춤 이벤트 트리거가 잡는 dataLayer.push({event:...}) 형태로 통일
        try {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: "article_search",
            search_term: activeQuery,
            result_count: list.length,
          });
        } catch (e) {}
      }
    }

    function setActive(cat) {
      activeCategory = cat;
      const url = new URL(location.href);
      if (cat === "all") url.searchParams.delete("category");
      else url.searchParams.set("category", cat);
      history.replaceState(null, "", url);
      renderTabs();
      renderGrid();
    }

    tabsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      setActive(btn.dataset.cat);
    });

    if (cloudEl) {
      cloudEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".tag");
        if (!btn) return;
        const tag = btn.dataset.tag || "";
        setTag(tag);
        if (tag) {
          try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: "tag_click", tag_name: tag, page_ref: "articles" }); } catch (err) {}
        }
      });
    }

    fetch("data/articles.json")
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then((d) => {
        ARTICLES = d.articles || [];
        // URL의 category 값이 실제 존재하지 않으면 전체보기로 대체
        if (activeCategory !== "all" && !ARTICLES.some((a) => a.category === activeCategory)) {
          activeCategory = "all";
        }
        // URL의 tag 값이 실제 존재하지 않으면 필터를 해제한다
        if (activeTag && !ARTICLES.some((a) => (a.tags || []).includes(activeTag))) {
          activeTag = "";
        }
        updateHeading();
        renderTopicCloud();
        renderQueryFilter();
        renderTabs();
        renderGrid();
      })
      .catch(() => {
        gridEl.innerHTML =
          '<p class="sec-sub" style="padding:20px 0">데이터를 불러오지 못했습니다. 로컬 서버(예: <code>python -m http.server</code>)로 열어주세요.</p>';
      });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
