/* ===========================================================
 * 공인싸 (GONGINSSA) — 고정 설정
 * 카테고리·탭·트렌드 키워드는 여기서, 아티클은 data/articles.json 에서.
 * =========================================================== */
window.GI_CONFIG = {
  site: {
    name: "공인싸",
    nameEn: "GONGINSSA",
    newsletter: "인싸레터",
    company: "이음전략소",
    tagline: "공공기관 홍보 담당자가 일잘러가 되는 가장 빠른 길",
    description:
      "공공기관·지자체 홍보 실무자를 위한 트렌드·우수사례·실무 노하우를 격주로 정리합니다.",
  },
  // 아티클 카테고리 — 2개 체계. 구 5개 체계(트렌드/사례/실무/자료/데이터)는 폐기됨.
  categories: {
    practical: { name: "실무 꿀팁" },
    case: { name: "레퍼런스" },
  },
  // 해시태그 사전 — 고정 어휘 8개.
  // 격주 1편 발행 구조에서 태그를 늘리면 태그당 1편짜리가 양산된다.
  // 새 태그 추가는 분기 단위로 검토한다.
  tagDictionary: ["SNS", "캠페인", "공모전", "보도자료", "영상", "데이터", "저작권", "AI"],
  // 아티클 탭 (Articles 섹션 상단 3개 탭) — 순서 유지
  tabs: [
    { key: "popular", label: "인기픽", title: "요즘 다들 이거부터 읽더라고요" },
    { key: "workbook", label: "실무 꿀팁", title: "일잘러로 거듭나는 법!" },
    { key: "featured", label: "레퍼런스", title: "잘하는 곳들은 뭐가 다를까?" },
  ],
  // 트렌딩 키워드 클라우드 (숫자는 언급량 — 수동 큐레이션)
  trendingKeywords: [
    { name: "SNS", count: 18 },
    { name: "숏폼", count: 11 },
    { name: "카드뉴스", count: 6 },
    { name: "지자체", count: 15 },
    { name: "보도자료", count: 9 },
    { name: "예산", count: 5 },
    { name: "유튜브", count: 14 },
    { name: "인스타그램", count: 9 },
    { name: "공기업", count: 5 },
    { name: "캠페인", count: 8 },
    { name: "브랜딩", count: 4 },
    { name: "옵트인", count: 3 },
  ],
};
