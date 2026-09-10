# -*- coding: utf-8 -*-
"""content/articles/*.md (YAML frontmatter + 마크다운 본문) 을 (1) data/articles.json 엔트리와
(2) out/articles/<slug>.html 상세페이지로 빌드한다.
Decap CMS(/admin/)가 바로 이 content/articles/*.md 파일들을 커밋하므로,
담당자가 관리자 화면에서 글을 쓰고 저장하면(GitHub 커밋) Cloudflare Pages 빌드가 이 스크립트를 다시 실행해 사이트에 반영한다.
(과거 notion_articles.py 기반 방식은 migrate_to_md.py 로 최초 1회 이 폴더로 이관 완료.)"""
import glob
import hashlib
import json
import math
import os
import re
import html as htmlmod

import yaml
from urllib.parse import quote

import thumb_gen  # 썸네일 미지정 시 제목·카테고리로 자동 생성(thumb_gen.py 참고)

BASE = os.path.dirname(os.path.abspath(__file__))
CONTENT_DIR = os.path.join(BASE, "content", "articles")
OUT = os.path.join(BASE, "out")
SITE_URL = "https://gonginssa.kr"  # 2026-08-19 Netlify+가비아 도메인 연결 완료 — 실제 라이브 도메인

def asset_ver(rel_path):
    """out/ 기준 상대경로 정적 자산(css/js)의 내용 해시 앞 8자리.
    CSS·JS를 고쳐도 브라우저·CDN이 예전 파일을 계속 캐싱해서 새 스타일이나
    스크립트가 반영 안 되는 문제(260911 공유 버튼 드롭다운이 안 보이던 사고
    원인)를 막으려고, 링크에 ?v=<해시>를 붙인다. 파일 내용이 바뀌면 URL도
    자동으로 바뀌어 캐시가 강제로 무효화된다."""
    p = os.path.join(OUT, rel_path)
    try:
        with open(p, "rb") as f:
            return hashlib.sha1(f.read()).hexdigest()[:8]
    except FileNotFoundError:
        return "0"
FALLBACK_DATE = "2026-08-19"  # frontmatter에 date가 비어 있을 때만 사용하는 안전장치

TAB_MAP = {"실무 꿀팁": ["popular", "workbook"], "레퍼런스": ["popular", "featured"]}
BRAND_TAGS = ["이음전략소", "공인싸"]  # 전 아티클 공통 노출 — 주제 태그와 별개
THUMB_MAP = {"실무 꿀팁": "assets/articles/thumb-tips.svg", "레퍼런스": "assets/articles/thumb-reference.svg"}
CATEGORY_LABEL = {"practical": "실무 꿀팁", "case": "레퍼런스"}  # entries의 category_key → 표시용 한글 라벨
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
            # 비어있으면 thumb_gen이 제목·카테고리로 자동 생성한다. icon은 그때 쓸 아이콘을
            # 직접 지정하고 싶을 때만(선택) — 비우면 제목·태그로 자동 판별.
            "icon": (front.get("icon") or "").strip(),
            # 아래 세 값은 원래 hook/본문/카테고리에서 자동 계산됐지만(excerpt는 hook 앞부분,
            # readTime은 글자 수, tabs는 카테고리→TAB_MAP), admin.html에서 직접 지정한 값이
            # frontmatter에 있으면 그 값을 우선한다. 비어 있으면 기존처럼 자동 계산으로 대체.
            "excerpt": (front.get("excerpt") or "").strip(),
            "readTime": front.get("readTime") or None,
            "tabs": front.get("tabs") or None,
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
        elif b.startswith("REFS:"):
            # 참고 자료 목록을 박스로 묶어서 보여준다 (- [문구](URL) 형태의 줄들)
            rest = b[len("REFS:"):].strip()
            lines = rest.split("\n")
            title = lines[0].strip()
            items = [l.strip("- ").strip() for l in lines[1:] if l.strip().startswith("-")]
            lis = "".join(f"<li>{inline(i)}</li>" for i in items)
            out.append(f'<div class="a-refs"><p class="a-refs-title">{inline(title)}</p><ul>{lis}</ul></div>')
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

