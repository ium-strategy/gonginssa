# -*- coding: utf-8 -*-
"""content/articles/*.md (YAML frontmatter + 마크다운 본문) 을 (1) data/articles.json 엔트리와
(2) out/articles/<slug>.html 상세페이지로 빌드한다.
Decap CMS(/admin/)가 바로 이 content/articles/*.md 파일들을 커밋하므로,
담당자가 관리자 화면에서 글을 쓰고 저장하면 Netlify가 이 스크립트를 다시 실행해 사이트에 반영한다.
(과거 notion_articles.py 기반 방식은 migrate_to_md.py 로 최초 1회 이 폴더로 이관 완료.)"""
import glob
import json
import math
import os
import re
import html as htmlmod

import yaml

BASE = os.path.dirname(os.path.abspath(__file__))
CONTENT_DIR = os.path.join(BASE, "content", "articles")
OUT = os.path.join(BASE, "out")
SITE_URL = "https://gonginssa.kr"  # 2026-08-19 Netlify+가비아 도메인 연결 완료 — 실제 라이브 도메인
FALLBACK_DATE = "2026-08-19"  # frontmatter에 date가 비어 있을 때만 사용하는 안전장치

TAB_MAP = {"실무 꿀팁": ["popular", "workbook"], "레퍼런스": ["popular", "featured"]}
THUMB_MAP = {"실무 꿀팁": "assets/articles/thumb-tips.svg", "레퍼런스": "assets/articles/thumb-reference.svg"}
OG_FALLBACK_IMAGE = "assets/og-image.jpg"  # SVG 썸네일은 카카오톡·페이스북 등에서 og:image로 잘 안 뜨므로 소셜 공유용은 별도 처리

def load_articles():
    """content/articles/*.md 를 읽어 과거 ARTICLES 리스트와 같은 형태의 dict 리스트로 반환.
    파일명(확장자 제외)이 slug가 된다."""
    articles = []
    for path in sorted(glob.glob(os.path.join(CONTENT_DIR, "*.md"))):
        slug = os.path.splitext(os.path.basename(path))[0]
        raw = open(path, encoding="utf-8").read()
        m = re.match(r"^---\n(.*?)\n---\n\n?(.*)$", raw, re.DOTALL)
        if not m:
            print(f"⚠️  {path}: frontmatter(---) 형식이 아니라 건너뜀")
            continue
        front = yaml.safe_load(m.group(1)) or {}
        body = m.group(2)
        articles.append({
            "slug": slug,
            "title": (front.get("title") or "").strip(),
            "category": (front.get("category") or "실무 꿀팁").strip(),
            "hashtags": front.get("hashtags") or [],
            "reference": (front.get("reference") or "").strip(),
            "hook": (front.get("hook") or "").strip(),
            "body": body,
            "date": str(front.get("date") or FALLBACK_DATE),
            "thumb": (front.get("thumb") or "").strip(),
        })
    # 최신 발행일 우선 정렬 (동일 날짜면 파일명 순서 유지)
    articles.sort(key=lambda a: a["date"], reverse=True)
    return articles

def esc(s):
    return htmlmod.escape(s, quote=True)

