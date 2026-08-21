# 공인싸 (GONGINSSA)

공공기관 홍보 담당자를 위한 인사이트 미디어. 이음전략소가 만들고 운영합니다.

## 구조

```
netlify.toml          ← 배포 빌드 설정 (build 명령 + publish 디렉토리)
requirements.txt       ← 빌드에 필요한 파이썬 패키지(PyYAML)
build_articles.py       ← content/articles/*.md → out/articles/*.html + data/articles.json + sitemap.xml 생성
content/articles/*.md   ← 아티클 원본(YAML frontmatter + 마크다운 본문). Decap CMS(/admin/)가 이 폴더를 직접 커밋한다.
out/                    ← 실제 배포되는 사이트. index.html/assets/admin/ 등은 직접 관리하는 정적 파일이고,
                          articles/*.html · data/articles.json · sitemap.xml 은 빌드 시 자동 생성된다.
notion_articles.py       ← 과거 노션 발행 데이터(레거시, 참고용) — migrate_to_md.py로 content/articles/로 이관 완료
migrate_to_md.py         ← 1회성 마이그레이션 스크립트(더 이상 실행할 필요 없음)
```

## 글쓰기

`gonginssa.kr/admin/` 에서 로그인 후 직접 작성 (Decap CMS). 이미지 업로드, 유튜브 링크 자동 임베드 모두 여기서 됩니다.

로컬에서 빌드 확인하려면:

```
pip install -r requirements.txt
python3 build_articles.py
```

## 배포

Netlify가 이 저장소를 감시하며, `main` 브랜치에 커밋이 올라오면(Decap CMS 저장 포함) `netlify.toml`의 빌드 명령을 실행해 자동 재배포합니다.
