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
// 2) v1 API를 1차로 사용, 실패 시 v2를 보정 시도로 호출한다.
// 3) 슬랙 실패 알림 추가: 스티비 등록이 v1·v2 모두 실패하면, 평소의 "새 구독 신청"
//    알림과는 별도로 "⚠️ 스티비 등록 실패" 알림을 보낸다.
//
// 260908 디버깅 — 실제 원인 확정
// ------------------------------------------------------------
// (1) 처음엔 슬랙 알림 자체가 안 왔다 → <form id="subForm">에 action 속성이 없어
//     JS가 어떤 이유로든 안 걸리면 브라우저가 현재 페이지로 그냥 POST해버려
//     API에 아예 도달을 못 했던 것으로 확인·수정.
// (2) 그다음엔 admin에 "스티비 등록 성공"으로 찍히는데 실제 주소록엔 없었다 →
//     실사용 테스트로 받은 스티비의 실제 응답이 원인을 그대로 알려줬다:
//       { "Ok": false, "Error": { "code": "UNKNOWN", "httpStatusCode": 200,
//         "message": "...json: cannot unmarshal array into Go value of
//         type request.AddSubscriberRequest" } }
//     즉 ① v1 API는 HTTP 200을 주더라도 본문의 "Ok" 필드로 실제 성공 여부를
//     알려주는데 이 필드를 안 보고 res.ok(HTTP 상태)만 확인해서 실패를 성공으로
//     오판했다. ② "cannot unmarshal array"는 v1이 배열로 감싼 바디를 거부한다는
//     뜻 — 스티비 공식 도움말의 "배열로 감싸라"는 예시와 반대로, 실제로는 순수
//     객체를 기대한다(v2와 동일한 형태). 두 가지를 모두 고쳤다: v1 바디를
//     배열 없이 객체로, 응답의 Ok 필드를 실제 성공 판정 기준으로 사용.

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
  // v1은 배열로 감싼 바디를 주면 "cannot unmarshal array into ... AddSubscriberRequest"
  // 로 실패한다(260908 실사용으로 확인) — v2와 동일하게 순수 객체로 보낸다.
  try {
    const res = await fetch(`https://api.stibee.com/v1/lists/${env.STIBEE_LIST_ID}/subscribers`, {
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
    return await interpretStibeeResponse(res);
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function registerViaV2(env, { email, name, referral }) {
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
    return await interpretStibeeResponse(res);
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// 260908 확인: 스티비는 요청이 형식적으로 잘못돼도 HTTP 200을 주고, 대신 응답
// 본문의 "Ok" 필드로 실제 성공 여부를 알려준다. res.ok(HTTP 상태)만 보면 이런
// 실패를 성공으로 오판한다 — 실제로 그렇게 오판했던 걸 실사용 테스트로 확인했다.
//   실패 예시: {"Ok":false,"Error":{"code":"UNKNOWN","httpStatusCode":200,"message":"..."},"Value":null}
// "Ok" 필드가 아예 없는 응답(다른 성공 형태일 가능성)까지 실패로 오판하지 않도록,
// JSON 파싱에 실패하거나 Ok 필드가 없으면 HTTP 상태만으로 성공 처리한다.
async function interpretStibeeResponse(res) {
  const bodyText = await res.text();
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}: ${bodyText}`, isDuplicate: looksLikeDuplicateEmail(bodyText) };
  }
  let parsed;
  try { parsed = JSON.parse(bodyText); } catch (e) { parsed = null; }
  if (parsed && parsed.Ok === false) {
    const msg = (parsed.Error && parsed.Error.message) || bodyText;
    return { ok: false, error: `HTTP 200이지만 Ok:false — ${msg}`, isDuplicate: looksLikeDuplicateEmail(msg) };
  }
  return { ok: true, rawResponse: bodyText };
}

// ⚠️ 스티비가 중복 이메일을 실제로 어떤 문구로 알려주는지는 아직 실사용으로
// 재현해본 적이 없다. 흔한 표현을 넓게 잡아둔 임시 휴리스틱이니, 첫 실제 중복
// 신청 로그를 보면 정확한 문구로 좁혀야 한다(오탐/누락돼도 등록 자체엔 영향
// 없고 슬랙·admin에 뜨는 문구만 달라진다).
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
