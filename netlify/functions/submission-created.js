// netlify/functions/submission-created.js
//
// Netlify Forms 전용 트리거 함수. 파일명이 정확히 "submission-created"이면
// 사이트의 어떤 폼(subscribe, consult 등)이 제출되든 Netlify가 자동으로 이 함수를
// 호출해준다 (별도 설정 불필요, 코드만 배포하면 바로 동작).
//
// 여기서는 제출 내용을 정리해서 슬랙 채널로 알림을 보낸다.
//
// 필요한 환경변수 (Netlify 대시보드 → Site configuration → Environment variables):
//   SLACK_WEBHOOK_URL : 슬랙 Incoming Webhook URL
//                        (슬랙 앱 관리 → Incoming Webhooks → 채널 선택 후 발급)
//                        코드에는 절대 넣지 않고 반드시 환경변수로만 설정한다.
//
// 참고: 이 함수는 실패해도 Netlify Forms 자체의 제출 저장(Forms 대시보드)에는
// 영향을 주지 않는다 — 슬랙 알림이 실패해도 신청 데이터 자체는 안전하게 쌓인다.

const FORM_LABELS = {
  subscribe: "🟣 새 구독 신청",
  consult: "🟢 새 상담 신청",
};

const FIELD_LABELS = {
  name: "이름",
  email: "이메일",
  phone: "연락처",
  referral: "구독 경로",
  message: "상담 내용",
};

// 슬랙 메시지에서 굳이 보여줄 필요 없는 내부용 필드
const SKIP_FIELDS = new Set(["bot-field", "form-name", "privacy_agree", "marketing_agree"]);

exports.handler = async (event) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("SLACK_WEBHOOK_URL 환경변수가 설정되지 않았습니다. 슬랙 알림을 건너뜁니다.");
    return { statusCode: 200, body: "ok (no webhook configured)" };
  }

  let payload;
  try {
    const body = JSON.parse(event.body || "{}");
    payload = body.payload || body;
  } catch (e) {
    console.error("제출 데이터 파싱 실패:", e);
    return { statusCode: 200, body: "ok (parse failed)" };
  }

  const formName = payload.form_name || "unknown";
  const data = payload.data || {};
  const title = FORM_LABELS[formName] || `🔔 새 폼 제출 (${formName})`;

  const lines = Object.entries(data)
    .filter(([key]) => !SKIP_FIELDS.has(key))
    .map(([key, value]) => `• *${FIELD_LABELS[key] || key}*: ${value || "-"}`);

  const text = [
    `*${title}*`,
    ...lines,
    `_${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}_`,
  ].join("\n");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`슬랙 전송 실패 (${res.status}):`, await res.text());
    }
  } catch (e) {
    console.error("슬랙 전송 중 오류:", e);
  }

  // Netlify는 이 함수의 statusCode를 폼 저장 여부와 무관하게 처리하지만,
  // 형식은 맞춰서 200으로 응답한다.
  return { statusCode: 200, body: "ok" };
};
