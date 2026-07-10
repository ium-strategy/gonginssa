/* ===========================================================
 * 공인싸 (GONGINSSA) — 고정 설정
 * 카테고리·시리즈·채용은 여기서, 아티클은 data/articles.json 에서.
 * =========================================================== */
window.GI_CONFIG = {
  site: {
    name: "공인싸",
    nameEn: "GONGINSSA",
    newsletter: "공보레터",
    company: "이음전략소",
    tagline: "공공기관 홍보 담당자가 일잘러가 되는 가장 빠른 길",
    description:
      "공공기관·지자체 홍보 실무자를 위한 트렌드·우수사례·실무 노하우를 격주로 정리합니다.",
  },
  // 카테고리 = 공보레터 코너 (순서 유지)
  categories: {
    trend: { name: "트렌드", corner: "인싸레이더", color: "#7c3aed", emoji: "📡", desc: "공공 홍보의 흐름을 가장 먼저. SNS·숏폼·정책 트렌드를 짚습니다." },
    case: { name: "사례", corner: "캠페인 해부대", color: "#2563eb", emoji: "🔬", desc: "잘된 캠페인은 이유가 있습니다. 지자체·중앙부처·공기업 사례를 해부합니다." },
    practical: { name: "실무", corner: "실무 치트키", color: "#0a8f5b", emoji: "🛠️", desc: "보도자료·카드뉴스·영상·예산까지, 바로 쓰는 실무 노하우." },
    resource: { name: "자료", corner: "연장통", color: "#d97706", emoji: "🧰", desc: "일 잘하는 담당자의 도구함. 무료 툴·폰트·이미지·공개데이터." },
    data: { name: "데이터", corner: "숫자 한 입", color: "#dc2626", emoji: "📊", desc: "숫자로 읽는 공공 홍보. 통계와 리포트를 한 입 크기로." },
  },
  categoryOrder: ["trend", "case", "practical", "resource", "data"],
  // 연재 시리즈
  series: {
    "sns-master": { title: "공공기관 SNS 완전정복", desc: "채널 개설부터 운영·성과 분석까지, 단계별 연재." },
  },
  // 채용정보 (공공 홍보 큐레이션)
  jobs: [
    { org: "○○광역시청 대변인실", title: "뉴미디어 홍보 주무관 (공무직)", type: "공공기관", deadline: "~06.20", location: "대전" },
    { org: "한국○○공단", title: "홍보팀 콘텐츠 기획 담당 (정규직)", type: "공기업", deadline: "~06.15", location: "서울" },
    { org: "이음전략소", title: "공공 홍보 캠페인 AE (경력)", type: "대행사", deadline: "상시채용", location: "서울" },
  ],
};
