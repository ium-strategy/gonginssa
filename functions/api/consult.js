// functions/api/consult.js — Cloudflare Pages Function
// 상담 신청 폼 제출 처리: ① 스팸(허니팟) 필터 ② 슬랙 알림 ③ KV 저장(관리자 화면 "상담 신청" 탭 조회용)
//
// 필요한 환경변수 (Cloudflare 대시보드 > Pages 프로젝트 > Settings > Environment variables):
//   SLACK_WEBHOOK_URL  — 기존 Netlify에서 쓰던 것과 동일한 슬랙 Incoming Webhook URL
// 필요한 바인딩 (Settings > Functions > KV namespace bindings):
//   LEADS_KV — 상담 신청 데이터를 저장할 KV 네임스페이스 (변수명 정확히 이렇게)

const FIELD_LABELS = { name: "이름 / 소속", email: "이메일", phone: "연락처", message: "상담 내용" };

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    const body = await request.formData();
    data = Object.fromEntries(body.entries());
  } catch (e) {
    return json({ ok: false, error: "invalid form data" }, 400);
  }

  // 허니팟(bot-field)에 값이 채워져 있으면 봇으로 간주 — 성공 응답만 주고 아무 것도 안 함
  if (data["bot-field"]) {
    return json({ ok: true });
  }

  const entry = {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || "",
    message: data.message || "",
    submitted_at: new Date().toISOString(),
  };

  // KV 저장
  if (env.LEADS_KV) {
    try {
      await env.LEADS_KV.put(entry.id, JSON.stringify(entry));
    } catch (e) {
      console.error("KV 저장 실패:", e);
    }
  } else {
    console.error("LEADS_KV 바인딩이 설정되지 않아 저장을 건너뜁니다.");
  }

  // 슬랙 알림
  if (env.SLACK_WEBHOOK_URL) {
    const lines = Object.entries(FIELD_LABELS).map(([key, label]) => `• *${label}*: ${entry[key] || "-"}`);
    const text = [`*🟢 새 상담 신청*`, ...lines, `_${nowKST()}_`].join("\n");
    await sendSlack(env.SLACK_WEBHOOK_URL, text);
  } else {
    console.error("SLACK_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
  }

  return json({ ok: true });
}

function nowKST() {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

async function sendSlack(webhookUrl, text) {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) console.error(`슬랙 전송 실패 (${res.status}):`, await res.text());
  } catch (e) {
    console.error("슬랙 전송 중 오류:", e);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
