// functions/api/subscribe.js — Cloudflare Pages Function
// 구독 신청 폼 제출 처리: ① 스팸(허니팟) 필터 ② 스티비 구독자 등록(더블 옵트인) ③ 슬랙 알림
//
// 필요한 환경변수 (Cloudflare 대시보드 > Pages 프로젝트 > Settings > Environment variables):
//   SLACK_WEBHOOK_URL     — 슬랙 Incoming Webhook URL
//   STIBEE_ACCESS_TOKEN   — 스티비 워크스페이스 설정 > API 키에서 발급 (Standard 이상 플랜 필요)
//   STIBEE_LIST_ID        — 스티비 주소록 화면 URL의 숫자 (stibee.com/lists/123456)
// 위 스티비 값 두 개가 없으면 스티비 등록은 건너뛰고 슬랙 알림만 보냅니다(사이트는 정상 동작).
// 필요한 바인딩 (Settings > Functions > KV namespace bindings):
//   LEADS_KV — consult.js와 같은 네임스페이스. 스티비·슬랙이 둘 다 실패해도
//              신청 자체는 admin.html "구독 신청" 탭에서 확인할 수 있도록
//              모든 제출을 여기에도 기록한다(성공 여부와 무관, sub_ 접두사).
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
// 260908 디버깅
// ------------------------------------------------------------
// 실사용 테스트에서 스티비 주소록에 안 쌓이는데 슬랙 알림도 전혀 안 왔다는 게
// 확인됨 — 슬랙은 이 함수가 실행되기만 하면 성공/실패 여부와 무관하게 항상
// 오게 돼 있으므로(아래 참고), 알림 자체가 없었다는 건 이 함수가 애초에
// 실행되지 않았다는 뜻이다. 가장 유력한 원인으로 <form id="subForm">에
// action 속성이 없던 것을 찾아 추가했다 — JS의 fetch가 어떤 이유로든(확장
// 프로그램 차단, 스크립트 오류 등) 안 걸리면 브라우저가 현재 페이지로 그냥
// POST해버려서 이 함수 자체에 요청이 안 왔을 가능성이 높다. 그 경우에도
// 최소한 이 엔드포인트로는 도달하게 만들어 자연 요청도 처리는 되도록 했다.
// 예상 못한 예외로 죽어도 흔적이 남게 try/catch도 추가했다(아래
// handleSubscribe 감싸는 부분).

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

  // 여기서부터 예상 못 한 예외가 나도 슬랙에 흔적을 남기고 500을 돌려준다 —
  // 이전에는 여기서 죽으면 아무 알림도 안 남아서 "왜 안 쌓이는지" 추적이 안 됐다.
  try {
    return await handleSubscribe(env, data);
  } catch (e) {
    console.error("구독 처리 중 예기치 못한 오류:", e);
    await notifySlack(env, `*🔴 구독 처리 중 서버 오류*\n\`\`\`${String(e && e.stack || e)}\`\`\``);
    return json({ ok: false, error: "internal error" }, 500);
  }
}

