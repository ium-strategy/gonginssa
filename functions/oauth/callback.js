// functions/oauth/callback.js — Cloudflare Pages Function
// GitHub 인증이 끝나면 이 주소로 돌아온다. 받은 code를 액세스 토큰으로 교환한 뒤,
// 팝업 → 원래 창(Decap CMS)으로 postMessage 로 토큰을 넘기고 팝업을 닫는다.
//
// Client Secret은 이 함수(서버) 안에서만 쓰인다. 브라우저로 나가지 않는다.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookie = request.headers.get("Cookie") || "";
  const savedState = (cookie.match(/(?:^|;\s*)gi_oauth_state=([^;]+)/) || [])[1];

  if (!code) return page(errorScript("GitHub에서 인증 코드를 받지 못했습니다."));
  if (!state || !savedState || state !== savedState) {
    return page(errorScript("인증 요청이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요."));
  }

  let token;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "gonginssa-cms",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/oauth/callback`,
      }),
    });
    const data = await res.json();
    if (!data.access_token) {
      console.error("토큰 교환 실패:", JSON.stringify(data));
      return page(errorScript("액세스 토큰을 발급받지 못했습니다."));
    }
    token = data.access_token;
  } catch (e) {
    console.error("토큰 교환 중 오류:", e);
    return page(errorScript("인증 처리 중 오류가 발생했습니다."));
  }

  return page(successScript(token));
}

function successScript(token) {
  const payload = JSON.stringify(JSON.stringify({ token, provider: "github" }));
  return `
    (function () {
      function receive(message) {
        if (!message.origin) return;
        window.opener.postMessage("authorization:github:success:" + ${payload}, message.origin);
        window.removeEventListener("message", receive, false);
      }
      window.addEventListener("message", receive, false);
      window.opener.postMessage("authorizing:github", "*");
    })();`;
}

function errorScript(msg) {
  const payload = JSON.stringify(JSON.stringify({ message: msg }));
  return `
    document.body.textContent = ${JSON.stringify(msg)};
    if (window.opener) {
      window.opener.postMessage("authorization:github:error:" + ${payload}, "*");
    }`;
}

function page(script) {
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>인증 처리 중</title></head><body><script>${script}</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": "gi_oauth_state=; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
