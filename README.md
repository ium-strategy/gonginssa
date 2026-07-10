# 공인싸 (GONGINSSA)

공공기관 홍보 담당자를 위한 인사이트 미디어 + 공보레터 아카이브 데모.
발행: **이음전략소**. 순수 HTML/CSS/JS(빌드 도구 없음) + 더미 데이터.

## 구조

```
gonginssa/
├── index.html          홈 (관보풍 편집 레이아웃)
├── admin.html          관리자 — 게시글 작성/편집 → articles.json 다운로드
├── assets/
│   ├── site.css        공통 스타일 (라이트/다크)
│   ├── ui.js           테마 토글·토스트·구독 폼
│   └── render.js       홈 렌더링
├── data/
│   ├── config.js       사이트·카테고리·시리즈·채용 (고정 설정)
│   └── articles.json   아티클 + 공보레터 데이터 ← 관리자가 편집하는 파일
└── .nojekyll           GitHub Pages가 _ 폴더 등을 그대로 서빙하도록
```

## 로컬 실행

`fetch`로 `data/articles.json`을 읽기 때문에 **로컬 서버**로 열어야 합니다 (파일 더블클릭 X).

```bash
cd gonginssa
python -m http.server 4173
# http://localhost:4173/ 접속
```

## 게시글 관리 흐름

1. `admin.html`에서 글 작성·편집·삭제 (브라우저에 자동 임시저장 → 홈에 즉시 미리보기)
2. **`articles.json 저장 ↓`** 버튼으로 파일 내려받기
3. 내려받은 파일을 `data/articles.json`에 덮어쓰기
4. `git commit` & `push` → GitHub Pages 자동 반영

> 관리자 데이터는 브라우저 localStorage 미리보기 + JSON 파일이 최종본입니다. 서버·로그인 없음(정적 데모).

## 배포 (GitHub Pages)

저장소 Settings → Pages → Source를 `main` 브랜치로 지정하면
`https://<username>.github.io/<repo>/gonginssa/` 로 공개됩니다.
