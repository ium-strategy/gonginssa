# 공인싸 홈페이지 수정 내역

브랜치 `claude/gonginssa-website-content-crc2vo`에 커밋은 완료했지만, 이 세션에 저장소 쓰기 권한이 없어 GitHub에 푸시가 안 되고 있습니다. 대신 변경된 `index.html`, `assets/site.css` 전체 diff를 아래에 남깁니다. 저장소 접근 권한이 있는 분이 이 diff를 로컬에서 적용(`git apply`) 후 푸시하면 됩니다.

## 변경 요약

1. **공인싸 소개 섹션 신규 추가** — 페이지 최상단(히어로 위)에 소개글 삽입
   - 헤드 카피: `공공 홍보 인사이트 플랫폼, 공인싸`
   - 본문 카피: 보도자료 한 줄, 카드뉴스 문구 하나까지 고민될 때 / 공인싸에서 실무의 힌트를 얻고, 오늘의 업무에 바로 적용해보세요 / 매주 화요일 공보레터로 찾아갑니다
   - `by 이음전략소` 표기

2. **뉴스레터 구독 CTA를 오른쪽 고정(sticky) 사이드바로 이동**
   - 기존 본문 중간의 전체 폭 구독 배너를 제거
   - 본문(좌) + 구독 카드(우) 2단 레이아웃으로 변경, 스크롤해도 우측 구독 카드가 계속 보이도록 `position: sticky` 적용
   - 모바일에서는 사이드바가 본문 상단으로 이동(스택형)

3. **이음전략소 소개 섹션 카피 수정**
   - 헤드 카피: `공공기관 홍보 전문 파트너, 이음전략소`
   - 본문 카피: 정책 이해부터 기획·제작·운영·광고까지 한 흐름으로 연결합니다 / 담당자의 업무는 가볍게, 홍보의 완성도는 높여드립니다
   - CTA 버튼: `포트폴리오 보기` / `무료 상담 신청`

> 참고: 기존 안내 문구는 "격주 발행"인데 이번에 추가한 소개글 본문은 "매주 화요일 공보레터로 찾아갑니다"로 되어 있어 발행 주기 표현이 서로 다릅니다. 요청하신 문구 그대로 반영했으니, 실제 발행 주기에 맞게 둘 중 하나로 통일하실지 확인 부탁드립니다.

## 적용 방법

아래 diff를 `gonginssa-변경내역.patch` 같은 파일로 저장한 뒤, 저장소 루트에서:

```bash
git checkout -b claude/gonginssa-website-content-crc2vo origin/main
git apply gonginssa-변경내역.patch
git add index.html assets/site.css
git commit -m "Add gonginssa intro section, sticky newsletter sidebar, refresh studio copy"
git push -u origin claude/gonginssa-website-content-crc2vo
```

## 전체 Diff

