/* ===========================================================
 * 공인싸 (GONGINSSA) — 공통 UI 인터랙션
 * 아티클 탭 전환 · 헤더 스크롤 · 플로팅 구독 배너 · 구독 동의 ·
 * 스크롤 리빌. 데이터와 무관한 정적 동작만 담당한다.
 * =========================================================== */
document.addEventListener("DOMContentLoaded", function () {
  // article tabs (인기픽 / 실무 꿀팁 / 레퍼런스)
  const articleTabs = document.getElementById("articleTabs");
  const articlesTitle = document.getElementById("articlesTitle");
  if (articleTabs) {
    articleTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      articleTabs.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (articlesTitle) articlesTitle.textContent = btn.dataset.title;
      document.querySelectorAll(".tgrid[data-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.panel !== btn.dataset.panel;
      });
    });
  }

  // 구독 동의: "전체 동의"가 필수 체크박스 2개와 동기화되고,
  // 각 항목은 상세 설명을 펼쳐볼 수 있다
  const agreeAll = document.getElementById("agreeAll");
  const agreeRequired = document.querySelectorAll(".agree-required");
  if (agreeAll) {
    agreeAll.addEventListener("change", () => {
      agreeRequired.forEach((cb) => (cb.checked = agreeAll.checked));
    });
    agreeRequired.forEach((cb) => {
      cb.addEventListener("change", () => {
        agreeAll.checked = Array.from(agreeRequired).every((c) => c.checked);
      });
    });
  }
  document.querySelectorAll(".agree-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const detail = btn.closest(".agree-row").nextElementSibling;
      const open = detail.hidden;
      detail.hidden = !open;
      btn.textContent = open ? "접기" : "더보기";
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  // 구독 폼 — Netlify Forms로 전송(정적 호스팅에서도 서버 없이 제출을 수집).
  // 다른 호스팅(GitHub Pages 등)에서 열리면 Netlify Forms 엔드포인트가 없어
  // 전송이 실패할 수 있으니 그 경우에도 폼이 깨지지 않도록 처리한다.
  const subForm = document.getElementById("subForm");
  const subStatus = document.getElementById("subStatus");
  if (subForm) {
    subForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(subForm);
      fetch("/api/subscribe", { method: "POST", body: data })
        .then(() => {
          subStatus.style.display = "block";
          subForm.reset();
        })
        .catch(() => {
          // 전송 실패 시에도 사용자에게는 안내하되, 콘솔에 원인을 남긴다.
          console.error("구독 폼 전송 실패 — /api/subscribe 엔드포인트를 확인하세요.");
          subStatus.style.display = "block";
          subForm.reset();
        });
    });
  }

  // 상담 신청 모달 — 열기/닫기 + Netlify Forms 전송
  const consultOverlay = document.getElementById("consultOverlay");
  const consultOpenBtns = document.querySelectorAll(".js-open-consult");
  const consultCloseBtn = document.getElementById("consultCloseBtn");
  const consultForm = document.getElementById("consultForm");
  const consultStatus = document.getElementById("consultStatus");
  let consultLastFocus = null;

  function openConsult() {
    if (!consultOverlay) return;
    consultLastFocus = document.activeElement;
    consultOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    const firstField = document.getElementById("f-consult-name");
    if (firstField) firstField.focus();
  }
  function closeConsult() {
    if (!consultOverlay) return;
    consultOverlay.hidden = true;
    document.body.style.overflow = "";
    if (consultLastFocus) consultLastFocus.focus();
  }
  consultOpenBtns.forEach((btn) => btn.addEventListener("click", openConsult));

  // 사업자정보 모달 — 열기/닫기 (footer 하단 텍스트 링크로 트리거)
  const bizOverlay = document.getElementById("bizInfoOverlay");
  const bizOpenBtns = document.querySelectorAll(".js-open-bizinfo");
  const bizCloseBtn = document.getElementById("bizInfoCloseBtn");
  function openBizInfo() {
    if (!bizOverlay) return;
    bizOverlay.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeBizInfo() {
    if (!bizOverlay) return;
    bizOverlay.hidden = true;
    document.body.style.overflow = "";
  }
  bizOpenBtns.forEach((btn) => btn.addEventListener("click", openBizInfo));
  if (bizCloseBtn) bizCloseBtn.addEventListener("click", closeBizInfo);
  if (bizOverlay) {
    bizOverlay.addEventListener("click", (e) => {
      if (e.target === bizOverlay) closeBizInfo();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !bizOverlay.hidden) closeBizInfo();
    });
  }
  if (consultCloseBtn) consultCloseBtn.addEventListener("click", closeConsult);
  if (consultOverlay) {
    consultOverlay.addEventListener("click", (e) => {
      if (e.target === consultOverlay) closeConsult();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !consultOverlay.hidden) closeConsult();
    });
  }
  if (consultForm) {
    consultForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(consultForm);
      fetch("/api/consult", { method: "POST", body: data })
        .then(() => {
          consultStatus.style.display = "block";
          consultForm.reset();
          setTimeout(closeConsult, 1800);
        })
        .catch(() => {
          console.error("상담 신청 폼 전송 실패 — /api/consult 엔드포인트를 확인하세요.");
          consultStatus.style.display = "block";
          consultForm.reset();
          setTimeout(closeConsult, 1800);
        });
    });
  }

  // 헤더 — 히어로 위에서는 투명, 스크롤하면 불투명
  const siteHeader = document.querySelector("header.site");
  function updateHeader() {
    if (siteHeader) siteHeader.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  // 플로팅 구독 배너 — 히어로를 지나면 나타나고, 닫으면 세션 동안 다시 안 뜸
  const floatBar = document.getElementById("floatBar");
  const floatBarClose = document.getElementById("floatBarClose");
  const heroEl = document.querySelector(".hero");
  let floatBarDismissed = false;
  try { floatBarDismissed = sessionStorage.getItem("gonginssaide_bar_dismissed") === "1"; } catch (e) {}

  function syncFloatBarHeight() {
    if (!floatBar) return;
    document.documentElement.style.setProperty("--floatbar-h", floatBar.offsetHeight + "px");
  }
  function setBarVisible(visible) {
    floatBar.classList.toggle("show", visible);
    if (visible) syncFloatBarHeight();
    document.body.classList.toggle("bar-visible", visible);
  }
  function updateFloatBar() {
    if (!floatBar || floatBarDismissed || floatBar.dataset.shown === "1") return;
    if (heroEl && heroEl.getBoundingClientRect().bottom < 0) {
      floatBar.dataset.shown = "1";
      setBarVisible(true);
    }
  }
  if (floatBar) {
    window.addEventListener("scroll", updateFloatBar, { passive: true });
    window.addEventListener("resize", syncFloatBarHeight);
    updateFloatBar();
    window.addEventListener("load", updateFloatBar);
    if (floatBarClose) {
      floatBarClose.addEventListener("click", () => {
        floatBarDismissed = true;
        setBarVisible(false);
        try { sessionStorage.setItem("gonginssaide_bar_dismissed", "1"); } catch (e) {}
      });
    }
  }

  // 맨 위로 버튼 — 스크롤을 일정 이상 내리면 우측 하단에 나타남 (모든 공개 페이지 공통, JS로 생성)
  const topBtn = document.createElement("button");
  topBtn.type = "button";
  topBtn.className = "back-to-top";
  topBtn.setAttribute("aria-label", "맨 위로");
  topBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M12 5L5 12M12 5l7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.appendChild(topBtn);
  function updateTopBtn() {
    topBtn.classList.toggle("show", window.scrollY > 480);
  }
  window.addEventListener("scroll", updateTopBtn, { passive: true });
  updateTopBtn();
  topBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // 스크롤 리빌
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
});
