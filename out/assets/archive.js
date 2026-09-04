/* ===========================================================
 * 공인싸 (GONGINSSA) — 아티클 전체보기 페이지
 * data/articles.json 을 불러와 전체보기/카테고리별 필터로 보여준다.
 * 카드 마크업은 render.js 의 window.GI.cardHTML 을 그대로 재사용해
 * 홈 카드 디자인과 항상 같은 모습을 유지한다.
 * =========================================================== */
(function () {
  const $ = (id) => document.getElementById(id);

  function boot() {
    const CFG = window.GI_CONFIG;
    const tabsEl = $("categoryTabs");
    const gridEl = $("archiveGrid");
    const emptyEl = $("emptyMsg");
    if (!tabsEl || !gridEl) return;

    let ARTICLES = [];
    let activeCategory = new URLSearchParams(location.search).get("category") || "all";
    let activeTag = new URLSearchParams(location.search).get("tag") || "";
    const tagEl = $("tagFilter");

    function categoryLabel(key) {
      if (key === "all") return "전체보기";
      return (CFG.categories[key] && CFG.categories[key].name) || key;
    }

    function matches(a) {
      const okCat = activeCategory === "all" || a.category === activeCategory;
      const okTag = !activeTag || (a.tags || []).includes(activeTag);
      return okCat && okTag;
    }

    function renderTagFilter() {
      if (!tagEl) return;
      tagEl.hidden = !activeTag;
      if (!activeTag) return;
      tagEl.innerHTML =
        `<span>주제 <b>#${activeTag.replace(/[<>&]/g, "")}</b> 로 골라봤어요</span>` +
        `<button type="button" class="clear" id="clearTag">필터 해제</button>`;
      const btn = document.getElementById("clearTag");
      if (btn) btn.addEventListener("click", () => setTag(""));
    }

    function setTag(tag) {
      activeTag = tag;
      const url = new URL(location.href);
      if (tag) url.searchParams.set("tag", tag);
      else url.searchParams.delete("tag");
      history.replaceState(null, "", url);
      renderTagFilter();
      renderTabs();
      renderGrid();
    }

    function renderTabs() {
      const present = [...new Set(ARTICLES.map((a) => a.category))];
      const keys = ["all", ...present];
      tabsEl.innerHTML = keys
        .map((k) => {
          const pool = ARTICLES.filter((a) => !activeTag || (a.tags || []).includes(activeTag));
          const count = k === "all" ? pool.length : pool.filter((a) => a.category === k).length;
          return `<button type="button" class="tab-btn${k === activeCategory ? " active" : ""}" data-cat="${k}">${categoryLabel(k)} · ${count}</button>`;
        })
        .join("");
    }

    function renderGrid() {
      const list = ARTICLES.filter(matches).sort((a, b) => b.date.localeCompare(a.date));
      gridEl.innerHTML = list.map((a) => window.GI.cardHTML(a, false)).join("");
      if (emptyEl) emptyEl.hidden = list.length > 0;
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
        renderTagFilter();
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
