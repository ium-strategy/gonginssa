# -*- coding: utf-8 -*-
"""아티클 썸네일 자동 생성 — 제목·카테고리만 있으면(Decap CMS에서 '썸네일 이미지'를
비워둔 상태) 브랜드 그라데이션 배경 + 제목 + 카테고리 태그 + 아이콘 + 로고를 조합한
PNG를 빌드 시점에 만든다(og:image·사이트 카드에 그대로 쓰임).

헤드리스 브라우저(Chromium 등)를 쓰지 않고 Pillow만으로 그리는 이유: 실제 배포는
Cloudflare Pages의 `pip install -r requirements.txt && python3 build_articles.py`
빌드에서 돌아가는데, 그 빌드 이미지에 브라우저/Node가 있다는 보장이 없다.
Pillow(+numpy)는 순수 pip 패키지라 어디서든 동일하게 동작한다.

아이콘은 지금은 Pillow 도형으로 직접 그린 플랫 아이콘이다 — 나중에 실제 3D 렌더
아이콘을 구하면 build_assets/thumb_icons/<key>.png 로 넣기만 하면 코드 수정 없이
그 파일이 우선 사용된다(ICON_ASSET_DIR 참고)."""
import os

from PIL import Image, ImageDraw, ImageFont

try:
    import numpy as np
except ImportError:  # numpy가 없는 환경이면 단색 배경으로 안전하게 대체(그라데이션만 포기)
    np = None

BASE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(BASE, "build_assets", "fonts")
ICON_ASSET_DIR = os.path.join(BASE, "build_assets", "thumb_icons")  # 실사진/3D 아이콘 드롭인 교체용

FONT_BLACK = os.path.join(FONT_DIR, "NotoSansKR-Black.ttf")
FONT_SEMIBOLD = os.path.join(FONT_DIR, "NotoSansKR-SemiBold.ttf")

W, H = 1280, 720  # site.css .thumb aspect-ratio:16/9 와 정확히 일치시켜 크롭 없이 표시
PAD = 64

# site.css :root --brand-500 → --brand-900 그라데이션과 동일(피그마 썸네일 템플릿과도 통일)
GRAD_FROM = (0x7C, 0x6F, 0xF0)
GRAD_TO = (0x28, 0x19, 0x66)

SS = 4  # 아이콘을 이 배율로 그린 뒤 축소해서 안티에일리어싱 효과를 낸다


def _gradient_bg():
    """좌상단→우하단 대각선 브랜드 그라데이션."""
    if np is None:
        im = Image.new("RGB", (W, H), GRAD_FROM)
        return im
    y, x = np.mgrid[0:H, 0:W]
    proj = x.astype("float32") + y.astype("float32")
    proj = (proj - proj.min()) / (proj.max() - proj.min())
    c1 = np.array(GRAD_FROM, dtype="float32")
    c2 = np.array(GRAD_TO, dtype="float32")
    grad = c1[None, None, :] * (1 - proj[..., None]) + c2[None, None, :] * proj[..., None]
    return Image.fromarray(grad.astype("uint8"), "RGB")


def _wrap_lines(draw, text, font, max_width):
    """공백 기준으로 먼저 줄바꿈하고, 공백 없이도 넘치는 덩어리는 글자 단위로 다시 쪼갠다."""
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if not cur or draw.textlength(trial, font=font) <= max_width:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    fixed = []
    for line in lines:
        if draw.textlength(line, font=font) <= max_width:
            fixed.append(line)
            continue
        buf = ""
        for ch in line:
            trial = buf + ch
            if not buf or draw.textlength(trial, font=font) <= max_width:
                buf = trial
            else:
                fixed.append(buf)
                buf = ch
        if buf:
            fixed.append(buf)
    return fixed


def _fit_title(draw, text, max_width, max_lines=2, start_size=58, min_size=32):
    """최대 2줄에 맞을 때까지 폰트 크기를 줄인다. 그래도 안 맞으면 말줄임표로 자른다."""
    size = start_size
    while size >= min_size:
        font = ImageFont.truetype(FONT_BLACK, size)
        lines = _wrap_lines(draw, text, font, max_width)
        if len(lines) <= max_lines:
            return font, lines, size
        size -= 2
    font = ImageFont.truetype(FONT_BLACK, min_size)
    lines = _wrap_lines(draw, text, font, max_width)
    if len(lines) > max_lines:
        keep = lines[:max_lines]
        last = keep[-1]
        while last and draw.textlength(last + "…", font=font) > max_width:
            last = last[:-1]
        keep[-1] = last + "…"
        lines = keep
    return font, lines, min_size


