/* ===========================================================
 * 공인싸 (GONGINSSA) — 홈 렌더링
 * data/config.js + data/articles.json 을 읽어 홈을 그린다.
 * =========================================================== */
(function () {
  const CFG = window.GI_CONFIG;
  const CAT = CFG.categories;
  const ORDER = CFG.categoryOrder;
  const SITE = CFG.site;

  /* ---------- 유틸 ---------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (d) => {
    const [y, m, dd] = d.split("-");
    return `${y}.${m}.${dd}`;
  };
  const catArt = (slug) =>
    `background:linear-gradient(135deg, ${CAT[slug].color}, color-mix(in srgb, ${CAT[slug].color} 55%, #000))`;
  const seriesCount = (slug, list) =>
    list.filter((a) => a.series === slug).length;

  function tagCounts(list) {
    const c = {};
    list.forEach((a) => (a.tags || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
    return Object.entries(c).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }

  /* ---------- 렌더 ---------- */
  function render(DATA) {
    const A = DATA.articles || [];
    const NL = DATA.newsletter;
    const byDate = [...A].sort((a, b) => b.date.localeCompare(a.date));

    // dateline
    $("dateline-left").textContent = `제${NL.no}호 · ${NL.date.split("-")[0]}년 ${Number(NL.date.split("-")[1])}월 ${Number(NL.date.split("-")[2])}일 발행`;

    // HERO
    const lead = A.find((a) => a.featured) || byDate[0];
    if (lead) {
      const c = CAT[lead.category];
      const kws = tagCounts(A).slice(0, 6).map((t) => `<a class="kw" href="#" data-demo>#${esc(t.name)}</a>`).join("");
      const toc = A.filter((a) => a.issue === NL.no).slice(0, 5).map((a, i) => {
        const cc = CAT[a.category];
        return `<a class="toc" href="#" data-demo>
          <span class="toc__no">${String(i + 1).padStart(2, "0")}</span>
          <span class="toc__body">
            <span class="toc__corner" style="color:${cc.color}">${cc.emoji} ${cc.corner}</span>
            <span class="toc__title">${esc(a.title)}</span>
          </span></a>`;
      }).join("");
      $("hero-grid").innerHTML = `
        <article class="cover">
          <div class="cover__kicker">
            <span class="tag" style="background:${c.color}">${c.name} · ${c.corner}</span>
            <span class="cover__pick">이번 호 커버 · Editor's pick</span>
          </div>
          <div class="cover__art" style="${catArt(lead.category)}"><span class="cover__emoji">${c.emoji}</span></div>
          <h1 class="cover__title"><a href="#" data-demo>${esc(lead.title)}</a></h1>
          <p class="cover__excerpt">${esc(lead.excerpt)}</p>
          <div class="cover__meta">
            <span class="mono">${fmt(lead.date)}</span>
            <span class="mono">읽기 ${lead.readTime}분</span>
            ${lead.issue ? `<span class="tag" style="background:var(--navy)">📬 ${SITE.newsletter} ${lead.issue}호 수록</span>` : ""}
          </div>
          <div class="kw-row">${kws}</div>
        </article>
        <aside class="contents">
          <div class="contents__head"><h2>이번 호 목차</h2><span class="mono">No.${NL.no}</span></div>
          ${toc || '<p class="sec-sub">이번 호 수록 글이 없습니다.</p>'}
        </aside>`;
    }

    // LATEST
    $("latest-cards").innerHTML = byDate.slice(0, 6).map((a) => {
      const c = CAT[a.category];
      return `<article class="card">
        <a class="card__art" href="#" data-demo style="${catArt(a.category)}">
          <span class="card__emoji">${c.emoji}</span>
          <span class="tag" style="background:${c.color}">${c.name}</span>
          ${a.series ? `<span class="card__series">📚 ${seriesCount(a.series, A)}편 시리즈</span>` : ""}
        </a>
        <div class="card__body">
          <a class="card__title" href="#" data-demo>${esc(a.title)}</a>
          <p class="card__excerpt">${esc(a.excerpt)}</p>
          <div class="card__meta"><span>${fmt(a.date)}</span><span>·</span><span>${a.readTime}분</span>
            ${a.issue ? `<span class="card__issue">📬 ${a.issue}호</span>` : ""}</div>
        </div>
      </article>`;
    }).join("");

    // CATEGORY INDEX
    $("cat-index").innerHTML = ORDER.map((slug, i) => {
      const c = CAT[slug];
      const n = A.filter((a) => a.category === slug).length;
      return `<a class="catrow" href="#" data-demo style="--cc:${c.color}">
        <span class="catrow__no">${String(i + 1).padStart(2, "0")}</span>
        <span class="catrow__name"><b>${c.emoji} ${c.name}</b><span class="catrow__corner">${c.corner}</span></span>
        <span class="catrow__desc">${c.desc}</span>
        <span class="catrow__count">${n}편 →</span>
      </a>`;
    }).join("");

    // KEYWORD CLOUD
    const tags = tagCounts(A);
    if (tags.length) {
      const mx = Math.max(...tags.map((t) => t.count)), mn = Math.min(...tags.map((t) => t.count));
      $("cloud").innerHTML = tags.map((t) => {
        const r = mx === mn ? 1 : (t.count - mn) / (mx - mn);
        const size = (14 + r * 10).toFixed(1), w = r > 0.5 ? 800 : 600;
        return `<a href="#" data-demo style="font-size:${size}px;font-weight:${w}">#${esc(t.name)}<span class="n">${t.count}</span></a>`;
      }).join("");
    }

    // JOBS
    $("jobs-list").innerHTML = CFG.jobs.map((j) => `
      <a class="job" href="#" data-demo>
        <span class="job__type">${j.type}</span>
        <span class="job__main"><span class="job__title">${esc(j.title)}</span><span class="job__org">${esc(j.org)}</span></span>
        <span class="job__meta"><span>📍 ${esc(j.location)}</span><span class="job__deadline">${esc(j.deadline)}</span></span>
      </a>`).join("");

    // NEWSLETTER PREVIEW
    const corners = (NL.corners || []).map((s) =>
      `<span class="np__corner" style="--cc:${CAT[s].color}">${CAT[s].emoji} ${CAT[s].corner}</span>`).join("");
    $("np").innerHTML = `
      <div class="np__card">
        <span class="np__issue">📬 ${SITE.newsletter} ${NL.no}호</span>
        <h3 class="np__title">${esc(NL.title)}</h3>
        <span class="np__date">${fmt(NL.date)} 발행</span>
        <div class="np__corners">${corners}</div>
        <p class="np__sum">${esc(NL.summary)}</p>
        <p class="np__blur">다음 내용은 구독자에게만 공개됩니다. 캠페인 해부대에서는 실제 운영 데이터와 함께 단계별 전략을 공개하고, 연장통에서는 이번 호에 사용한 템플릿 파일을 첨부합니다.</p>
        <div class="np__actions">
          <a class="btn btn--primary" href="#subscribe">구독하면 다음 호부터</a>
          <a class="btn btn--ghost" href="#" data-demo>전체 보기</a>
        </div>
      </div>`;

    // FOOTER CATS
    $("foot-cats").innerHTML = ORDER.map((s) => `<a href="#index">${CAT[s].name} · ${CAT[s].corner}</a>`).join("");

    // reveal
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  /* ---------- 데이터 로드 ---------- */
  // 1) 관리자가 저장한 로컬 초안이 있으면 우선(미리보기), 2) articles.json fetch, 3) 실패 시 내장 폴백
  function boot() {
    const draft = localStorage.getItem("gi_articles_preview");
    if (draft) {
      try { render(JSON.parse(draft)); markDraft(); return; } catch (e) {}
    }
    fetch("data/articles.json")
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(() => {
        // file:// 등으로 fetch가 막힌 경우 안내
        if (window.GI_FALLBACK) { render(window.GI_FALLBACK); }
        else {
          $("hero-grid").innerHTML =
            '<p class="sec-sub" style="padding:30px 0">데이터를 불러오지 못했습니다. 로컬 서버(예: <code>python -m http.server</code>)로 열어주세요.</p>';
        }
      });
  }
  function markDraft() {
    const el = $("dateline-left");
    if (el) el.textContent += " · [관리자 미리보기]";
  }

  // 인터랙션(구독/데모 링크/테마/토스트)은 공통으로
  window.GI = window.GI || {};
  window.GI.render = render;
  document.addEventListener("DOMContentLoaded", boot);
})();
