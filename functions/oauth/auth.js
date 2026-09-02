// functions/oauth/auth.js — Cloudflare Pages Function
// Decap CMS(/admin/)의 "GitHub으로 로그인" 팝업이 가장 먼저 여는 주소.
// 여기서 GitHub 인증 화면으로 넘겨주고, 인증이 끝나면 /oauth/callback 으로 돌아온다.
//
// 필요한 환경변수 (Cloudflare 대시보드 > Pages 프로젝트 > Settings > Environment variables):
//   GITHUB_CLIENT_ID      — GitHub OAuth App의 Client ID
//   GITHUB_CLIENT_SECRET  — GitHub OAuth App의 Client Secret (Secret 타입으로 저장)
//
// GitHub OAuth App 설정값:
//   Homepage URL              https://gonginssa.kr
//   Authorization callback URL https://gonginssa.kr/oauth/callback

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return new Response("GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET 환경변수가 설정되지 않았습니다.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const origin = new URL(request.url).origin;

  // CSRF 방지용 state. 쿠키에 저장해 두고 callback에서 대조한다.
  const state = crypto.randomUUID().replace(/-/g, "");

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", `${origin}/oauth/callback`);
  authUrl.searchParams.set("scope", "repo,user:email");
  authUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": `gi_oauth_state=${state}; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}