def inline(s):
    """굵게/링크/백틱 처리 (문단 내부 인라인 마크업)"""
    s = esc(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
    s = re.sub(r"\[(.+?)\]\((https?://[^\s)]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', s)
    return s

YOUTUBE_BLOCK_RE = re.compile(
    r'^(?:<video\s+src=["\']([^"\']+)["\']\s*/?>(?:</video>)?'
    r'|(https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)\S+))\s*$'
)
YOUTUBE_ID_RE = re.compile(r'(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{11})')
YOUTUBE_START_RE = re.compile(r'[?&]t=(\d+)')

def youtube_embed(url):
    """유튜브 URL(또는 노션 원본의 <video src="..."> 태그)을 반응형 iframe으로 변환.
    본문에서 유튜브 링크만 단독 한 줄(블록)로 있으면 자동 임베드된다."""
    vid_m = YOUTUBE_ID_RE.search(url)
    if not vid_m:
        return f'<p>{inline(url)}</p>'
    vid = vid_m.group(1)
    start_m = YOUTUBE_START_RE.search(url)
    query = f"?start={start_m.group(1)}" if start_m else ""
    src = f"https://www.youtube-nocookie.com/embed/{vid}{query}"
    return (
        f'<div class="a-video"><iframe src="{esc(src)}" title="YouTube 영상" '
        f'loading="lazy" referrerpolicy="strict-origin-when-cross-origin" '
        f'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
        f'allowfullscreen></iframe></div>'
    )

IMAGE_BLOCK_RE = re.compile(r'^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$')

def image_embed(alt, src, caption=None):
    """Decap CMS 이미지 업로드가 만드는 표준 마크다운 이미지(![alt](url))를
    <figure>로 변환. alt 텍스트가 있으면 캡션으로도 표시한다."""
    cap = caption or alt
    cap_html = f'<figcaption>{inline(cap)}</figcaption>' if cap else ""
    return f'<figure class="a-figure"><img src="{esc(src)}" alt="{esc(alt)}" loading="lazy">{cap_html}</figure>'

def render_body(raw):
    blocks = [b.strip() for b in raw.strip().split("\n\n") if b.strip()]
    out = []
    for b in blocks:
        yt_m = YOUTUBE_BLOCK_RE.match(b)
        img_m = IMAGE_BLOCK_RE.match(b)
        if yt_m:
            out.append(youtube_embed(yt_m.group(1) or yt_m.group(2)))
        elif img_m:
            out.append(image_embed(img_m.group(1), img_m.group(2), img_m.group(3)))
        elif b.startswith("## "):
            out.append(f"<h2>{inline(b[3:].strip())}</h2>")
        elif b.startswith("### "):
            out.append(f"<h3>{inline(b[4:].strip())}</h3>")
        elif b.startswith("<table"):
            # 이미 HTML 테이블 — bold(**)만 처리하고 그대로 통과
            t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", b)
            out.append(f'<div class="a-table-wrap">{t}</div>')
        elif b.startswith("PICK:"):
            out.append(f'<div class="a-pick"><span class="a-pick-label">공인싸 실무 PICK</span><p>{inline(b[5:].strip())}</p></div>')
        elif b.startswith("CHECKLIST:"):
            rest = b[len("CHECKLIST:"):].strip()
            lines = rest.split("\n")
            title = lines[0].strip()
            items = [l.strip("- ").strip() for l in lines[1:] if l.strip().startswith("-")]
            lis = "".join(f"<li>{inline(i)}</li>" for i in items)
            out.append(f'<div class="a-checklist"><p class="a-checklist-title">{inline(title)}</p><ul>{lis}</ul></div>')
        elif b.startswith(">"):
            lines = [l.lstrip(">").strip() for l in b.split("\n")]
            out.append(f'<blockquote class="a-quote">{"<br>".join(inline(l) for l in lines if l)}</blockquote>')
        elif re.match(r"^-\s", b) or "\n- " in b:
            items = [l.strip("- ").strip() for l in b.split("\n") if l.strip().startswith("-")]
            lis = "".join(f"<li>{inline(i)}</li>" for i in items)
            out.append(f"<ul>{lis}</ul>")
        else:
            out.append(f"<p>{inline(b)}</p>")
    return "\n".join(out)

def read_minutes(hook, body):
    chars = len(hook) + len(re.sub(r"[#*`>\-\[\]()]", "", body))
    return max(1, math.ceil(chars / 500))

def make_excerpt(hook):
    s = hook.strip()
    # 첫 1~2문장만 취해 60~70자 내로
    parts = re.split(r"(?<=[.!?])\s+", s)
    ex = parts[0]
    if len(ex) < 40 and len(parts) > 1:
        ex = ex + " " + parts[1]
    if len(ex) > 78:
        ex = ex[:76].rstrip() + "…"
    return ex

ARTICLE_TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — 공인싸</title>
<meta name="description" content="{excerpt}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="공인싸">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{excerpt}">
<meta property="og:image" content="{site_url}/{thumb}">
<meta property="og:url" content="{canonical}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{excerpt}">
<meta name="twitter:image" content="{site_url}/{thumb}">
<link rel="icon" type="image/png" href="../assets/logo-mark.png">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://cdn.jsdelivr.net/gh/sun-typeface/SUITE@2/fonts/static/woff2/SUITE.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/static/pretendard.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/site.css">
<link rel="stylesheet" href="../assets/article.css">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"Article","headline":{title_json},"description":{excerpt_json},"datePublished":"{date}","author":{{"@type":"Organization","name":"이음전략소"}},"publisher":{{"@type":"Organization","name":"공인싸"}}}}
</script>
</head>
<body data-article-id="{slug}">

