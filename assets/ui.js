/* 공통 UI: 테마 토글 · 토스트 · 구독 폼 · 데모 링크 안내 */
(function () {
  // 저장된 테마 복원
  const saved = localStorage.getItem("gi_theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);

  window.giToggleTheme = function () {
    const cur = document.documentElement.getAttribute("data-theme");
    const isDark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("gi_theme", next);
  };

  let tt;
  window.giToast = function (msg) {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 2200);
  };

  window.giSubscribe = function (e) {
    e.preventDefault();
    window.giToast("공보레터 구독이 완료되었습니다. (데모)");
    e.target.reset();
    return false;
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-demo]");
    if (a) { e.preventDefault(); window.giToast("데모입니다 — 상세 페이지는 준비 중이에요."); }
  });
})();
