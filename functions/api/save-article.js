// functions/api/save-article.js — Cloudflare Pages Function
// admin.html "게시글 관리" 탭에서 호출. content/articles/<slug>.md를 GitHub API로
// 직접 읽고 쓴다 — Decap CMS(/admin/)가 커밋하는 것과 같은 파일이므로, 그 뒤에
// 이어지는 Cloudflare Pages 자동 빌드(build_articles.py)가 out/data/articles.json과
// out/articles/*.html을 알아서 재생성한다. 이 함수 자체는 그 결과물을 직접
// 만들지 않는다.
//
// GET  ?slug=<slug>  — 본문 편집기가 열릴 때 원문 body를 읽어온다.
// POST { slug, title?, category?, date?, thumb?, excerpt?, readTime?, tabs?, body? }
//   — admin.html 폼이 다루는 필드만 upsert. body가 오면 통째로 교체하고,
//     그 외(hashtags·hook·reference)는 이 함수가 아예 모르는 값이라 손대지 않고
//     원본 그대로 보존한다.
//
// 새 게시글 생성은 지원하지 않는다 — 기존 .md 파일이 없는 슬러그는 에러를
// 반환하고 Decap CMS(/admin/)에서 작성하도록 안내한다(본문 있는 새 글 작성은
// 이 가벼운 편집 도구의 범위 밖).
//
// 필요한 환경변수:
//   ADMIN_PW_HASH — admin.html 접근코드 해시(다른 admin API와 동일)
//   GITHUB_TOKEN  — content 저장소에 대한 Read/write 권한의 GitHub Fine-grained PAT

const OWNER = "ium-strategy";
const REPO = "gonginssa";
const BRANCH = "main";
const GITHUB_API = "https://api.github.com";

// config.js의 카테고리 키(practical/case) → 실제 .md frontmatter가 쓰는 한글 라벨.
// build_articles.py는 category 값을 정확히 "실무 꿀팁"/"레퍼런스" 문자열로만 인식한다
// (TAB_MAP·category_key 판정 전부 이 라벨 기준) — 키를 그대로 저장하면 탭·배지가 깨진다.
const CATEGORY_LABEL = { practical: "실무 꿀팁", case: "레퍼런스" };

function checkAuth(request, env) {
  const providedHash = request.headers.get("X-Admin-Hash") || "";
  if (!env.ADMIN_PW_HASH || providedHash !== env.ADMIN_PW_HASH) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!env.GITHUB_TOKEN) {
    return json({ ok: false, error: "GITHUB_TOKEN 환경변수가 설정되지 않았습니다" }, 500);
  }
  return null;
}

function ghHeadersFor(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "gonginssa-admin",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// content/articles/<slug>.md를 조회해 frontmatter/body/sha로 분리한다.
// 실패하면 그대로 반환할 수 있는 에러 Response를 err에 담아 돌려준다.
async function fetchArticle(env, slug) {
  const path = `content/articles/${slug}.md`;
  const ghHeaders = ghHeadersFor(env);
  let getRes;
  try {
    getRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, {
      headers: ghHeaders,
    });
  } catch (e) {
    return { err: json({ ok: false, error: `GitHub 연결 실패: ${e}` }, 502) };
  }
  if (getRes.status === 404) {
    return {
      err: json(
        {
          ok: false,
          error: "새 게시글은 이 화면으로 만들 수 없습니다. 본문 작성이 필요한 신규 게시글은 Decap CMS(/admin/)에서 작성해주세요.",
        },
        404
      ),
    };
  }
  if (!getRes.ok) {
    return { err: json({ ok: false, error: `GitHub 조회 실패 (${getRes.status}): ${await getRes.text()}` }, 502) };
  }
  const fileInfo = await getRes.json();
  let raw;
  try {
    raw = b64ToUtf8(fileInfo.content);
  } catch (e) {
    return { err: json({ ok: false, error: `파일 디코딩 실패: ${e}` }, 500) };
  }
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) {
    return { err: json({ ok: false, error: "frontmatter(---) 형식이 아닌 파일입니다" }, 500) };
  }
  return { path, raw, front: m[1], body: m[2], sha: fileInfo.sha };
}