# ------------------------------------------------------------------
# 아이콘 — Pillow 도형만으로 그린 플랫 픽토그램. 전부 (0,0)-(1000,1000) 캔버스 기준.
# ------------------------------------------------------------------
WHITE = (255, 255, 255, 255)
BRAND_DOT = (124, 111, 240, 255)


def _canvas():
    s = 1000 * SS
    return Image.new("RGBA", (s, s), (0, 0, 0, 0)), s


def icon_ai(**_):
    im, s = _canvas()
    d = ImageDraw.Draw(im)
    u = s / 1000
    d.rounded_rectangle([120 * u, 160 * u, 880 * u, 660 * u], radius=140 * u, fill=WHITE)
    d.polygon([(300 * u, 660 * u), (430 * u, 660 * u), (270 * u, 860 * u)], fill=WHITE)
    d.ellipse([300 * u, 350 * u, 420 * u, 470 * u], fill=BRAND_DOT)
    d.ellipse([580 * u, 350 * u, 700 * u, 470 * u], fill=BRAND_DOT)
    # 반짝임(스파클)
    cx, cy, r = 830 * u, 140 * u, 70 * u
    d.polygon([(cx, cy - r), (cx + r * 0.28, cy - r * 0.28), (cx + r, cy),
               (cx + r * 0.28, cy + r * 0.28), (cx, cy + r), (cx - r * 0.28, cy + r * 0.28),
               (cx - r, cy), (cx - r * 0.28, cy - r * 0.28)], fill=WHITE)
    return im


def icon_megaphone(**_):
    im, s = _canvas()
    d = ImageDraw.Draw(im)
    u = s / 1000
    d.polygon([(120 * u, 430 * u), (120 * u, 570 * u), (300 * u, 570 * u),
               (650 * u, 760 * u), (650 * u, 240 * u), (300 * u, 430 * u)], fill=WHITE)
    d.rounded_rectangle([100 * u, 430 * u, 170 * u, 570 * u], radius=20 * u, fill=WHITE)
    d.rounded_rectangle([220 * u, 590 * u, 300 * u, 720 * u], radius=24 * u, fill=WHITE)
    for i, r in enumerate([120, 220, 320]):
        bbox = [700 * u - r * u, 500 * u - r * u, 700 * u + r * u, 500 * u + r * u]
        d.arc(bbox, start=-55, end=55, fill=WHITE, width=int(26 * u))
    return im


def icon_camera(**_):
    im, s = _canvas()
    d = ImageDraw.Draw(im)
    u = s / 1000
    d.rounded_rectangle([140 * u, 320 * u, 860 * u, 780 * u], radius=60 * u, fill=WHITE)
    d.rounded_rectangle([330 * u, 200 * u, 600 * u, 340 * u], radius=30 * u, fill=WHITE)
    cx, cy, r = 500 * u, 560 * u, 160 * u
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRAND_DOT)
    r2 = 90 * u
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=WHITE)
    d.ellipse([760 * u, 380 * u, 820 * u, 440 * u], fill=BRAND_DOT)
    return im


def icon_people(**_):
    im, s = _canvas()
    d = ImageDraw.Draw(im)
    u = s / 1000
    d.ellipse([280 * u, 160 * u, 560 * u, 440 * u], fill=WHITE)
    d.pieslice([180 * u, 420 * u, 660 * u, 900 * u], 180, 360, fill=WHITE)
    cx, cy, r = 740 * u, 700 * u, 160 * u
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRAND_DOT)
    bar = 34 * u
    d.rounded_rectangle([cx - bar / 2, cy - r * 0.55, cx + bar / 2, cy + r * 0.55], radius=bar / 2, fill=WHITE)
    d.rounded_rectangle([cx - r * 0.55, cy - bar / 2, cx + r * 0.55, cy + bar / 2], radius=bar / 2, fill=WHITE)
    return im


