// functions/api/leads.js — Cloudflare Pages Function
// admin.html "상담 신청" 탭에서 KV에 쌓인 상담 리드를 조회할 때 쓰는 API.
// 인증: admin.html의 접근코드(GATE_HASH)와 같은 값을 SHA-256 해시로 비교합니다.
//   → admin.html에서 접근코드를 입력해 로그인해야만 이 API를 호출할 수 있고,
//     비밀번호 자체는 네트워크로 전송하지 않습니다(해시만 비교).
//   → admin.html의 GATE_HASH를 바꾸면 아래 환경변수도 반드시 같이 바꿔야 합니다.
//
// 필요한 환경변수: ADMIN_PW_HASH (기본값 없음 — 반드시 설정. admin.html의 GATE_HASH와 동일한 값)
// 필요한 바인딩: LEADS_KV (consult.js와 동일한 네임스페이스)

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
    const list = await env.LEADS_KV.list({ prefix: "lead_" });
    const entries = await Promise.all(
      list.keys.map(async (k) => {
        const v = await env.LEADS_KV.get(k.name);
        try { return JSON.parse(v); } catch (e) { return null; }
      })
    );
    const leads = entries.filter(Boolean).sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || ""));
    return json({ ok: true, leads });
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
