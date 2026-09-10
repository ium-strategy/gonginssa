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
    const t = document.querySelector("h1");
    // 260907: GTM 맞춤 이벤트 트리거가 잡는 dataLayer.push({event:...}) 형태로 통일
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "article_read",
        article_slug: location.pathname.split("/").pop().replace(".html", ""),
        article_title: t ? t.textContent.trim().slice(0, 80) : "",
      });
    } catch (e) {}
  }
  window.addEventListener("scroll", check, { passive: true });
})();

/* ================== 공유 버튼 — 링크 복사 · 카카오톡 ==================
   링크 복사는 별도 설정 없이 항상 동작한다. 카카오톡 공유는 config.js의
   kakaoJsKey가 비어있으면(기본값) 버튼 자체를 숨긴다 — 카카오 디벨로퍼스에
   앱을 만들고 키를 넣기 전까지는 동작 안 하는 버튼을 보여주지 않기 위함. */
(function () {
  const CFG = window.GI_CONFIG;

  function showToast(msg) {
    let el = document.querySelector(".a-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "a-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2000);
  }

  function trackShare(method) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "share_click",
        share_method: method,
        article_slug: document.body.dataset.articleId || "",
      });
    } catch (e) {}
  }

  const copyBtn = document.getElementById("shareCopyBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const url = location.href;
      const done = () => { showToast("✓ 링크가 복사되었습니다"); trackShare("copy_link"); };
      const fail = () => showToast("링크 복사에 실패했습니다. 주소창에서 직접 복사해주세요.");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(fail);
      } else {
        // 구형 브라우저 폴백 — 임시 입력창을 만들어 복사한다.
        try {
          const ta = document.createElement("textarea");
          ta.value = url;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          done();
        } catch (e) {
          fail();
        }
      }
    });
  }

  const kakaoBtn = document.getElementById("shareKakaoBtn");
  if (kakaoBtn && CFG.kakaoJsKey) {
    const sdk = document.createElement("script");
    sdk.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.0/kakao.min.js";
    sdk.onload = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(CFG.kakaoJsKey);
        kakaoBtn.hidden = false;
      } catch (e) {}
    };
    document.head.appendChild(sdk);

    kakaoBtn.addEventListener("click", () => {
      if (!window.Kakao || !window.Kakao.isInitialized()) return;
      const desc = document.querySelector('meta[name="description"]');
      const ogImage = document.querySelector('meta[property="og:image"]');
      const url = location.href;
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: document.title.replace(/\s*—\s*공인싸\s*$/, ""),
          description: desc ? desc.content : "",
          imageUrl: ogImage ? ogImage.content : "",
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: "아티클 보기", link: { mobileWebUrl: url, webUrl: url } }],
      });
      trackShare("kakao");
    });
  }
})();