def icon_calendar(**_):
    im, s = _canvas()
    d = ImageDraw.Draw(im)
    u = s / 1000
    d.rounded_rectangle([140 * u, 220 * u, 860 * u, 820 * u], radius=50 * u, fill=WHITE)
    d.rectangle([140 * u, 220 * u, 860 * u, 360 * u], fill=BRAND_DOT)
    for cx in (340 * u, 660 * u):
        d.rounded_rectangle([cx - 30 * u, 150 * u, cx + 30 * u, 300 * u], radius=30 * u, fill=WHITE)
    for row in range(3):
        for col in range(4):
            cx = 260 * u + col * 170 * u
            cy = 480 * u + row * 120 * u
            r = 26 * u
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRAND_DOT)
    return im


def icon_video(**_):
    im, s = _canvas()
    d = ImageDraw.Draw(im)
    u = s / 1000
    d.rounded_rectangle([120 * u, 180 * u, 880 * u, 820 * u], radius=70 * u, fill=WHITE)
    cx, cy, r = 500 * u, 500 * u, 190 * u
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRAND_DOT)
    tri = r * 0.6
    d.polygon([(cx - tri * 0.5, cy - tri * 0.85), (cx - tri * 0.5, cy + tri * 0.85),
               (cx + tri * 0.9, cy)], fill=WHITE)
    return im


def icon_chart(**_):
    im, s = _canvas()
    d = ImageDraw.Draw(im)
    u = s / 1000
    base = 820 * u
    bars = [(190, 560), (400, 430), (610, 300), (820, 160)]
    for x, top in bars:
        d.rounded_rectangle([x * u, top * u, (x + 140) * u, base], radius=24 * u, fill=WHITE)
    d.line([(150 * u, 620 * u), (400 * u, 470 * u), (600 * u, 340 * u), (860 * u, 110 * u)],
           fill=BRAND_DOT, width=int(22 * u), joint="curve")
    d.polygon([(860 * u, 110 * u), (790 * u, 130 * u), (840 * u, 180 * u)], fill=BRAND_DOT)
    return im


def icon_trophy(**_):
    im, s = _canvas()
    d = ImageDraw.Draw(im)
    u = s / 1000
    d.pieslice([260 * u, 160 * u, 740 * u, 560 * u], 0, 180, fill=WHITE)
    d.rectangle([260 * u, 220 * u, 740 * u, 360 * u], fill=WHITE)
    d.arc([120 * u, 220 * u, 380 * u, 480 * u], start=-90, end=110, fill=WHITE, width=int(34 * u))
    d.arc([620 * u, 220 * u, 880 * u, 480 * u], start=70, end=270, fill=WHITE, width=int(34 * u))
    d.rounded_rectangle([460 * u, 500 * u, 540 * u, 640 * u], radius=20 * u, fill=WHITE)
    d.rounded_rectangle([360 * u, 640 * u, 640 * u, 720 * u], radius=24 * u, fill=WHITE)
    return im


def icon_doc(**_):
    im, s = _canvas()
    d = ImageDraw.Draw(im)
    u = s / 1000
    d.rounded_rectangle([220 * u, 140 * u, 780 * u, 860 * u], radius=40 * u, fill=WHITE)
    d.polygon([(660 * u, 140 * u), (780 * u, 140 * u), (780 * u, 260 * u)], fill=BRAND_DOT)
    for i, y in enumerate([380, 500, 620]):
        w = 420 * u if i != 2 else 300 * u
        d.rounded_rectangle([320 * u, y * u, 320 * u + w, y * u + 40 * u], radius=20 * u, fill=BRAND_DOT)
    return im


ICON_LIBRARY = {
    "ai": icon_ai,
    "megaphone": icon_megaphone,
    "camera": icon_camera,
    "people": icon_people,
    "calendar": icon_calendar,
    "video": icon_video,
    "chart": icon_chart,
    "trophy": icon_trophy,
    "doc": icon_doc,
}

# 제목/태그에 이 키워드가 있으면 해당 아이콘을 자동 선택(먼저 매치되는 순서 우선).
# icon frontmatter가 명시돼 있으면 이 자동판별보다 우선한다.
ICON_KEYWORDS = [
    ("ai", ["ai", "챗gpt", "chatgpt", "인공지능"]),
    ("trophy", ["공모전", "수상", "시상"]),
    ("camera", ["사진", "초상권", "이미지"]),
    ("people", ["팔로워", "구독자", "채용", "인재"]),
    ("calendar", ["보도자료", "일정", "날짜"]),
    ("video", ["영상", "숏폼", "쇼츠", "video"]),
    ("chart", ["트렌드", "전망", "변화", "데이터", "빅데이터"]),
    ("megaphone", ["홍보", "sns", "인스타그램", "밴드"]),
]


