// functions/api/subscribe.js — Cloudflare Pages Function
// 구독 신청 폼 제출 처리: ① 스팸(허니팟) 필터 ② 스티비 구독자 등록 ③ 슬랙 알림
//
// 필요한 환경변수 (Cloudflare 대시보드 > Pages 프로젝트 > Settings > Environment variables):
//   SLACK_WEBHOOK_URL     — 슬랙 Incoming Webhook URL
//   STIBEE_ACCESS_TOKEN   — 스티비 워크스페이스 설정 > API 키에서 발급 (Standard 이상 플랜 필요)
//   STIBEE_LIST_ID        — 스티비 주소록 화면 URL의 숫자 (stibee.com/lists/123456)
// 위 스티비 값 두 개가 없으면 스티비 등록은 건너뛰고 슬랙 알림만 보냅니다(사이트는 정상 동작).
//
// ⚠️ 스티비 API 요청 형식(엔드포인트·바디 구조)은 공식 문서에서 정확한 스펙을 확인하지 못해
// 공개된 사용 사례를 참고해 작성했습니다. 실제 연동 전 스티비 API 문서 또는 발급받은 키로
// 테스트 호출을 한 번 해보고, 실패하면(로그에 에러 메시지 남음) 그때 요청 형식을 조정해야 합니다.

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    const body = await request.formData();
    data = Object.fromEntries(body.entries());
  } catch (e) {
    return json({ ok: false, error: "invalid form data" }, 400);
  }

  if (data["bot-field"]) {
    return json({ ok: true });
  }

  const email = data.email || "";
  const name = data.name || "";
  const referral = data.referral || "";

  if (env.STIBEE_ACCESS_TOKEN && env.STIBEE_LIST_ID) {
    try {
      const res = await fetch(`https://api.stibee.com/v2/lists/${env.STIBEE_LIST_ID}/subscribers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          AccessToken: env.STIBEE_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          eventOccuredBy: "MANUAL",
          confirmEmailYN: "N",
          subscribers: [{ email, name, 구독경로: referral }],
        }),
      });
      if (!res.ok) console.error(`스티비 등록 실패 (${res.status}):`, await res.text());
    } catch (e) {
      console.error("스티비 등록 중 오류:", e);
    }
  } else {
    console.error("STIBEE_ACCESS_TOKEN / STIBEE_LIST_ID가 설정되지 않아 스티비 등록을 건너뜁니다.");
  }

  if (env.SLACK_WEBHOOK_URL) {
    const text = [
      `*🟣 새 구독 신청*`,
      `• *이름*: ${name || "-"}`,
      `• *이메일*: ${email || "-"}`,
      `• *구독 경로*: ${referral || "-"}`,
      `_${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}_`,
    ].join("\n");
    try {
      const res = await fetch(env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) console.error(`슬랙 전송 실패 (${res.status}):`, await res.text());
    } catch (e) {
      console.error("슬랙 전송 중 오류:", e);
    }
  } else {
    console.error("SLACK_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
  }

  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
