/* ===========================================================
 * 공인싸 (GONGINSSA) — 공통 UI 인터랙션
 * 아티클 탭 전환 · 헤더 스크롤 · 플로팅 구독 배너 · 구독 동의 ·
 * 스크롤 리빌. 데이터와 무관한 정적 동작만 담당한다.
 * =========================================================== */
document.addEventListener("DOMContentLoaded", function () {
  // 폼 검증 — 브라우저 기본 말풍선(주황색, 시스템 폰트, 사이트 톤앤매너와 안 맞음) 대신
  // 같은 문구를 사이트 스타일 카드(.field-warn)로 필드 바로 아래에 띄운다.
  // 각 <form>에 novalidate를 줘서 브라우저 말풍선 자체를 끄고, checkValidity()로 직접
  // 검사한다 — field.validationMessage는 브라우저가 이미 한국어로 만들어주므로 그대로 쓴다.
  function showFieldWarning(field) {
    const msg = field.validationMessage || "입력값을 확인해주세요.";
    const anchor = field.closest(".agree-row") || field;
    const el = document.createElement("p");
    el.className = "field-warn";
    el.setAttribute("role", "alert");
    el.textContent = msg;
    anchor.insertAdjacentElement("afterend", el);
    const clear = () => el.remove();
    field.addEventListener("input", clear, { once: true });
    field.addEventListener("change", clear, { once: true });
  }
  function validateForm(form) {
    form.querySelectorAll(".field-warn").forEach((el) => el.remove());
    const firstInvalid = Array.from(form.querySelectorAll("[required]")).find((f) => !f.checkValidity());
    if (firstInvalid) {
      showFieldWarning(firstInvalid);
      firstInvalid.focus();
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

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

  // 구독 폼 — Cloudflare Pages Functions(/api/subscribe)로 전송.
  // 엔드포인트가 없거나 오류가 나도 사용자 경험이 끊기지 않도록 처리한다.
  /* ================== GA4 이벤트 ==================
     퍼널만 측정한다: 구독 → 상담 → 계약. 이벤트를 늘리면 아무도 안 본다.
     gtag이 아직 로드되지 않았거나 광고차단으로 없을 수도 있으므로 항상 존재 확인. */
  function giTrack(name, params) {
    if (typeof gtag !== "function") return;
    try { gtag("event", name, params || {}); } catch (e) {}
  }
  function giPageRef() {
    // 어느 아티클에서 발생한 전환인지 구분하기 위한 경로
    return location.pathname.replace(/^\//, "") || "home";
  }

  const subForm = document.getElementById("subForm");
  const subStatus = document.getElementById("subStatus");
  const subStatusOkText = subStatus ? subStatus.textContent : "";
  if (subForm) {
    subForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateForm(subForm)) return;
      const data = new FormData(subForm);
      fetch("/api/subscribe", { method: "POST", body: data })
        .then((res) => {
          // fetch는 500 같은 에러 응답에도 reject하지 않으므로 res.ok를 직접 확인해야
          // 한다 — 이전에는 이 확인이 없어서 서버가 실패해도 항상 "성공" 문구가 떴다.
          if (!res.ok) {
            return res.text().then((body) => {
              throw new Error(`HTTP ${res.status}: ${body}`);
            });
          }
          return res.json().catch(() => ({}));
        })
        .then((body) => {
          giTrack("subscribe_submit", {
            referral: data.get("referral") || "",
            page_ref: giPageRef(),
          });
          // 성공 안내는 알림창으로 띄우고, 닫히면 그때 폼을 처음 상태로 되돌린다
          // (알림창은 동기적으로 멈춰 있다가 닫혀야 다음 줄이 실행되므로 순서가 보장됨).
          alert(body && body.duplicate
            ? "이미 등록된 메일주소입니다. 다음 발행을 기다려주세요!"
            : subStatusOkText);
          subForm.reset();
        })
        .catch((err) => {
          console.error("구독 폼 전송 실패 — /api/subscribe 엔드포인트를 확인하세요.", err);
          if (subStatus) {
            subStatus.textContent = "잠시 후 다시 시도해주세요. 문제가 계속되면 letter@gonginssa.kr로 알려주세요.";
            subStatus.style.color = "var(--req)";
            subStatus.style.display = "block";
          }
        });
    });
  }

  // 상담 신청 모달 — 열기/닫기 + Cloudflare Pages Functions(/api/consult)로 전송
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
  consultOpenBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      giTrack("consult_open", { page_ref: giPageRef() });
    })
  );
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
  const consultStatusOkText = consultStatus ? consultStatus.textContent : "";
  if (consultForm) {
    consultForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateForm(consultForm)) return;
      const data = new FormData(consultForm);
      fetch("/api/consult", { method: "POST", body: data })
        .then((res) => {
          if (!res.ok) {
            return res.text().then((body) => {
              throw new Error(`HTTP ${res.status}: ${body}`);
            });
          }
          giTrack("consult_submit", { page_ref: giPageRef() });
          // 구독 폼과 동일하게 알림창으로 안내하고, 닫히면 폼을 처음 상태로 되돌린다.
          alert(consultStatusOkText);
          consultForm.reset();
          closeConsult();
        })
        .catch((err) => {
          console.error("상담 신청 폼 전송 실패 — /api/consult 엔드포인트를 확인하세요.", err);
          if (consultStatus) {
            consultStatus.textContent = "잠시 후 다시 시도해주세요. 문제가 계속되면 letter@gonginssa.kr로 알려주세요.";
            consultStatus.style.color = "var(--req)";
            consultStatus.style.display = "block";
          }
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
    // 홈(.hero 있음)은 히어로를 다 지나가면 노출. .hero가 없는 페이지(아티클 상세,
    // 아티클 목록 등)는 이 조건이 항상 false라 배너가 영영 안 뜨던 버그가 있었다 —
    // 그런 페이지는 400px 스크롤을 기준으로 대신 노출한다.
    const pastThreshold = heroEl ? heroEl.getBoundingClientRect().bottom < 0 : window.scrollY > 400;
    if (pastThreshold) {
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
  /* 주요 CTA 클릭 — 어떤 버튼이 실제로 눌리는지 확인용 */
  document.addEventListener("click", (e) => {
    const tagEl = e.target.closest("a.a-tag");
    if (tagEl) {
      giTrack("tag_click", {
        tag_name: (tagEl.textContent || "").replace("#", "").trim(),
        page_ref: giPageRef(),
      });
    }
    const cardEl = e.target.closest("a.tcard, a.tcard-featured");
    if (cardEl) {
      const slug = (cardEl.getAttribute("href") || "").split("/").pop().replace(".html", "");
      giTrack("article_click", { article_slug: slug, page_ref: giPageRef() });
    }
    const el = e.target.closest(".btn-primary, .more-link, .head .more");
    if (!el) return;
    const label = (el.textContent || "").trim().slice(0, 40);
    if (!label) return;
    giTrack("cta_click", { cta_label: label, page_ref: giPageRef() });
  });

