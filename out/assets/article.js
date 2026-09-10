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

/* ================== 공유 버튼 — 드롭다운(URL 복사 · 카카오톡 · 스레드 · 네이버 밴드) ==================
   "공유하기" 아이콘을 누르면 채널 목록이 드롭다운으로 뜬다.
   카카오톡은 config.js의 kakaoJsKey가 비어있으면(기본값) 목록에서 숨긴다 —
   카카오 디벨로퍼스에 앱을 만들고 키를 넣기 전까지는 동작 안 하는 항목을
   보여주지 않기 위함. 인스타그램은 웹에서 쓸 수 있는 공식 공유 URL이
   없어서(앱 내부 전용) 목록에 넣지 않는 대신, navigator.share를 지원하는
   기기(주로 모바일)에서는 "공유하기" 버튼 자체가 OS 네이티브 공유창을
   먼저 시도한다 — 설치돼 있으면 인스타그램·스레드 등도 거기서 뜬다. */
(function () {
  const CFG = window.GI_CONFIG;
  const shareUrl = location.href;
  const shareTitle = document.title.replace(/\s*—\s*공인싸\s*$/, "");

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

  function copyLink() {
    const done = () => { showToast("✓ 링크가 복사되었습니다"); trackShare("copy_link"); };
    const fail = () => showToast("링크 복사에 실패했습니다. 주소창에서 직접 복사해주세요.");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(done).catch(fail);
    } else {
      // 구형 브라우저 폴백 — 임시 입력창을 만들어 복사한다.
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
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
  }

  // 카카오톡 피드 템플릿은 content.imageWidth/imageHeight를 안 주면 이미지 실제
  // 비율을 몰라서 자체 기본 박스에 맞춰 확대·크롭한다 — 아티클마다 썸네일 크기가
  // 다를 수 있어(1280x720이 대부분이지만 예외도 있음) 공유 시점에 실제 이미지를
  // 로드해 자연 크기를 읽은 뒤 그 값을 넘긴다(260911 썸네일 위쪽이 잘려 보이던 문제).
  function loadImageSize(url) {
    return new Promise((resolve) => {
      if (!url) { resolve(null); return; }
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function shareKakao() {
    if (!window.Kakao || !window.Kakao.isInitialized()) return;
    const desc = document.querySelector('meta[name="description"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    const imageUrl = ogImage ? ogImage.content : "";
    const size = await loadImageSize(imageUrl);
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: shareTitle,
        description: desc ? desc.content : "",
        imageUrl: imageUrl,
        imageWidth: size ? size.width : 1200,
        imageHeight: size ? size.height : 630,
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      },
      buttons: [{ title: "아티클 보기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
    });
    trackShare("kakao");
  }

  function shareThreads() {
    const text = `${shareTitle}\n${shareUrl}`;
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    trackShare("threads");
  }

  function shareBand() {
    const body = encodeURIComponent(shareTitle);
    const route = encodeURIComponent(shareUrl);
    window.open(`https://band.us/plugin/share?body=${body}&route=${route}`, "_blank", "noopener");
    trackShare("band");
  }

  const toggleBtn = document.getElementById("shareToggleBtn");
  const menu = document.getElementById("shareMenu");
  if (!toggleBtn || !menu) return;

  function closeMenu() {
    menu.hidden = true;
    toggleBtn.setAttribute("aria-expanded", "false");
  }
  function openMenu() {
    menu.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "true");
  }

  // 모바일 등 OS 네이티브 공유 시트를 지원하는 기기에서는 그걸 먼저 시도한다
  // (인스타그램·카카오톡·메시지 등 설치된 앱이 전부 뜸). 실패/미지원이면
  // 지금까지처럼 드롭다운 메뉴를 연다.
  toggleBtn.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        trackShare("native");
        return;
      } catch (e) {
        // 사용자가 공유창을 취소한 경우도 여기로 온다 — 드롭다운을 대신 열지 않고 조용히 종료
        if (e && e.name === "AbortError") return;
      }
    }
    if (menu.hidden) openMenu();
    else closeMenu();
  });

  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== toggleBtn && !toggleBtn.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  const kakaoItem = menu.querySelector('[data-share="kakao"]');
  if (kakaoItem && CFG.kakaoJsKey) {
    const sdk = document.createElement("script");
    sdk.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.0/kakao.min.js";
    sdk.onload = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(CFG.kakaoJsKey);
        kakaoItem.hidden = false;
      } catch (e) {}
    };
    document.head.appendChild(sdk);
  }

  menu.addEventListener("click", (e) => {
    const item = e.target.closest(".a-share-item");
    if (!item) return;
    closeMenu();
    const kind = item.dataset.share;
    if (kind === "copy") copyLink();
    else if (kind === "kakao") shareKakao();
    else if (kind === "threads") shareThreads();
    else if (kind === "band") shareBand();
  });
})();

