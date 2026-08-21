// netlify/functions/subscribers.js
//
// 구독 신청 폼(Netlify Forms)에 쌓인 데이터를 관리자 화면(out/admin-subscribers.html)에서
// 볼 수 있도록 중계하는 서버리스 함수.
//
// 인증: Netlify Identity로 로그인한 사용자만 호출 가능 (context.clientContext.user 확인).
//       admin-subscribers.html이 로그인 후 발급받은 Identity JWT를
//       Authorization: Bearer <token> 헤더에 담아 이 함수를 호출한다.
//
// 필요한 환경변수 (Netlify 대시보드 → Site configuration → Environment variables):
//   NETLIFY_API_TOKEN : Netlify Personal Access Token (User settings → Applications → New access token)
//                        — Forms 제출 데이터를 읽어오려면 필수. 코드에는 절대 넣지 않는다.
//   SITE_ID           : (선택) gonginssa 사이트의 Netlify Site ID.
//                        미설정 시 아래 DEFAULT_SITE_ID를 사용한다.

const DEFAULT_SITE_ID = "c0034b79-6652-4c17-94ca-ea6343b68c42"; // gonginssa
const FORM_NAME = "subscribe";

exports.handler = async (event, context) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  };

  // 1) Identity 로그인 확인 (Netlify가 Authorization 헤더의 JWT를 자동 검증해서 채워줌)
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return {
      statusCode: 401,
      headers: cors,
      body: JSON.stringify({ error: "로그인이 필요합니다. (Netlify Identity)" }),
    };
  }

  const apiToken = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.SITE_ID || DEFAULT_SITE_ID;

  if (!apiToken) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({
        error: "NETLIFY_API_TOKEN 환경변수가 설정되지 않았습니다. Netlify 대시보드에서 설정해주세요.",
      }),
    };
  }

  try {
    // 2) 사이트의 폼 목록에서 'subscribe' 폼 ID 찾기
    const formsRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/forms`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    if (!formsRes.ok) {
      throw new Error(`Netlify forms API 오류 (${formsRes.status})`);
    }
    const forms = await formsRes.json();
    const form = forms.find((f) => f.name === FORM_NAME);
    if (!form) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ subscribers: [], note: "subscribe 폼을 아직 찾을 수 없습니다." }),
      };
    }

    // 3) 해당 폼의 제출 데이터 가져오기
    const subsRes = await fetch(
      `https://api.netlify.com/api/v1/forms/${form.id}/submissions`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    if (!subsRes.ok) {
      throw new Error(`Netlify submissions API 오류 (${subsRes.status})`);
    }
    const submissions = await subsRes.json();

    const subscribers = submissions
      .map((s) => ({
        email: s.data && s.data.email,
        name: s.data && s.data.name,
        referral: s.data && s.data.referral,
        submitted_at: s.created_at,
      }))
      .filter((s) => s.email)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ subscribers, total: subscribers.length }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: cors,
      body: JSON.stringify({ error: String(err.message || err) }),
    };
  }
};
