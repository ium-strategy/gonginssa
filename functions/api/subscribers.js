// functions/api/subscribers.js — Cloudflare Pages Function
// admin.html "구독 신청" 탭에서 KV에 쌓인 구독 신청을 조회할 때 쓰는 API.
// leads.js(상담 신청)와 완전히 같은 인증 방식 — admin.html의 접근코드(GATE_HASH)와
// 같은 값을 SHA-256 해시로 비교한다.
//
// 필요한 환경변수: ADMIN_PW_HASH (leads.js와 동일)
// 필요한 바인딩: LEADS_KV (subscribe.js와 동일한 네임스페이스, sub_ 접두사로 구분)

export async function onRequestGet(context) {
  const { request, env } = context;

  const providedHash = request.headers.get("X-Admin-Hash") || "";
  if (!env.ADMIN_PW_HASH || providedHash !== env.ADMIN_PW_HASH) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (!env.LEADS_KV) {
    return json({ ok: false, error: "LEADS_KV not bound" }, 500);
  }

  try {
    const list = await env.LEADS_KV.list({ prefix: "sub_" });
    const entries = await Promise.all(
      list.keys.map(async (k) => {
        const v = await env.LEADS_KV.get(k.name);
        try { return JSON.parse(v); } catch (e) { return null; }
      })
    );
    const subscribers = entries.filter(Boolean).sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || ""));
    return json({ ok: true, subscribers });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