<a class="skip-link" href="#top">본문 바로가기</a>

<header class="site">
  <nav class="nav nav-minimal">
    <a class="brand" href="../index.html"><img src="../assets/logo.png" alt="공인싸 — PUBLIC PR INSIGHTS" class="brand-logo"></a>
  </nav>
</header>

<main id="top">
  <article class="a-wrap">
    <nav class="a-breadcrumb"><a href="../index.html">홈</a><span>/</span><a href="../articles.html?category={category_key}">{category}</a></nav>
    <p class="a-category">{category}</p>
    <h1 class="a-title">{title}</h1>
    <div class="a-meta"><span>{date}</span><span class="sep">|</span><span>{read_time}분 읽기</span></div>
    <p class="a-hook">{hook}</p>
    <div class="a-body">
{body_html}
    </div>
    {reference_html}
    <div class="a-tags">{tags_html}</div>
  </article>

  <section class="block reveal a-related">
    <div class="wrap">
      <div class="head"><div><span class="eb">Related</span><h2>같이 보면 좋은 아티클</h2></div></div>
      <div class="tgrid" id="relatedGrid"></div>
    </div>
  </section>

  <section class="block reveal" id="newsletter">
    <div class="wrap">
      <div class="subscribe subscribe-compact">
        <div class="sub-copy">
          <span class="freq-pill">무료 구독 · 격주 화요일 발행</span>
          <h2><b class="pname">인싸레터</b>로 실무 팁을 이어서 받아보세요.</h2>
        </div>
        <a class="btn btn-primary" href="../index.html#newsletter">뉴스레터 구독하기 →</a>
      </div>
    </div>
  </section>

  <section class="closing reveal" id="about">
    <svg class="closing-orbit" viewBox="0 0 400 400" aria-hidden="true">
      <circle cx="200" cy="200" r="55" fill="none" stroke="#2C76FF" stroke-opacity=".28"/>
      <circle cx="200" cy="200" r="100" fill="none" stroke="#2C76FF" stroke-opacity=".2"/>
      <circle cx="200" cy="200" r="150" fill="none" stroke="#2C76FF" stroke-opacity=".13"/>
      <circle cx="200" cy="200" r="195" fill="none" stroke="#2C76FF" stroke-opacity=".07"/>
      <circle cx="285" cy="145" r="4" fill="#4D8BFF"/>
      <circle cx="108" cy="255" r="3" fill="#4D8BFF" fill-opacity=".7"/>
      <circle cx="235" cy="325" r="3" fill="#FF7A45" fill-opacity=".8"/>
      <circle cx="120" cy="130" r="2.5" fill="#4D8BFF" fill-opacity=".6"/>
    </svg>
    <div class="wrap closing-inner">
      <span class="eb-light">공공 홍보·광고 전략 파트너, 이음전략소</span>
      <h2><span class="lead">실무 부담은 덜고 성과는 분명하게.</span><span class="sub">정책 기반의 전략과 실행으로 공공 홍보 전반을 설계합니다.</span></h2>
      <div class="closing-cta-group">
        <button type="button" class="btn btn-primary js-open-consult">무료 상담 신청 →</button>
        <a class="btn btn-ghost-dark" href="https://www.iumist.com/RT1kT" target="_blank" rel="noopener">포트폴리오 보기</a>
      </div>
    </div>
  </section>
</main>

<footer class="site" id="contact">
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <a class="brand" href="../index.html"><img src="../assets/logo.png" alt="공인싸 — PUBLIC PR INSIGHTS" class="brand-logo"></a>
      <p>공공기관 홍보 담당자를 위한 인사이트 미디어.<br>이음전략소가 만들고 운영합니다.</p>
    </div>
    <div class="foot-col">
      <h5>문의</h5>
      <button type="button" class="foot-link-btn js-open-consult">상담 신청 →</button>
      <a href="../privacy.html">개인정보처리방침</a>
      <a href="mailto:contact@iumist.com">광고·협찬 문의</a>
    </div>
  </div>
  <div class="wrap foot-bottom">
    <span>© 2026 이음전략소. All rights reserved. <button type="button" class="foot-bottom-link js-open-bizinfo">사업자정보</button></span>
    <span>담당 이메일 letter@gonginssa.kr · 영업일 기준 1~2일 이내 응답</span>
  </div>
