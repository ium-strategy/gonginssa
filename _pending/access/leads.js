// functions/api/leads.js — Cloudflare Pages Function (Access 적용 버전)
// admin.html "상담 신청" 탭에서 KV에 쌓인 상담 리드를 조회할 때 쓰는 API.
//
// 인증: Cloudflare Access가 발급한 JWT(Cf-Access-Jwt-Assertion 헤더)를 서명까지 검증한다.
//   → 클라이언트에 비밀번호나 해시를 두지 않는다. 소스를 뜯어봐도 우회할 수 없다.
//   → 환경변수나 토큰이 없으면 무조건 거부한다(fail-closed).
//
// 필요한 환경변수: CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD
// 필요한 바인딩: LEADS_KV

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await verifyAccessJwt(request, env);
  if (!auth.ok) {
    console.error("Access 검증 실패:", auth.error);
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (!env.LEADS_KV) return json({ ok: false, error: "LEADS_KV not bound" }, 500);

  try {
    const list = await env.LEADS_KV.list({ prefix: "lead_" });
    const entries = await Promise.all(
      list.keys.map(async (k) => {
        const v = await env.LEADS_KV.get(k.name);
        try { return JSON.parse(v); } catch (e) { return null; }
      })
    );
    const leads = entries
      .filter(Boolean)
      .sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || ""));
    return json({ ok: true, leads, viewer: auth.email });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

async function verifyAccessJwt(request, env) {
  const team = env.CF_ACCESS_TEAM_DOMAIN;
  const aud = env.CF_ACCESS_AUD;
  if (!team || !aud) return { ok: false, error: "CF_ACCESS_* 환경변수가 없습니다." };

  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  const token = request.headers.get("Cf-Access-Jwt-Assertion") || (m ? m[1] : null);
  if (!token) return { ok: false, error: "Access 토큰이 없습니다." };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "토큰 형식 오류" };
  const headB64 = parts[0], payloadB64 = parts[1], sigB64 = parts[2];

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headB64)));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch (e) {
    return { ok: false, error: "토큰 디코딩 실패" };
  }

  const issuer = team.includes(".") ? "https://" + team : "https://" + team + ".cloudflareaccess.com";
  if (payload.iss !== issuer) return { ok: false, error: "iss 불일치 (" + payload.iss + ")" };
  const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audList.includes(aud)) return { ok: false, error: "aud 불일치" };
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) return { ok: false, error: "토큰 만료" };
  if (payload.nbf && now < payload.nbf) return { ok: false, error: "토큰 유효기간 이전" };

  let jwks;
  try {
    const res = await fetch(issuer + "/cdn-cgi/access/certs", { cf: { cacheTtl: 3600, cacheEverything: true } });
    jwks = await res.json();
  } catch (e) {
    return { ok: false, error: "JWKS 조회 실패" };
  }

  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, error: "일치하는 공개키 없음" };

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, b64urlToBytes(sigB64),
      new TextEncoder().encode(headB64 + "." + payloadB64)
    );
  } catch (e) {
    return { ok: false, error: "서명 검증 오류" };
  }

  if (!valid) return { ok: false, error: "서명 불일치" };
  return { ok: true, email: payload.email || "" };
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