async function handleSubscribe(env, data) {
  const email = data.email || "";
  const name = data.name || "";
  const referral = data.referral || "";

  let stibeeOk = false;
  let stibeeErrorDetail = "";
  let isDuplicate = false;
  let stibeeRawResponse = "";

  if (env.STIBEE_ACCESS_TOKEN && env.STIBEE_LIST_ID) {
    const v1 = await registerViaV1(env, { email, name, referral });
    if (v1.ok) {
      stibeeOk = true;
      stibeeRawResponse = v1.rawResponse || "";
    } else if (v1.isDuplicate) {
      // 이미 등록된 이메일 — v2로 재시도해도 결과가 같을 것이므로 바로 확정한다.
      stibeeOk = true;
      isDuplicate = true;
    } else {
      console.error("스티비 v1 등록 실패, v2로 재시도:", v1.error);
      const v2 = await registerViaV2(env, { email, name, referral });
      if (v2.ok) {
        stibeeOk = true;
        stibeeRawResponse = v2.rawResponse || "";
      } else if (v2.isDuplicate) {
        stibeeOk = true;
        isDuplicate = true;
      } else {
        console.error("스티비 v2 등록도 실패:", v2.error);
        stibeeErrorDetail = `v1: ${v1.error} / v2: ${v2.error}`;
      }
    }
  } else {
    stibeeErrorDetail = "STIBEE_ACCESS_TOKEN / STIBEE_LIST_ID 환경변수 미설정";
    console.error(stibeeErrorDetail + " — 스티비 등록을 건너뜁니다.");
  }
  if (stibeeRawResponse) console.error("스티비 등록 응답(200 OK):", stibeeRawResponse);

  // KV 저장 — 슬랙·스티비가 둘 다 실패해도 신청 자체는 admin에서 확인 가능하게 남긴다.
  // consult.js의 리드 저장과 같은 네임스페이스를 sub_ 접두사로 구분해서 쓴다.
  if (env.LEADS_KV) {
    const entry = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email,
      name,
      referral,
      stibeeOk,
      duplicate: isDuplicate,
      stibeeRawResponse: stibeeRawResponse ? stibeeRawResponse.slice(0, 500) : "",
      submitted_at: new Date().toISOString(),
    };
    try {
      await env.LEADS_KV.put(entry.id, JSON.stringify(entry));
    } catch (e) {
      console.error("구독 신청 KV 저장 실패:", e);
    }
  } else {
    console.error("LEADS_KV 바인딩이 설정되지 않아 구독 신청 기록을 건너뜁니다.");
  }

  // 평소 알림 — 제출 자체는 항상 슬랙에 남긴다 (스티비 성공 여부와 무관).
  // 이미 등록된 이메일이면 "새 구독"이 아니므로 문구를 구분한다.
  await notifySlack(env, isDuplicate
    ? [
        `*🔁 이미 등록된 이메일로 재신청*`,
        `• *이름*: ${name || "-"}`,
        `• *이메일*: ${email || "-"}`,
        `• *구독 경로*: ${referral || "-"}`,
        `_${nowKST()}_`,
      ].join("\n")
    : [
        `*🟣 새 구독 신청*`,
        `• *이름*: ${name || "-"}`,
        `• *이메일*: ${email || "-"}`,
        `• *구독 경로*: ${referral || "-"}`,
        `• *스티비 등록*: ${stibeeOk ? "성공(200 OK)" : "실패(아래 참고)"}`,
        stibeeRawResponse
          ? `• *스티비 응답*: \`\`\`${stibeeRawResponse.slice(0, 400)}\`\`\` (200이어도 실제 등록 안 될 수 있음 — 주소록에서 직접 확인해주세요)`
          : "",
        `_${nowKST()}_`,
      ].filter(Boolean).join("\n"));

  // 실패 알림 — 스티비 등록이 끝내 안 됐을 때만 별도로 한 번 더 남긴다 (중복은 실패가 아니므로 제외)
  if (!stibeeOk) {
    await notifySlack(env, [
      `*⚠️ 스티비 등록 실패 — 수동 확인 필요*`,
      `• *이메일*: ${email || "-"}`,
      `• *이름*: ${name || "-"}`,
      `• *오류*: ${stibeeErrorDetail}`,
      `담당자가 스티비 주소록에 직접 추가해주세요.`,
    ].join("\n"));
  }

  return json({ ok: true, duplicate: isDuplicate });
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
    const bodyText = await res.text();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${bodyText}`, isDuplicate: looksLikeDuplicateEmail(bodyText) };
    }
    // ⚠️ 260908 확인: HTTP 200(res.ok)이 실제 구독자 등록을 보장하지 않는 것으로
    // 실사용에서 재현됨(등록 "성공"으로 찍혔는데 스티비 주소록엔 안 쌓임). 정확한
    // 성공 판별 스키마를 아직 모르므로, 우선 응답 바디를 그대로 반환해 호출부가
    // 슬랙에 남기게 한다 — 다음 실제 테스트에서 이 값을 보고 진짜 조건을 찾는다.
    return { ok: true, rawResponse: bodyText };
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
    const bodyText = await res.text();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${bodyText}`, isDuplicate: looksLikeDuplicateEmail(bodyText) };
    }
    return { ok: true, rawResponse: bodyText };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ⚠️ 스티비가 중복 이메일을 실제로 어떤 문구·상태코드로 알려주는지 공식 문서에
// 명시돼 있지 않고, 아직 실사용으로 재현해본 적도 없다. 흔한 표현을 넓게
// 잡아둔 임시 휴리스틱이니, 첫 실제 중복 신청 로그를 보면 정확한 문구로
// 좁혀야 한다(현재 이 함수가 오탐/누락돼도 사용자에게는 정상 흐름으로
// 처리되므로 — 위 stibeeOk = true — 최악의 경우 문구만 틀리게 나간다).
function looksLikeDuplicateEmail(errorBody) {
  return /이미|중복|already|duplicate|exist/i.test(errorBody || "");
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