</footer>

<div class="modal-overlay" id="consultOverlay" hidden>
  <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="consultTitle">
    <button type="button" class="modal-close" id="consultCloseBtn" aria-label="닫기">✕</button>
    <h2 id="consultTitle">상담 신청</h2>
    <p class="modal-sub">공공 홍보 실무 고민, 이음전략소가 함께 풀어드립니다. 연락처를 남기시면 영업일 기준 1~2일 이내 답변드려요.</p>
    <form id="consultForm" name="consult" method="POST" data-netlify="true" netlify-honeypot="bot-field">
      <input type="hidden" name="form-name" value="consult">
      <p class="hidden" hidden><label>이 필드는 비워두세요: <input name="bot-field"></label></p>
      <div class="modal-fields">
        <label class="sr-only" for="f-consult-name">이름 / 소속</label>
        <input type="text" id="f-consult-name" name="name" required placeholder="이름 / 소속 *">
        <label class="sr-only" for="f-consult-email">이메일</label>
        <input type="email" id="f-consult-email" name="email" required placeholder="이메일 *">
        <label class="sr-only" for="f-consult-phone">연락처</label>
        <input type="tel" id="f-consult-phone" name="phone" required placeholder="연락처 (010-0000-0000) *">
        <label class="sr-only" for="f-consult-message">상담 내용</label>
        <textarea id="f-consult-message" name="message" rows="3" placeholder="상담받고 싶은 내용을 간단히 적어주세요 (선택)"></textarea>
      </div>
      <label class="agree" style="margin:12px 0">
        <input type="checkbox" name="privacy_agree" required>
        <span>[필수] 개인정보 수집 및 이용에 동의합니다. (수집 항목: 이름, 이메일, 연락처 · 목적: 상담 응대 · 보유 기간: 상담 종료 후 6개월)</span>
      </label>
      <button type="submit" class="btn btn-primary" style="width:100%">상담 신청하기</button>
      <p class="status" id="consultStatus">✓ 상담 신청이 접수되었습니다. 영업일 기준 1~2일 이내 연락드릴게요.</p>
    </form>
  </div>
</div>

<div class="modal-overlay" id="bizInfoOverlay" hidden>
  <div class="modal-box biz-info-box" role="dialog" aria-modal="true" aria-labelledby="bizInfoTitle">
    <button type="button" class="modal-close" id="bizInfoCloseBtn" aria-label="닫기">✕</button>
    <h2 id="bizInfoTitle">사업자정보</h2>
    <dl class="biz-info-list">
      <div><dt>상호명</dt><dd>주식회사 이음전략소</dd></div>
      <div><dt>대표자</dt><dd>한주은</dd></div>
      <div><dt>사업자등록번호</dt><dd>546-88-03350</dd></div>
      <div><dt>주소</dt><dd>서울특별시 서초구 바우뫼로7길 8, 801호</dd></div>
      <div><dt>이메일</dt><dd><a href="mailto:contact@iumist.co.kr">contact@iumist.co.kr</a></dd></div>
    </dl>
  </div>
</div>

<div class="float-bar" id="floatBar">
  <div class="inner">
    <span class="mark"><img src="../assets/logo-mark.png" alt=""></span>
    <div class="msg"><b>2주에 한 번, 실무 꿀팁이 메일함으로 쏙!<span class="msg-cta">무료로 받아보세요.</span></b></div>
    <a class="btn" href="../index.html#newsletter">지금 구독하기</a>
    <button class="close" id="floatBarClose" aria-label="닫기">✕</button>
  </div>
</div>