def pick_icon_key(title, tags, override=""):
    override = (override or "").strip().lower()
    if override in ICON_LIBRARY:
        return override
    hay = (title + " " + " ".join(tags)).lower()
    for key, kws in ICON_KEYWORDS:
        if any(kw in hay for kw in kws):
            return key
    return "doc"


def _load_icon(icon_key, target_px):
    """build_assets/thumb_icons/<key>.png 가 있으면(실사진·3D 렌더 등 실제 에셋으로
    교체된 경우) 그걸 그대로 쓰고, 없으면 Pillow로 그린 기본 픽토그램을 쓴다."""
    custom_path = os.path.join(ICON_ASSET_DIR, f"{icon_key}.png")
    if os.path.exists(custom_path):
        im = Image.open(custom_path).convert("RGBA")
    else:
        fn = ICON_LIBRARY.get(icon_key, icon_doc)
        im = fn()
    return im.resize((target_px, target_px), Image.LANCZOS)


def _white_logo():
    logo_path = os.path.join(BASE, "out", "assets", "logo.png")
    logo = Image.open(logo_path).convert("RGBA")
    white = Image.new("RGBA", logo.size, (255, 255, 255, 0))
    white.putalpha(logo.split()[3])
    return white


def generate(title, category_label, out_path, icon_key="doc", tags=None):
    """썸네일 PNG를 만들어 out_path에 저장한다. 1280x720(site.css .thumb 16:9와 동일)."""
    bg = _gradient_bg().convert("RGBA")
    draw = ImageDraw.Draw(bg)

    # 카테고리 태그 — 좌상단, 흰 배경 필에 브랜드 색 텍스트
    tag_font = ImageFont.truetype(FONT_SEMIBOLD, 26)
    tag_text = category_label
    tw = draw.textlength(tag_text, font=tag_font)
    tag_x0, tag_y0 = PAD, 56
    tag_pad_x, tag_h = 22, 46
    tag_x1 = tag_x0 + tw + tag_pad_x * 2
    tag_y1 = tag_y0 + tag_h
    draw.rounded_rectangle([tag_x0, tag_y0, tag_x1, tag_y1], radius=tag_h / 2, fill=(255, 255, 255, 235))
    draw.text((tag_x0 + tag_pad_x, tag_y0 + tag_h / 2), tag_text, font=tag_font,
               fill=(0x28, 0x19, 0x66, 255), anchor="lm")

    # 제목 — 최대 2줄, 아이콘 영역을 피해 폭 제한
    title_max_width = 720
    title_font, lines, size = _fit_title(draw, title, title_max_width)
    line_gap = size * 1.34
    total_h = line_gap * len(lines)
    ty = tag_y1 + 44
    for i, line in enumerate(lines):
        draw.text((PAD, ty + i * line_gap), line, font=title_font, fill=WHITE, anchor="la")

    # 아이콘 — 우측, 은은한 원형 배지 위에 배치.
    # (ImageDraw로 RGBA 캔버스에 알파값 있는 색을 그리면 실제로는 블렌딩되지 않고
    # 알파 채널만 덮어써져서 마지막에 RGB로 변환할 때 불투명하게 보인다 — 그래서
    # 반투명 대신 미리 계산한 옅은 보라 단색을 그대로 쓴다.)
    icon_px = 300
    icon_cx, icon_cy = W - 220, H - 240
    badge_r = 190
    badge_color = tuple(int(255 * 0.5 + c * 0.5) for c in GRAD_TO) + (255,)
    draw.ellipse([icon_cx - badge_r, icon_cy - badge_r, icon_cx + badge_r, icon_cy + badge_r],
                 fill=badge_color)
    icon_im = _load_icon(icon_key, icon_px)
    bg.paste(icon_im, (int(icon_cx - icon_px / 2), int(icon_cy - icon_px / 2)), icon_im)

    # 로고 — 좌하단, 흰색 버전
    logo = _white_logo()
    logo_w = 176
    logo_h = int(logo.height * (logo_w / logo.width))
    logo_resized = logo.resize((logo_w, logo_h), Image.LANCZOS)
    bg.alpha_composite(logo_resized, (PAD, H - PAD - logo_h))

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bg.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path