def load_tag_dictionary():
    """out/data/config.js의 tagDictionary 배열을 그대로 읽어온다 — 홈·목록 SSR 카드가
    쓰는 사전을 여기 따로 하드코딩하면 config.js를 고칠 때 둘이 어긋날 수 있어서,
    실제 배포되는 config.js를 파싱해 단일 출처로 쓴다."""
    cfg_path = os.path.join(OUT, "data", "config.js")
    if not os.path.exists(cfg_path):
        return []
    text = open(cfg_path, encoding="utf-8").read()
    m = re.search(r"tagDictionary:\s*\[(.*?)\]", text, re.DOTALL)
    if not m:
        return []
    return re.findall(r'"([^"]*)"', m.group(1))

TIME_ICON = ('<svg viewBox="0 0 16 16" fill="none" style="color:var(--text-body)">'
             '<circle cx="8" cy="8" r="6.3" stroke="currentColor" stroke-width="1.3"/>'
             '<path d="M8 4.6V8L10.2 9.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>')

def card_html(e, featured):
    """assets/render.js의 cardHTML()과 동일한 마크업 — 홈·목록 정적 SSR 카드에 쓴다.
    두 곳이 어긋나면 자바스크립트가 로드된 뒤(진짜 방문자) 모습과 그 전(크롤러·초기 페인트)
    모습이 달라지므로, 여기 수정할 땐 render.js도 같이 확인할 것."""
    cat_label = CATEGORY_LABEL.get(e["category"], e["category"])
    meta_line = (f'<span class="meta-line"><span>{esc(cat_label)}</span><span class="sep">|</span>'
                 f'<span class="time">{TIME_ICON}{e["readTime"]}분</span></span>')
    href = esc(e["url"])
    if featured:
        return (f'<a class="tcard-featured" href="{href}">'
                f'<div class="thumb"><img src="{esc(e["thumb"])}" alt=""></div>'
                f'<div class="info"><h3>{esc(e["title"])}</h3><p class="summary">{esc(e["excerpt"])}</p>{meta_line}</div>'
                f'</a>')
    return (f'<a class="tcard" href="{href}">'
            f'<div class="thumb"><img src="{esc(e["thumb"])}" alt=""></div>'
            f'<div class="info"><h4>{esc(e["title"])}</h4>{meta_line}</div>'
            f'</a>')

def render_tab_panel_html(tab_key, entries):
    """render.js의 renderTabPanel()과 동일한 필터·정렬(발행일 내림차순), 첫 카드만 featured."""
    lst = sorted((e for e in entries if tab_key in (e["tabs"] or [])), key=lambda e: e["date"], reverse=True)
    if not lst:
        return '<p class="sec-sub" style="padding:20px 0">아직 이 탭에 담긴 아티클이 없습니다.</p>'
    return "".join(card_html(e, i == 0) for i, e in enumerate(lst))

def _topic_counts(entries, tag_dict):
    counts = {}
    for e in entries:
        for t in e["tags"]:
            counts[t] = counts.get(t, 0) + 1
    return sorted((t for t in tag_dict if counts.get(t)), key=lambda t: (-counts[t], t)), counts

def render_topic_cloud_html(entries, tag_dict):
    """render.js의 홈 태그클라우드와 동일 — 실제 집계, 건수 내림차순."""
    topics, counts = _topic_counts(entries, tag_dict)
    return "".join(
        f'<a class="tag" href="articles.html?tag={quote(t)}" data-tag="{esc(t)}">{esc(t)}<span class="cnt">{counts[t]}</span></a>'
        for t in topics
    )

def render_category_tabs_html(entries):
    """archive.js의 renderTabs() — 전체보기 + 실제 등장한 카테고리, 등장 순서·건수 그대로."""
    present, seen = [], set()
    for e in entries:
        if e["category"] not in seen:
            seen.add(e["category"])
            present.append(e["category"])
    out = []
    for i, k in enumerate(["all"] + present):
        count = len(entries) if k == "all" else sum(1 for e in entries if e["category"] == k)
        label = "전체보기" if k == "all" else CATEGORY_LABEL.get(k, k)
        active = " active" if i == 0 else ""
        out.append(f'<button type="button" class="tab-btn{active}" data-cat="{k}">{esc(label)} · {count}</button>')
    return "".join(out)

