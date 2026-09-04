/* ===========================================================
 * 공인싸 (GONGINSSA) — 홈 렌더링
 * data/config.js + data/articles.json 을 읽어 트렌딩 키워드와
 * 탭별 아티클 그리드(인기픽/실무 꿀팁/레퍼런스)를 그린다.
 * =========================================================== */
(function () {
  const CFG = window.GI_CONFIG;
  const CAT = CFG.categories;
  const TABS = CFG.tabs;

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const timeIcon =
    '<svg viewBox="0 0 16 16" fill="none" style="color:var(--text-body)"><circle cx="8" cy="8" r="6.3" stroke="currentColor" stroke-width="1.3"/><path d="M8 4.6V8L10.2 9.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

  function cardHTML(a, featured) {
    const catLabel = (CAT[a.category] && CAT[a.category].name) || a.category;
    const metaLine = `<span class="meta-line"><span>${esc(catLabel)}</span><span class="sep">|</span><span class="time">${timeIcon}${a.readTime}분</span></span>`;
    const href = esc(a.url || "#");
    if (featured) {
      return `<a class="tcard-featured" href="${href}">
        <div class="thumb"><img src="${esc(a.thumb)}" alt=""></div>
        <div class="info"><h3>${esc(a.title)}</h3><p class="summary">${esc(a.excerpt)}</p>${metaLine}</div>
      </a>`;
    }
    return `<a class="tcard" href="${href}">
      <div class="thumb"><img src="${esc(a.thumb)}" alt=""></div>
      <div class="info"><h4>${esc(a.title)}</h4>${metaLine}</div>
    </a>`;
  }

  function renderTabPanel(tabKey, articles) {
    const panel = document.querySelector(`.tgrid[data-panel="${tabKey}"]`);
    if (!panel) return;
    const list = articles.filter((a) => (a.tabs || []).includes(tabKey)).sort((a, b) => b.date.localeCompare(a.date));
    if (!list.length) {
      panel.innerHTML = '<p class="sec-sub" style="padding:20px 0">아직 이 탭에 담긴 아티클이 없습니다.</p>';
      return;
    }
    panel.innerHTML = list.map((a, i) => cardHTML(a, i === 0)).join("");
  }

  function render(DATA) {
    const A = DATA.articles || [];

    // TOPICS — 실제 아티클 해시태그를 집계해 그린다.
    // 격주 1편 발행 구조라 노출 임계값은 두지 않는다. 0편이면 자동으로 사라지고,
    // 편수 내림차순으로 정렬되므로 글이 쌓이면 순서가 저절로 바뀐다.
    const counts = {};
    A.forEach((a) => (a.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    const dict = CFG.tagDictionary || Object.keys(counts);
    const topics = dict
      .filter((t) => counts[t])
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b, "ko"));
    if ($("cloud")) {
      $("cloud").innerHTML = topics
        .map(
          (t) =>
            `<a class="tag" href="articles.html?tag=${encodeURIComponent(t)}" data-tag="${esc(t)}">` +
            `${esc(t)}<span class="cnt">${counts[t]}</span></a>`
        )
        .join("");
      $("cloud").addEventListener("click", (e) => {
        const el = e.target.closest("a.tag");
        if (el && typeof gtag === "function") {
          try { gtag("event", "tag_click", { tag_name: el.dataset.tag, page_ref: "home" }); } catch (err) {}
        }
      });
    }

    // ARTICLE TABS
    TABS.forEach((t) => renderTabPanel(t.key, A));
  }

  /* ---------- 데이터 로드 ---------- */
  function boot() {
    // 관리자 페이지에서 저장 전 미리보기로 연 경우(?preview=1)에만 임시 초안을 사용한다.
    // 그 외 일반 방문(홈 URL을 그대로 열었을 때)은 항상 서버의 최신 데이터를 불러온다 —
    // 그렇지 않으면 관리자가 예전에 한 번이라도 미리보기를 열어본 브라우저에서
    // 실제 배포된 최신 콘텐츠(예: 새 썸네일) 대신 오래된 초안이 계속 표시되는 문제가 있었다.
    if (new URLSearchParams(location.search).get("preview") === "1") {
      const draft = localStorage.getItem("gi_articles_preview");
      if (draft) {
        try { render(JSON.parse(draft)); return; } catch (e) {}
      }
    }
    fetch("data/articles.json")
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(() => {
        if (window.GI_FALLBACK) { render(window.GI_FALLBACK); }
        else {
          const el = $("articles");
          if (el) el.insertAdjacentHTML("beforeend",
            '<p class="sec-sub" style="padding:20px 40px">데이터를 불러오지 못했습니다. 로컬 서버(예: <code>python -m http.server</code>)로 열어주세요.</p>');
        }
      });
  }

  window.GI = window.GI || {};
  window.GI.render = render;
  window.GI.cardHTML = cardHTML;
  window.GI.CAT = CAT;
  document.addEventListener("DOMContentLoaded", boot);
})();