// 본문 편집기가 열릴 때 원문 body를 읽어온다. frontmatter 값들은 이미
// articles.json(홈·목록 데이터)에 있으므로 여기선 body만 돌려준다.
export async function onRequestGet(context) {
  const { request, env } = context;
  const authErr = checkAuth(request, env);
  if (authErr) return authErr;

  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return json({ ok: false, error: "잘못된 slug입니다" }, 400);
  }
  const { err, body } = await fetchArticle(env, slug);
  if (err) return err;
  // frontmatter 닫는 --- 뒤의 빈 줄 하나는 파일 형식용 구분자일 뿐이라 편집 화면엔 안 보여준다.
  return json({ ok: true, body: body.replace(/^\n+/, "") });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const authErr = checkAuth(request, env);
  if (authErr) return authErr;

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: "invalid body" }, 400);
  }

  const slug = String(data.slug || "").trim();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return json({ ok: false, error: "잘못된 slug입니다" }, 400);
  }

  const parsed = await fetchArticle(env, slug);
  if (parsed.err) return parsed.err;
  const { path, raw, sha } = parsed;
  let front = parsed.front;
  let body = parsed.body;

  // admin.html이 실제로 다루는 필드만 upsert. hashtags·reference·hook은
  // 이 함수가 아예 모르는 값이라 손대지 않는다 — 원본 그대로 보존됨.
  if (typeof data.title === "string" && data.title.trim()) {
    front = upsertField(front, "title", `title: ${yamlStr(data.title)}`);
  }
  if (typeof data.category === "string" && CATEGORY_LABEL[data.category]) {
    front = upsertField(front, "category", `category: ${yamlStr(CATEGORY_LABEL[data.category])}`);
  }
  if (typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    front = upsertField(front, "date", `date: ${yamlStr(data.date)}`);
  }
  if (typeof data.thumb === "string") {
    front = upsertField(front, "thumb", `thumb: ${yamlStr(data.thumb)}`);
  }
  if (typeof data.excerpt === "string") {
    front = upsertField(front, "excerpt", `excerpt: ${yamlStr(data.excerpt)}`);
  }
  if (data.readTime !== undefined && data.readTime !== null && data.readTime !== "") {
    const n = parseInt(data.readTime, 10);
    if (Number.isFinite(n) && n > 0) front = upsertField(front, "readTime", `readTime: ${n}`);
  }
  if (Array.isArray(data.tabs) && data.tabs.length) {
    const validTabs = data.tabs.filter((t) => ["popular", "workbook", "featured"].includes(t));
    if (validTabs.length) {
      const block = "tabs:\n" + validTabs.map((t) => `  - ${t}`).join("\n");
      front = upsertField(front, "tabs", block);
    }
  }
  // 본문 편집기에서 온 값이면 통째로 교체한다. 기존 파일 형식(닫는 --- 뒤 빈 줄
  // 하나 + 본문 + 끝에 개행 하나)에 맞춰 앞뒤 공백을 정리해서 넣는다.
  if (typeof data.body === "string" && data.body.trim()) {
    body = "\n" + data.body.replace(/^\n+/, "").replace(/\s+$/, "") + "\n";
  }

  const newRaw = `---\n${front}\n---\n${body}`;
  if (newRaw === raw) {
    return json({ ok: true, unchanged: true });
  }

  // 커밋
  const ghHeaders = ghHeadersFor(env);
  let putRes;
  try {
    putRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `admin: ${slug} 수정`,
        content: utf8ToB64(newRaw),
        sha,
        branch: BRANCH,
      }),
    });
  } catch (e) {
    return json({ ok: false, error: `GitHub 커밋 요청 실패: ${e}` }, 502);
  }
  if (!putRes.ok) {
    return json({ ok: false, error: `GitHub 커밋 실패 (${putRes.status}): ${await putRes.text()}` }, 502);
  }
  const putBody = await putRes.json();
  return json({ ok: true, commitUrl: (putBody.commit && putBody.commit.html_url) || "" });
}

// frontmatter 안에서 key: 로 시작하는 필드를 찾아 그 필드에 속한 이어지는 줄
// (들여쓰기된 계속줄 — 접힌 문자열이든 리스트 항목이든)까지 통째로 newFieldText로
// 치환한다. 필드가 없으면 frontmatter 끝에 새로 추가한다.
function upsertField(frontmatter, key, newFieldText) {
  const re = new RegExp(`^${key}:.*(\\n(?!\\S).*)*`, "m");
  if (re.test(frontmatter)) {
    return frontmatter.replace(re, newFieldText);
  }
  return frontmatter.replace(/\n*$/, "") + "\n" + newFieldText;
}

// JS 문자열 → YAML 큰따옴표 문자열 리터럴. JSON 문자열 문법은 YAML 큰따옴표
// 스칼라의 부분집합이라 그대로 써도 안전하다(줄바꿈만 미리 제거).
function yamlStr(s) {
  return JSON.stringify(String(s).replace(/\r?\n/g, " ").trim());
}

function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function b64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