def render_archive_topic_cloud_html(entries, tag_dict):
    """archive.js의 renderTopicCloud() — 필터 이전(전체) 기준. '전체보기' 칩 포함."""
    topics, counts = _topic_counts(entries, tag_dict)
    all_chip = f'<button type="button" class="tag active" data-tag="">전체보기<span class="cnt">{len(entries)}</span></button>'
    chips = "".join(
        f'<button type="button" class="tag" data-tag="{esc(t)}">#{esc(t)}<span class="cnt">{counts[t]}</span></button>'
        for t in topics
    )
    return all_chip + chips

def render_archive_grid_html(entries):
    """archive.js의 renderGrid() — 전체 아티클, 발행일 내림차순(entries가 이미 이 순서)."""
    return "".join(card_html(e, False) for e in entries)

def inject_ssr(text, replacements):
    """<!--SSR:NAME-->...<!--/SSR:NAME--> 사이 내용을 통째로 갈아끼운다. 마커 자체는 남겨두므로
    다음 빌드에서도 같은 자리를 다시 찾아 갱신할 수 있다(멱등)."""
    for name, content in replacements.items():
        start, end = f"<!--SSR:{name}-->", f"<!--/SSR:{name}-->"
        text = re.sub(re.escape(start) + r".*?" + re.escape(end), start + content + end, text, flags=re.DOTALL)
    return text

# index.html·articles.html이 링크하는 정적 자산 — ARTICLE_TEMPLATE(포맷 문자열)과 달리
# 손으로 쓴 정적 HTML이라 .format() 대신 아래 inject_asset_versions()가 정규식으로 처리한다.
STATIC_PAGE_ASSETS = [
    "assets/site.css", "assets/article.css",
    "data/config.js", "assets/render.js", "assets/archive.js",
    "assets/ui.js", "assets/search.js",
]

def inject_asset_versions(text):
    """index.html·articles.html 안의 css/js href·src 뒤에 ?v=<내용해시>를 붙인다(asset_ver 참고).
    이미 ?v=가 붙어 있으면 새 값으로 교체하므로 여러 번 실행해도 안전하다(멱등)."""
    for rel in STATIC_PAGE_ASSETS:
        ver = asset_ver(rel)
        pattern = r'((?:href|src)=")' + re.escape(rel) + r'(?:\?v=[0-9a-f]+)?(")'
        text = re.sub(pattern, rf'\g<1>{rel}?v={ver}\g<2>', text)
    return text

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
<link rel="stylesheet" href="../assets/site.css?v={ver_site_css}">
<link rel="stylesheet" href="../assets/article.css?v={ver_article_css}">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"Article","headline":{title_json},"description":{excerpt_json},"datePublished":"{date}","dateModified":"{date}","inLanguage":"ko-KR","keywords":{keywords_json},"image":"{site_url}/{thumb}","mainEntityOfPage":{{"@type":"WebPage","@id":"{site_url}/articles/{slug}.html"}},"author":{{"@type":"Organization","name":"이음전략소","url":"https://www.iumist.com/"}},"publisher":{{"@type":"Organization","name":"공인싸","url":"{site_url}/","logo":{{"@type":"ImageObject","url":"{site_url}/assets/logo-mark.png"}},"parentOrganization":{{"@type":"Organization","name":"이음전략소"}}}}}}
</script>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':
new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
}})(window,document,'script','dataLayer','GTM-5R8SW56S');</script>
<!-- End Google Tag Manager -->
</head>
<body data-article-id="{slug}">
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5R8SW56S"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->

<a class="skip-link" href="#top">본문 바로가기</a>