<script src="../data/config.js"></script>
<script src="../assets/article.js"></script>
<script src="../assets/ui.js"></script>
</body>
</html>
"""

def build():
    os.makedirs(f"{OUT}/articles", exist_ok=True)
    os.makedirs(f"{OUT}/data", exist_ok=True)
    articles = load_articles()
    entries = []
    for a in articles:
        excerpt = make_excerpt(a["hook"])
        body_html = render_body(a["body"])
        minutes = read_minutes(a["hook"], a["body"])
        tags = list(a["hashtags"])
        if not tags:
            tags = [a["category"]]
        for brand_tag in ("이음전략소", "공인싸"):  # 모든 아티클 공통 브랜드 해시태그
            if brand_tag not in tags:
                tags.append(brand_tag)
        tabs = TAB_MAP.get(a["category"], ["popular"])
        thumb = a["thumb"] or THUMB_MAP.get(a["category"], THUMB_MAP["실무 꿀팁"])
        # 실제 사진(thumb)이 있으면 그걸, 없으면(SVG 기본 썸네일) 소셜 공유용 대표 이미지로 대체
        # (site_url + "/" + og_thumb 로 합치므로 앞의 "/"는 제거해서 이중 슬래시 방지)
        og_thumb = (a["thumb"] or OG_FALLBACK_IMAGE).lstrip("/")
        date = a["date"]
        url = f'articles/{a["slug"]}.html'
        # config.js 의 기존 카테고리 배지 taxonomy(trend/case/practical/resource/data) 재사용
        category_key = "practical" if a["category"] == "실무 꿀팁" else "case"

        entries.append({
            "id": a["slug"],
            "category": category_key,
            "title": a["title"],
            "excerpt": excerpt,
            "date": date,
            "readTime": minutes,
            "thumb": thumb,
            "tabs": tabs,
            "tags": tags,
            "url": url,
        })

        reference_html = ""
        if a["reference"]:
            reference_html = f'<p class="a-ref">참고 자료: <a href="{esc(a["reference"])}" target="_blank" rel="noopener">{esc(a["reference"])}</a></p>'
        tags_html = "".join(f'<span class="a-tag">#{esc(t)}</span>' for t in tags)

        html_out = ARTICLE_TEMPLATE.format(
            title=esc(a["title"]),
            title_json=json.dumps(a["title"], ensure_ascii=False),
            excerpt=esc(excerpt),
            excerpt_json=json.dumps(excerpt, ensure_ascii=False),
            canonical=f'{SITE_URL}/{url}',
            site_url=SITE_URL,
            thumb=og_thumb,
            date=date,
            category=esc(a["category"]),
            read_time=minutes,
            hook=inline(a["hook"]),
            body_html=body_html,
            reference_html=reference_html,
            tags_html=tags_html,
            slug=a["slug"],
            category_key=category_key,
        )
        with open(f'{OUT}/articles/{a["slug"]}.html', "w", encoding="utf-8") as f:
            f.write(html_out)

    with open(f"{OUT}/data/articles.json", "w", encoding="utf-8") as f:
        json.dump({"articles": entries}, f, ensure_ascii=False, indent=2)

    # sitemap.xml — 홈, 개인정보처리방침 + 전체 아티클 (robots.txt 가 참조하는 파일)
    today = entries[0]["date"] if entries else FALLBACK_DATE
    sitemap_urls = [
        (f"{SITE_URL}/", "1.0", "weekly", today),
        (f"{SITE_URL}/articles.html", "0.8", "weekly", today),
        (f"{SITE_URL}/privacy.html", "0.3", "yearly", today),
    ] + [
        (f'{SITE_URL}/{e["url"]}', "0.7", "monthly", e["date"]) for e in entries
    ]
    sitemap_xml = ['<?xml version="1.0" encoding="UTF-8"?>',
                   '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, priority, changefreq, lastmod in sitemap_urls:
        sitemap_xml.append(
            f"  <url><loc>{esc(loc)}</loc><lastmod>{esc(lastmod)}</lastmod>"
            f"<changefreq>{changefreq}</changefreq><priority>{priority}</priority></url>"
        )
    sitemap_xml.append("</urlset>")
    with open(f"{OUT}/sitemap.xml", "w", encoding="utf-8") as f:
        f.write("\n".join(sitemap_xml) + "\n")

    print(f"built {len(entries)} articles + sitemap.xml ({len(sitemap_urls)} urls)")

if __name__ == "__main__":
    build()
