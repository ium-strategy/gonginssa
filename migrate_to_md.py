# -*- coding: utf-8 -*-
"""1회성 마이그레이션: notion_articles.py 의 ARTICLES 리스트를
content/articles/<slug>.md (YAML frontmatter + 마크다운 본문) 파일들로 변환한다.
이후 build_articles.py 는 이 md 파일들을 데이터 소스로 사용하며,
Decap CMS도 이 폴더(content/articles/)를 직접 읽고 쓴다."""
import os
import yaml

from notion_articles import ARTICLES

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "content", "articles")
os.makedirs(CONTENT_DIR, exist_ok=True)

PUBLISH_DATE = "2026-08-19"

for a in ARTICLES:
    front = {
        "title": a["title"],
        "category": a["category"],
        "hashtags": a["hashtags"],
        "reference": a["reference"],
        "hook": a["hook"],
        "date": PUBLISH_DATE,
        "thumb": "",  # 비워두면 카테고리 기본 썸네일(SVG) 사용 — 업로드하면 그 이미지 사용
    }
    fm = yaml.safe_dump(front, allow_unicode=True, sort_keys=False, default_flow_style=False)
    body = a["body"].strip() + "\n"
    out_path = os.path.join(CONTENT_DIR, f'{a["slug"]}.md')
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"---\n{fm}---\n\n{body}")

print(f"migrated {len(ARTICLES)} articles to {CONTENT_DIR}")
