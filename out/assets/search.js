/* ===========================================================
 * 공인싸 (GONGINSSA) — 아티클 키워드 검색 (클라이언트 사이드)
 *
 * 별도 검색 인덱스 파일을 만들지 않는다. build_articles.py가 빌드 시
 * 생성하는 data/articles.json(제목·요약·카테고리·태그·URL 포함)을 그대로 쓴다.
 * → 동기화할 파일이 하나 더 늘지 않아 운영 부담이 없다.
 *
 * 이 파일은 "헤더 검색창"만 담당한다. 실제 결과 렌더링은 articles.html에서
 * archive.js가 카테고리·태그 필터와 함께 처리한다(카드 마크업은 render.js의
 * window.GI.cardHTML 재사용 — 홈/목록과 항상 같은 디자인).
 * =========================================================== */
(function () {
  // 아티클 상세(/articles/xxx.html)에서는 한 단계 위로 올라가야 articles.html에 닿는다.
  function basePrefix() {
    return /\/articles\/[^/]*$/.test(location.pathname) ? "../" : "";
  }

  function boot() {
    const form = document.getElementById("site-search-form");
    if (!form) return;
    const input = document.getElementById("site-search-input");

    // 검색 결과 페이지로 돌아왔을 때 입력값을 그대로 보여준다.
    const q = new URLSearchParams(location.search).get("q");
    if (input && q) input.value = q;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const term = ((input && input.value) || "").trim();
      // 빈 검색어로 제출하면 필터를 걷어낸 전체 목록으로 보낸다.
      const url = basePrefix() + "articles.html" + (term ? "?q=" + encodeURIComponent(term) : "");
      location.href = url;
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
