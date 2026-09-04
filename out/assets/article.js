/* ===========================================================
 * 공인싸 (GONGINSSA) — 아티클 상세페이지 전용
 * 같은 카테고리의 다른 아티클을 "같이 보면 좋은 아티클"에 채운다.
 * (render.js 의 카드 마크업과 톤을 맞추되, articles/ 하위 경로이므로
 *  thumb·url 앞에 "../"를 붙여 상대경로를 다시 계산한다.)
 * =========================================================== */
(function () {
  const CFG = window.GI_CONFIG;
  const CAT = CFG.categories;
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const timeIcon =
    '<svg viewBox="0 0 16 16" fill="none" style="color:var(--text-body)"><circle cx="8" cy="8" r="6.3" stroke="currentColor" stroke-width="1.3"/><path d="M8 4.6V8L10.2 9.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

  function cardHTML(a) {
    const catLabel = (CAT[a.category] && CAT[a.category].name) || a.category;
    const metaLine = `<span class="meta-line"><span>${esc(catLabel)}</span><span class="sep">|</span><span class="time">${timeIcon}${a.readTime}분</span></span>`;
    return `<a class="tcard" href="../${esc(a.url)}">
      <div class="thumb"><img src="../${esc(a.thumb)}" alt=""></div>
      <div class="info"><h4>${esc(a.title)}</h4>${metaLine}</div>
    </a>`;
  }

  function renderRelated(DATA) {
    const grid = document.getElementById("relatedGrid");
    if (!grid) return;
    const currentId = document.body.dataset.articleId;
    const all = DATA.articles || [];
    const current = all.find((a) => a.id === currentId);
    let pool = all.filter((a) => a.id !== currentId);
    if (current) {
      pool = pool.sort((a, b) => (a.category === current.category ? -1 : 1) - (b.category === current.category ? -1 : 1));
    }
    const related = pool.slice(0, 3);
    if (!related.length) {
      grid.closest(".a-related").style.display = "none";
      return;
    }
    grid.innerHTML = related.map(cardHTML).join("");
  }

  fetch("../data/articles.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(renderRelated)
    .catch(() => {
      const el = document.getElementById("relatedGrid");
      if (el) el.closest(".a-related").style.display = "none";
    });
})();

/* ================== GA4 — 아티클 실질 읽음 ==================
   본문 75% 지점을 지나면 1회만 발생. 콘텐츠가 신뢰를 만드는지 보는 지표. */
(function () {
  let fired = false;
  function check() {
    if (fired) return;
    const doc = document.documentElement;
    const total = doc.scrollHeight - window.innerHeight;
    if (total <= 0) return;
    if ((window.scrollY || doc.scrollTop) / total < 0.75) return;
    fired = true;
    window.removeEventListener("scroll", check);
    if (typeof gtag !== "function") return;
    const t = document.querySelector("h1");
    try {
      gtag("event", "article_read", {
        article_slug: location.pathname.split("/").pop().replace(".html", ""),
        article_title: t ? t.textContent.trim().slice(0, 80) : "",
      });
    } catch (e) {}
  }
  window.addEventListener("scroll", check, { passive: true });
})();

