# 공인싸 (GONGINSSA)

공공기관 홍보 담당자를 위한 인사이트 미디어. 이음전략소가 만들고 운영합니다.

## 구조

```
requirements.txt       ← 빌드에 필요한 파이썬 패키지(PyYAML, Pillow, numpy)
build_articles.py       ← content/articles/*.md → out/articles/*.html + data/articles.json + sitemap.xml 생성
thumb_gen.py             ← 썸네일 이미지를 안 올린 아티클의 자동 썸네일(브랜드 그라데이션+제목+아이콘) 생성
build_assets/            ← thumb_gen.py 전용 재료(폰트 TTF, 아이콘 PNG 드롭인 자리) — out/에는 안 실림
content/articles/*.md   ← 아티클 원본(YAML frontmatter + 마크다운 본문). Decap CMS(/admin/)가 이 폴더를 직접 커밋한다.
functions/               ← Cloudflare Pages Functions (구독·상담 API, Decap CMS GitHub OAuth)
out/                    ← 실제 배포되는 사이트. index.html/assets/admin/ 등은 직접 관리하는 정적 파일이고,
                          articles/*.html · data/articles.json · sitemap.xml · assets/uploads/auto/*.png(자동 썸네일)
                          은 빌드 시 자동 생성된다.
notion_articles.py       ← 과거 노션 발행 데이터(레거시, 참고용) — migrate_to_md.py로 content/articles/로 이관 완료
migrate_to_md.py         ← 1회성 마이그레이션 스크립트(더 이상 실행할 필요 없음)
```

## 썸네일 자동 생성

`gonginssa.kr/admin/`에서 글을 쓸 때 "썸네일 이미지"를 비워두고 저장하면, 빌드 시점에
제목·카테고리로 브랜드 템플릿 썸네일(그라데이션 배경 + 제목 + 카테고리 태그 + 아이콘 + 로고,
1280×720)이 자동 생성된다(`thumb_gen.py`). 아이콘은 제목·해시태그로 자동 판별되며, "자동 썸네일
아이콘" 필드로 직접 지정할 수도 있다. 직접 사진을 올리면(기존 방식) 그 이미지가 우선 사용된다.

아이콘은 지금은 `thumb_gen.py`에 Pillow 도형으로 그린 기본 아이콘 세트다. 실사진·3D 렌더 아이콘을
구하면 `build_assets/thumb_icons/<key>.png`(키 목록은 `thumb_gen.ICON_LIBRARY` 참고)로 넣기만 하면
코드 수정 없이 그 파일이 우선 사용된다.

## 글쓰기

`gonginssa.kr/admin/` 에서 로그인 후 직접 작성 (Decap CMS). 이미지 업로드, 유튜브 링크 자동 임베드 모두 여기서 됩니다.

로컬에서 빌드 확인하려면:

```
pip install -r requirements.txt
python3 build_articles.py
```

## 배포

Cloudflare Pages가 이 저장소를 감시하며, `main` 브랜치에 커밋이 올라오면(Decap CMS 저장 포함) 자동으로 재배포합니다. 구독·상담 API 등 서버리스 함수는 `functions/`에서 관리하며, 관련 환경변수는 Cloudflare 대시보드 > Pages 프로젝트 > Settings > Environment variables에 등록합니다(값을 바꾸면 재배포해야 반영됩니다).