<header class="site">
  <nav class="nav nav-minimal">
    <a class="brand" href="../index.html"><img src="../assets/logo.png" alt="공인싸 — PUBLIC PR INSIGHTS" class="brand-logo"></a>
    <form class="nav-search" id="site-search-form" role="search" action="../articles.html" method="get">
      <label class="sr-only" for="site-search-input">아티클 검색</label>
      <input id="site-search-input" type="search" name="q" placeholder="궁금한 주제를 검색해보세요" aria-label="아티클 검색" autocomplete="off">
    </form>
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
    <div class="a-share">
      <span class="a-share-label">이 글이 도움이 됐다면 공유해보세요</span>
      <div class="a-share-wrap">
        <button type="button" class="a-share-toggle" id="shareToggleBtn" aria-haspopup="true" aria-expanded="false">
          <svg viewBox="0 -960 960 960" fill="currentColor"><path d="M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T591-694L309-530q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Z"/></svg>
          공유하기
        </button>
        <div class="a-share-menu" id="shareMenu" hidden>
          <button type="button" class="a-share-item" data-share="copy"><span class="a-share-ico a-share-ico-link">🔗</span>URL 복사</button>
          <button type="button" class="a-share-item" data-share="kakao" hidden><span class="a-share-ico a-share-ico-kakao">💬</span>카카오톡</button>
          <button type="button" class="a-share-item" data-share="threads"><span class="a-share-ico a-share-ico-threads">@</span>스레드</button>
          <button type="button" class="a-share-item" data-share="band"><span class="a-share-ico a-share-ico-band">B</span>네이버 밴드</button>
        </div>
      </div>
    </div>
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
        <a class="btn btn-ghost-dark" href="https://www.iumist.com/RT1kT?utm_source=gonginssa&utm_medium=article&utm_campaign=portfolio" target="_blank" rel="noopener">포트폴리오 보기</a>
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
      <a href="mailto:letter@gonginssa.kr">광고·협찬 문의</a>
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
    <form id="consultForm" method="POST" action="/api/consult" novalidate>
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
        <span>[필수] 개인정보 수집 및 이용에 동의합니다. (수집 항목: 이름, 이메일, 연락처 · 목적: 상담 응대 · 보유 기간: 상담 종료 후 1년)</span>
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
    <div class="msg"><b>일잘러를 위한 실무 꿀팁이 메일함으로 쏙!<span class="msg-cta">무료로 받아보세요.</span></b></div>
    <a class="btn" href="../index.html#newsletter">지금 구독하기</a>
    <button class="close" id="floatBarClose" aria-label="닫기">✕</button>
  </div>
</div>

