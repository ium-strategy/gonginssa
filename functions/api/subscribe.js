// functions/api/subscribe.js — Cloudflare Pages Function
// 구독 신청 폼 제출 처리: ① 스팸(허니팟) 필터 ② 스티비 구독자 등록(더블 옵트인) ③ 슬랙 알림
//
// 필요한 환경변수 (Cloudflare 대시보드 > Pages 프로젝트 > Settings > Environment variables):
//   SLACK_WEBHOOK_URL     — 슬랙 Incoming Webhook URL
//   STIBEE_ACCESS_TOKEN   — 스티비 워크스페이스 설정 > API 키에서 발급 (Standard 이상 플랜 필요)
//   STIBEE_LIST_ID        — 스티비 주소록 화면 URL의 숫자 (stibee.com/lists/123456)
// 위 스티비 값 두 개가 없으면 스티비 등록은 건너뛰고 슬랙 알림만 보냅니다(사이트는 정상 동작).
//
// 260904c 변경 사항
// ------------------------------------------------------------
// 1) 더블 옵트인 ON: confirmEmailYN을 "N" → "Y"로 변경. 방침(광고성 정보 수신 동의는
//    구독 확인까지 마쳐야 유효)과 실제 코드를 일치시켰다.
// 2) v1 API를 1차로 사용: 스티비 공식 도움말(주소록 API 사용하기)에 명시된
//    "POST /v1/lists/{listId}/subscribers" 형식은 예제까지 확인된 반면, v2의
//    "POST /v2/lists/{listId}/subscribers" 요청 바디 스펙은 공개 문서에서 정확히
//    확인하지 못했다. 신뢰도가 확인된 v1을 1차로 쓰고, v1이 실패할 때만 v2를
//    보정 시도로 한 번 더 호출한다(계정에 따라 v1이 막혀 있는 경우 대비).
// 3) 슬랙 실패 알림 추가: 스티비 등록이 v1·v2 모두 실패하면, 평소의 "새 구독 신청"
//    알림과는 별도로 "⚠️ 스티비 등록 실패" 알림을 보낸다. 담당자가 수동으로
//    주소록에 추가할 수 있도록 이메일·이름을 그대로 남긴다.
//
// ⚠️ v1 형식도 실제 발급받은 키로 한 번은 테스트 호출을 해봐야 한다(9/8 예정
// "스티비 API 실호출 검증" 작업). 실패 로그가 남으면 그 내용을 보고 조정한다.

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

  let stibeeOk = false;
  let stibeeErrorDetail = "";

  if (env.STIBEE_ACCESS_TOKEN && env.STIBEE_LIST_ID) {
    const v1 = await registerViaV1(env, { email, name, referral });
    if (v1.ok) {
      stibeeOk = true;
    } else {
      console.error("스티비 v1 등록 실패, v2로 재시도:", v1.error);
      const v2 = await registerViaV2(env, { email, name, referral });
      if (v2.ok) {
        stibeeOk = true;
      } else {
        console.error("스티비 v2 등록도 실패:", v2.error);
        stibeeErrorDetail = `v1: ${v1.error} / v2: ${v2.error}`;
      }
    }
  } else {
    stibeeErrorDetail = "STIBEE_ACCESS_TOKEN / STIBEE_LIST_ID 환경변수 미설정";
    console.error(stibeeErrorDetail + " — 스티비 등록을 건너뜁니다.");
  }

  // 평소 알림 — 제출 자체는 항상 슬랙에 남긴다 (스티비 성공 여부와 무관)
  await notifySlack(env, [
    `*🟣 새 구독 신청*`,
    `• *이름*: ${name || "-"}`,
    `• *이메일*: ${email || "-"}`,
    `• *구독 경로*: ${referral || "-"}`,
    `• *스티비 등록*: ${stibeeOk ? "성공" : "실패(아래 참고)"}`,
    `_${nowKST()}_`,
  ].join("\n"));

  // 실패 알림 — 스티비 등록이 끝내 안 됐을 때만 별도로 한 번 더 남긴다
  if (!stibeeOk) {
    await notifySlack(env, [
      `*⚠️ 스티비 등록 실패 — 수동 확인 필요*`,
      `• *이메일*: ${email || "-"}`,
      `• *이름*: ${name || "-"}`,
      `• *오류*: ${stibeeErrorDetail}`,
      `담당자가 스티비 주소록에 직접 추가해주세요.`,
    ].join("\n"));
  }

  return json({ ok: true });
}

async function registerViaV1(env, { email, name, referral }) {
  // 공식 도움말(주소록 API 사용하기)에 명시된 형식: 배열로 감싼 단일 객체, subscribers 배열.
  try {
    const res = await fetch(`https://api.stibee.com/v1/lists/${env.STIBEE_LIST_ID}/subscribers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        AccessToken: env.STIBEE_ACCESS_TOKEN,
      },
      body: JSON.stringify([
        {
          eventOccuredBy: "SUBSCRIBER",
          confirmEmailYN: "Y",
          subscribers: [{ email, name, 구독경로: referral }],
        },
      ]),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function registerViaV2(env, { email, name, referral }) {
  // v2 요청 바디는 공개 문서에서 정확한 스펙을 확인하지 못해 공개 사용 사례를 참고해 작성.
  // v1이 성공하면 이 함수는 호출되지 않는다 — 실패 시의 보정 시도용.
  try {
    const res = await fetch(`https://api.stibee.com/v2/lists/${env.STIBEE_LIST_ID}/subscribers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        AccessToken: env.STIBEE_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        eventOccuredBy: "SUBSCRIBER",
        confirmEmailYN: "Y",
        subscribers: [{ email, name, 구독경로: referral }],
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function notifySlack(env, text) {
  if (!env.SLACK_WEBHOOK_URL) {
    console.error("SLACK_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
    return;
  }
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
}

function nowKST() {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
