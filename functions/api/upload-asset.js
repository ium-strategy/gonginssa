// functions/api/upload-asset.js — Cloudflare Pages Function
// admin.html 본문 편집기의 "이미지 삽입" 버튼에서 호출. 업로드한 이미지 파일을
// out/assets/uploads/<파일명>에 커밋하고 공개 URL을 돌려준다.
// Decap CMS(/admin/)의 media_folder(out/assets/uploads)·public_folder(/assets/uploads)와
// 동일한 위치를 써서 두 관리 화면이 같은 자산 폴더를 공유한다.
//
// 파일명 맨 앞에 업로드 시각을 붙여 충돌을 피하므로, 기존 파일 조회(GET) 없이
// 바로 새 파일로 커밋한다.
//
// 필요한 환경변수: ADMIN_PW_HASH, GITHUB_TOKEN (save-article.js와 동일)

const OWNER = "ium-strategy";
const REPO = "gonginssa";
const BRANCH = "main";
const GITHUB_API = "https://api.github.com";
const MAX_BASE64_LEN = Math.ceil((5 * 1024 * 1024 * 4) / 3); // 원본 5MB 기준 base64 길이 상한

export async function onRequestPost(context) {
  const { request, env } = context;

  const providedHash = request.headers.get("X-Admin-Hash") || "";
  if (!env.ADMIN_PW_HASH || providedHash !== env.ADMIN_PW_HASH) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!env.GITHUB_TOKEN) {
    return json({ ok: false, error: "GITHUB_TOKEN 환경변수가 설정되지 않았습니다" }, 500);
  }

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: "invalid body" }, 400);
  }

  const filenameRaw = String(data.filename || "").trim();
  const contentBase64 = String(data.contentBase64 || "");
  if (!filenameRaw || !contentBase64) {
    return json({ ok: false, error: "filename과 contentBase64가 필요합니다" }, 400);
  }
  if (contentBase64.length > MAX_BASE64_LEN) {
    return json({ ok: false, error: "이미지가 너무 큽니다(최대 5MB)" }, 400);
  }

  const extMatch = filenameRaw.match(/\.[a-zA-Z0-9]+$/);
  const ext = (extMatch ? extMatch[0] : ".png").toLowerCase();
  const base =
    filenameRaw
      .replace(/\.[a-zA-Z0-9]+$/, "")
      .replace(/[^a-zA-Z0-9가-힣._-]/g, "-")
      .slice(0, 60) || "image";
  const filename = `${Date.now()}-${base}${ext}`;
  const path = `out/assets/uploads/${filename}`;

  let putRes;
  try {
    putRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "gonginssa-admin",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `admin: 이미지 업로드 ${filename}`,
        content: contentBase64,
        branch: BRANCH,
      }),
    });
  } catch (e) {
    return json({ ok: false, error: `GitHub 업로드 요청 실패: ${e}` }, 502);
  }
  if (!putRes.ok) {
    return json({ ok: false, error: `GitHub 업로드 실패 (${putRes.status}): ${await putRes.text()}` }, 502);
  }
  return json({ ok: true, url: `/assets/uploads/${filename}` });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