<script src="../data/config.js?v={ver_config_js}"></script>
<script src="../assets/article.js?v={ver_article_js}"></script>
<script src="../assets/ui.js?v={ver_ui_js}"></script>
<script src="../assets/search.js?v={ver_search_js}" defer></script>
</body>
</html>
"""

def build():
    os.makedirs(f"{OUT}/articles", exist_ok=True)
    os.makedirs(f"{OUT}/data", exist_ok=True)
    articles = load_articles()
    entries = []
    # 아티클 템플릿이 링크하는 정적 자산들의 캐시무효화 버전 — 빌드 1회당 한 번만 계산
    ver_site_css = asset_ver("assets/site.css")
    ver_article_css = asset_ver("assets/article.css")
    ver_config_js = asset_ver("data/config.js")
    ver_article_js = asset_ver("assets/article.js")
    ver_ui_js = asset_ver("assets/ui.js")
    ver_search_js = asset_ver("assets/search.js")
    for a in articles:
        excerpt = a["excerpt"] or make_excerpt(a["hook"])
        body_html = render_body(a["body"])
        minutes = a["readTime"] or read_minutes(a["hook"], a["body"])
        # 주제 태그: 마크다운 frontmatter 값만. 분류·필터·홈 클라우드에 쓰인다.
        # 카테고리명을 자동으로 붙이면 모든 글에 같은 태그가 달려 분류 기능을 잃으므로 넣지 않는다.
        tags = list(a["hashtags"])
        # 브랜드 태그: 전 아티클에 항상 노출. 검색 귀속용이며 주제 분류에는 쓰지 않는다.
        brand_tags = list(BRAND_TAGS)
        tabs = a["tabs"] or TAB_MAP.get(a["category"], ["popular"])
        if a["thumb"]:
            thumb = a["thumb"]
        else:
            # 썸네일을 직접 안 올렸으면(Decap CMS "썸네일 이미지" 필드를 비워두면) 제목·
            # 카테고리로 브랜드 템플릿 썸네일을 자동 생성한다(assets/uploads/auto/thumb-<slug>.png,
            # 빌드마다 새로 그려짐 — 제목을 고치면 썸네일도 같이 갱신된다).
            # 폰트·Pillow 등 생성 환경 문제로 실패해도 빌드 전체가 죽지 않도록 카테고리
            # 기본 SVG로 안전하게 대체한다.
            try:
                icon_key = thumb_gen.pick_icon_key(a["title"], a["hashtags"], a["icon"])
                auto_rel = f"assets/uploads/auto/thumb-{a['slug']}.png"
                thumb_gen.generate(a["title"], a["category"], os.path.join(OUT, auto_rel),
                                    icon_key=icon_key, tags=a["hashtags"])
                thumb = "/" + auto_rel
            except Exception as e:
                print(f"⚠️  {a['slug']}: 썸네일 자동 생성 실패({e}) — 카테고리 기본 이미지로 대체")
                thumb = THUMB_MAP.get(a["category"], THUMB_MAP["실무 꿀팁"])
        # og:image·트위터카드도 같은 이미지를 그대로 쓴다(수동 업로드·자동 생성 모두 PNG/JPG라
        # 문제없지만, 생성 실패로 SVG 기본 이미지가 된 경우만 og:image는 SVG가 카카오톡·
        # 페이스북에서 잘 안 뜨므로 별도 JPG로 대체).
        # (site_url + "/" + og_thumb 로 합치므로 앞의 "/"는 제거해서 이중 슬래시 방지)
        og_thumb = OG_FALLBACK_IMAGE if thumb.endswith(".svg") else thumb.lstrip("/")
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
        tags_html = "".join(
            f'<a class="a-tag" href="../articles.html?tag={quote(t)}">#{esc(t)}</a>' for t in tags
        ) + "".join(
            # 브랜드 태그는 전체 아티클 목록으로 — 모든 글이 해당하므로 빈 결과가 나오지 않는다
            f'<a class="a-tag a-tag-brand" href="../articles.html">#{esc(t)}</a>' for t in brand_tags
        )

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
            keywords_json=json.dumps(", ".join(tags + brand_tags), ensure_ascii=False),
            slug=a["slug"],
            category_key=category_key,
            ver_site_css=ver_site_css,
            ver_article_css=ver_article_css,
            ver_config_js=ver_config_js,
            ver_article_js=ver_article_js,
            ver_ui_js=ver_ui_js,
            ver_search_js=ver_search_js,
        )
        with open(f'{OUT}/articles/{a["slug"]}.html', "w", encoding="utf-8") as f:
            f.write(html_out)

    with open(f"{OUT}/data/articles.json", "w", encoding="utf-8") as f:
        json.dump({"articles": entries}, f, ensure_ascii=False, indent=2)

    # 홈(index.html)·목록(articles.html) 정적 카드 마크업 주입
    # ------------------------------------------------------------
    # 지금까지는 render.js·archive.js가 자바스크립트로만 카드를 그려서, 실행 전
    # HTML(검색엔진 크롤러 포함)에는 글 제목·요약·링크가 전혀 없었다(0/11개 확인됨).
    # 여기서 빌드 시점에 같은 카드를 미리 정적 HTML로 구워 <!--SSR:*--> 마커 사이에
    # 심어둔다. render.js·archive.js는 그대로 두므로(수정 없음), 페이지가 열리고
    # fetch가 끝나면 지금까지처럼 다시 덮어써 필터링·탭 전환 등 인터랙션은 동일하게
    # 동작한다 — 달라지는 건 자바스크립트가 뜨기 전 첫 페인트뿐이다.
    tag_dict = load_tag_dictionary()

    index_path = f"{OUT}/index.html"
    if os.path.exists(index_path):
        html_text = open(index_path, encoding="utf-8").read()
        repl = {"CLOUD": render_topic_cloud_html(entries, tag_dict)}
        for tab_key in ("popular", "workbook", "featured"):
            repl[f"TAB:{tab_key}"] = render_tab_panel_html(tab_key, entries)
        html_text = inject_ssr(html_text, repl)
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(inject_asset_versions(html_text))

    articles_path = f"{OUT}/articles.html"
    if os.path.exists(articles_path):
        html_text = open(articles_path, encoding="utf-8").read()
        repl = {
            "CATTABS": render_category_tabs_html(entries),
            "TOPICCLOUD": render_archive_topic_cloud_html(entries, tag_dict),
            "GRID": render_archive_grid_html(entries),
        }
        html_text = inject_ssr(html_text, repl)
        with open(articles_path, "w", encoding="utf-8") as f:
            f.write(inject_asset_versions(html_text))

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