```diff
diff --git a/assets/site.css b/assets/site.css
index e5285cd..6eb734a 100644
--- a/assets/site.css
+++ b/assets/site.css
@@ -91,6 +91,13 @@ img { max-width: 100%; display: block; }
 .dateline__tags span::before { content: "·"; margin-right: 7px; color: var(--ink-3); }
 .dateline__tags span:first-child::before { content: none; }
 
+/* intro (공인싸 소개) */
+.intro-section { padding: 44px 0 0; }
+.intro { max-width: 640px; display: flex; flex-direction: column; gap: 14px; }
+.intro__title { font-size: clamp(26px, 3.4vw, 36px); font-weight: 800; letter-spacing: -.03em; }
+.intro__body { font-size: 17px; color: var(--ink-2); line-height: 1.75; }
+.intro__by { font-family: var(--font-mono); font-size: 13px; color: var(--ink-3); letter-spacing: .03em; }
+
 /* hero / cover */
 .hero { padding: 46px 0 8px; }
 .hero__grid { display: grid; grid-template-columns: 1.62fr 1fr; border-top: 2px solid var(--rule); }
@@ -173,13 +180,20 @@ img { max-width: 100%; display: block; }
 .cloud .n { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }
 .cloud a:hover .n { color: color-mix(in srgb, var(--surface) 80%, transparent); }
 
-/* subscribe band */
-.band { background: var(--navy); border-radius: 20px; overflow: hidden; position: relative; color: #fff; padding: 52px 44px; }
-.band__grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; align-items: center; }
-.band h2 { font-size: 28px; font-weight: 800; color: #fff; }
-.band p { color: rgba(255,255,255,.78); margin-top: 10px; font-size: 16px; }
-.band__deco { position: absolute; inset: 0; opacity: .5;
-  background: radial-gradient(600px 200px at 88% -10%, rgba(255,255,255,.14), transparent), radial-gradient(500px 240px at 0% 120%, rgba(35,83,217,.4), transparent); }
+/* layout: main column + sticky right rail */
+.layout { display: grid; grid-template-columns: 1fr 340px; gap: 48px; align-items: start; padding-top: 8px; }
+.layout__main { min-width: 0; }
+.layout__aside { position: relative; }
+
+/* subscribe card (sticky sidebar) */
+.subscribe-card { position: sticky; top: 90px; background: var(--navy); border-radius: 20px; overflow: hidden;
+  color: #fff; padding: 34px 30px; display: flex; flex-direction: column; gap: 8px; }
+.subscribe-card__deco { position: absolute; inset: 0; opacity: .5;
+  background: radial-gradient(360px 160px at 100% 0%, rgba(255,255,255,.14), transparent), radial-gradient(320px 200px at 0% 120%, rgba(35,83,217,.4), transparent); }
+.subscribe-card > :not(.subscribe-card__deco) { position: relative; z-index: 1; }
+.subscribe-card__eyebrow { color: rgba(255,255,255,.6); }
+.subscribe-card__title { font-size: 21px; font-weight: 800; color: #fff; margin-top: 4px; }
+.subscribe-card__desc { color: rgba(255,255,255,.78); font-size: 14.5px; margin: 8px 0 16px; }
 .subform { display: flex; flex-direction: column; gap: 12px; }
 .subform__row { display: flex; gap: 10px; }
 .subform input[type="email"] { flex: 1; min-width: 0; padding: 14px 18px; border-radius: 999px; border: 1.5px solid rgba(255,255,255,.28);
@@ -257,8 +271,11 @@ img { max-width: 100%; display: block; }
   .cover { border-right: none; padding: 26px 0 30px; border-bottom: 1px solid var(--line); }
   .contents { padding: 26px 0 6px; }
   .cards { grid-template-columns: repeat(2, 1fr); }
-  .band__grid, .studio { grid-template-columns: 1fr; }
+  .studio { grid-template-columns: 1fr; }
   .footer__grid { grid-template-columns: 1fr 1fr; }
+  .layout { grid-template-columns: 1fr; }
+  .layout__aside { order: -1; }
+  .subscribe-card { position: static; }
 }
 @media (max-width: 620px) {
   body { font-size: 16px; }
@@ -267,7 +284,7 @@ img { max-width: 100%; display: block; }
   .catrow__desc { display: none; }
   .job { grid-template-columns: 1fr; gap: 8px; }
   .job__meta { justify-content: flex-start; }
-  .band, .studio, .np__card { padding: 30px 22px; }
+  .studio, .np__card, .subscribe-card { padding: 30px 22px; }
   .subform__row { flex-direction: column; }
   .footer__grid { grid-template-columns: 1fr; gap: 28px; }
   .studio__actions .btn, .np__actions .btn { flex: 1; }
diff --git a/index.html b/index.html
index b3c32b4..b804522 100644
--- a/index.html
+++ b/index.html
@@ -49,100 +49,102 @@
     </div>
 
     <main>
-      <section class="hero">
-        <div class="wrap"><div class="hero__grid" id="hero-grid"></div></div>
-      </section>
-
-      <section class="section section--rule" id="latest">
+      <section class="intro-section">
         <div class="wrap">
-          <div class="sec-head">
-            <div class="sec-head__l"><span class="eyebrow">This week</span><h2 class="sec-title">이번 주 공인싸</h2></div>
-            <a class="more" href="#" data-demo>아티클 전체 →</a>
+          <div class="intro reveal">
+            <span class="eyebrow">About Gonginssa</span>
+            <h1 class="intro__title">공공 홍보 인사이트 플랫폼, 공인싸</h1>
+            <p class="intro__body">
+              보도자료 한 줄, 카드뉴스 문구 하나까지 고민될 때.<br />
+              공인싸에서 실무의 힌트를 얻고, 오늘의 업무에 바로 적용해보세요.<br />
+              매주 화요일 공보레터로 찾아갑니다.
+            </p>
+            <span class="intro__by">by 이음전략소</span>
           </div>
-          <div class="cards reveal" id="latest-cards"></div>
         </div>
       </section>
 
-      <section class="section" id="index">
-        <div class="wrap">
-          <div class="sec-head">
-            <div class="sec-head__l"><span class="eyebrow">Index</span><h2 class="sec-title">카테고리 색인</h2>
-              <p class="sec-sub">공보레터 5개 코너가 그대로 사이트 카테고리가 됩니다.</p></div>
-          </div>
-          <div class="catindex reveal" id="cat-index"></div>
-        </div>
+      <section class="hero">
+        <div class="wrap"><div class="hero__grid" id="hero-grid"></div></div>
       </section>
 
-      <section class="section section--rule">
-        <div class="wrap">
-          <div class="sec-head">
-            <div class="sec-head__l"><span class="eyebrow">Keywords</span><h2 class="sec-title">트렌드 키워드로 찾아보기</h2></div>
-          </div>
-          <div class="cloud reveal" id="cloud"></div>
-        </div>
-      </section>
+      <div class="wrap layout">
+        <div class="layout__main">
+          <section class="section section--rule" id="latest">
+            <div class="sec-head">
+              <div class="sec-head__l"><span class="eyebrow">This week</span><h2 class="sec-title">이번 주 공인싸</h2></div>
+              <a class="more" href="#" data-demo>아티클 전체 →</a>
+            </div>
+            <div class="cards reveal" id="latest-cards"></div>
+          </section>
 
-      <section class="section" id="subscribe">
-        <div class="wrap">
-          <div class="band reveal">
-            <div class="band__deco" aria-hidden="true"></div>
-            <div class="band__grid">
-              <div>
-                <h2>격주마다 공공 홍보 인사이트를<br />이메일로 받아보세요</h2>
-                <p>공보레터는 무료입니다. 언제든 구독을 취소할 수 있습니다.</p>
-              </div>
-              <form class="subform" onsubmit="return giSubscribe(event)">
-                <div class="subform__row">
-                  <input type="email" placeholder="이메일 주소" aria-label="이메일 주소" required />
-                  <button type="submit" class="btn btn--primary">구독하기</button>
-                </div>
-                <label class="agree"><input type="checkbox" required /><span>광고성 정보 수신에 동의합니다. (언제든 구독 취소 가능)</span></label>
-              </form>
+          <section class="section" id="index">
+            <div class="sec-head">
+              <div class="sec-head__l"><span class="eyebrow">Index</span><h2 class="sec-title">카테고리 색인</h2>
+                <p class="sec-sub">공보레터 5개 코너가 그대로 사이트 카테고리가 됩니다.</p></div>
             </div>
-          </div>
-        </div>
-      </section>
+            <div class="catindex reveal" id="cat-index"></div>
+          </section>
 
-      <section class="section" id="jobs">
-        <div class="wrap">
-          <div class="sec-head">
-            <div class="sec-head__l"><span class="eyebrow">Careers</span><h2 class="sec-title">공공 홍보 채용</h2>
-              <p class="sec-sub">공공기관·공기업·홍보 대행사 채용 소식을 모았습니다.</p></div>
-            <a class="more" href="#" data-demo>채용 전체 →</a>
-          </div>
-          <div class="jobs-list reveal" id="jobs-list"></div>
-        </div>
-      </section>
+          <section class="section section--rule">
+            <div class="sec-head">
+              <div class="sec-head__l"><span class="eyebrow">Keywords</span><h2 class="sec-title">트렌드 키워드로 찾아보기</h2></div>
+            </div>
+            <div class="cloud reveal" id="cloud"></div>
+          </section>
 
-      <section class="section section--rule" id="studio">
-        <div class="wrap">
-          <div class="studio reveal">
-            <div>
-              <span class="eyebrow">Publisher</span>
-              <h2 style="margin-top: 10px">공인싸는 이음전략소가 만듭니다</h2>
-              <p>이음전략소는 공공 홍보·마케팅 풀서비스 대행사입니다. 공인싸의 모든 콘텐츠는 현장에서 직접 쌓은 경험에서 나옵니다.</p>
-              <div class="studio__actions">
-                <a class="btn btn--primary" href="#" data-demo>이음전략소 알아보기</a>
-                <a class="btn btn--line" href="#" data-demo>상담 문의하기</a>
+          <section class="section section--rule" id="jobs">
+            <div class="sec-head">
+              <div class="sec-head__l"><span class="eyebrow">Careers</span><h2 class="sec-title">공공 홍보 채용</h2>
+                <p class="sec-sub">공공기관·공기업·홍보 대행사 채용 소식을 모았습니다.</p></div>
+              <a class="more" href="#" data-demo>채용 전체 →</a>
+            </div>
+            <div class="jobs-list reveal" id="jobs-list"></div>
+          </section>
+
+          <section class="section section--rule" id="studio">
+            <div class="studio reveal">
+              <div>
+                <span class="eyebrow">Publisher</span>
+                <h2 style="margin-top: 10px">공공기관 홍보 전문 파트너, 이음전략소</h2>
+                <p>정책 이해부터 기획·제작·운영·광고까지 한 흐름으로 연결합니다.<br />담당자의 업무는 가볍게, 홍보의 완성도는 높여드립니다.</p>
+                <div class="studio__actions">
+                  <a class="btn btn--primary" href="#" data-demo>포트폴리오 보기</a>
+                  <a class="btn btn--line" href="#" data-demo>무료 상담 신청</a>
+                </div>
+              </div>
+              <div class="studio__svc" aria-hidden="true">
+                <span class="svc">기획</span><span class="svc">제작</span>
+                <span class="svc">운영</span><span class="svc">광고</span>
               </div>
             </div>
-            <div class="studio__svc" aria-hidden="true">
-              <span class="svc">기획</span><span class="svc">제작</span>
-              <span class="svc">운영</span><span class="svc">광고</span>
+          </section>
+
+          <section class="section section--rule" id="newsletter">
+            <div class="sec-head">
+              <div class="sec-head__l"><span class="eyebrow">Archive</span><h2 class="sec-title">최근 공보레터</h2></div>
+              <a class="more" href="#" data-demo>지난 호 전체 →</a>
             </div>
-          </div>
+            <div class="np reveal" id="np"></div>
+          </section>
         </div>
-      </section>
 
-      <section class="section" id="newsletter">
-        <div class="wrap">
-          <div class="sec-head">
-            <div class="sec-head__l"><span class="eyebrow">Archive</span><h2 class="sec-title">최근 공보레터</h2></div>
-            <a class="more" href="#" data-demo>지난 호 전체 →</a>
+        <aside class="layout__aside">
+          <div class="subscribe-card reveal" id="subscribe">
+            <div class="subscribe-card__deco" aria-hidden="true"></div>
+            <span class="eyebrow subscribe-card__eyebrow">Newsletter</span>
+            <h2 class="subscribe-card__title">격주마다 공공 홍보 인사이트를 이메일로 받아보세요</h2>
+            <p class="subscribe-card__desc">공보레터는 무료입니다. 언제든 구독을 취소할 수 있습니다.</p>
+            <form class="subform" onsubmit="return giSubscribe(event)">
+              <div class="subform__row" style="flex-direction: column">
+                <input type="email" placeholder="이메일 주소" aria-label="이메일 주소" required />
+                <button type="submit" class="btn btn--primary">구독하기</button>
+              </div>
+              <label class="agree"><input type="checkbox" required /><span>광고성 정보 수신에 동의합니다. (언제든 구독 취소 가능)</span></label>
+            </form>
           </div>
-          <div class="np reveal" id="np"></div>
-        </div>
-      </section>
+        </aside>
+      </div>
     </main>
 
     <footer class="footer">

```
